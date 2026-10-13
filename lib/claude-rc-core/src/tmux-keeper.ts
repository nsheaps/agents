import { chmodSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { probeSession, TMUX_SESSION, tmuxConf } from "./tmux";
import { realExec, type Exec } from "./supervisor-types";

export interface KeeperOptions {
  tmuxBin: string;
  /** Private socket for this repo's tmux server. */
  socket: string;
  /** Repo name (shown in the tmux status line). */
  name: string;
  cwd: string;
  argv: string[];
  /** Append everything the pane prints to this file (what `claude-rc logs` shows). */
  logFile?: string;
  /** Environment of the tmux server and so of the command; defaults to this process's. */
  env?: Record<string, string | undefined>;
  pollMs?: number;
  /** Aborting kills the session and returns 143. */
  signal?: AbortSignal;
  log?: (line: string) => void;
  exec?: Exec;
  cols?: number;
  rows?: number;
}

/** The directory must be ours and private: anyone who can reach the socket can drive the session. */
function ensureSocketDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = lstatSync(dir);
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  if (!st.isDirectory() || (uid !== undefined && st.uid !== uid))
    throw new Error(`${dir} is not a directory owned by you; refusing to put a tmux socket there`);
  if ((st.mode & 0o077) !== 0) chmodSync(dir, 0o700);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });

/**
 * Run `argv` in a tmux session and stay in the foreground until it ends, so a supervisor sees one
 * long-lived process (a plain `tmux new-session -d` returns at once and hides the real work).
 * Resolves with the command's exit status (128+N for a signal), 143 when aborted, 1 when the
 * session vanished, 127 when tmux itself cannot run.
 */
export async function runTmuxKeeper(o: KeeperOptions): Promise<number> {
  const log = o.log ?? (() => {});
  const exec = o.exec ?? realExec;
  const tmux = (...a: string[]) => exec([o.tmuxBin, "-S", o.socket, ...a]);
  const conf = o.socket.replace(/\.sock$/, "") + ".conf";
  // Older tmux (3.3) cannot report how a signalled pane died, so a tiny wrapper records `$?` itself.
  const statusFile = o.socket.replace(/\.sock$/, "") + ".status";
  const readStatus = (): number | undefined => {
    try {
      const v = readFileSync(statusFile, "utf8").trim();
      return /^\d+$/.test(v) ? Number(v) : undefined;
    } catch {
      return undefined;
    }
  };

  try {
    ensureSocketDir(dirname(o.socket));
  } catch (e) {
    log(`[claude-rc] cannot prepare tmux socket: ${(e as Error).message}`);
    return 1;
  }

  // pid of the tmux server this keeper created. A supervisor may start the next keeper on the same
  // socket before this one has finished exiting; teardown must then leave the newer server alone.
  let serverPid: string | undefined;
  const livePid = async () => {
    const r = await tmux("display-message", "-p", "-t", TMUX_SESSION, "#{pid}").catch(() => null);
    return r && r.code === 0 ? r.stdout.trim() : undefined;
  };
  const teardown = async () => {
    if (serverPid !== undefined) {
      const now = await livePid();
      if (now !== undefined && now !== serverPid) return; // someone else's server now
    }
    await tmux("kill-server").catch(() => {});
    for (const f of [o.socket, statusFile, conf])
      try {
        unlinkSync(f);
      } catch {}
  };

  await teardown(); // a server left behind by a keeper that was SIGKILLed
  try {
    writeFileSync(conf, tmuxConf(o.name), { mode: 0o600 }); // after teardown, which removes the old one
  } catch (e) {
    log(`[claude-rc] cannot write tmux config: ${(e as Error).message}`);
    return 1;
  }

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.env ?? process.env)) if (v !== undefined) env[k] = v;
  delete env.TMUX; // never nest into whatever tmux this process happens to be inside

  let create: Awaited<ReturnType<Exec>>;
  try {
    const p = Bun.spawn(
      [
        o.tmuxBin,
        "-S",
        o.socket,
        "-f",
        conf,
        "new-session",
        "-d",
        "-s",
        TMUX_SESSION,
        "-c",
        o.cwd,
        "-x",
        String(o.cols ?? 120),
        "-y",
        String(o.rows ?? 40),
        "--",
        "sh",
        "-c",
        'f=$1; shift; "$@"; s=$?; echo "$s" > "$f"; exit "$s"',
        "claude-rc",
        statusFile,
        ...o.argv,
      ],
      { env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(p.stdout).text(),
      new Response(p.stderr).text(),
      p.exited,
    ]);
    create = { code, stdout, stderr };
  } catch (e) {
    log(`[claude-rc] cannot run tmux (${o.tmuxBin}): ${(e as Error).message}`);
    return 127;
  }
  if (create.code !== 0) {
    log(`[claude-rc] tmux new-session failed: ${create.stderr.trim() || create.stdout.trim()}`);
    return 1;
  }
  serverPid = await livePid();
  log(
    `[claude-rc] tmux session "${TMUX_SESSION}" started: tmux -S ${o.socket} attach -t ${TMUX_SESSION}`,
  );

  if (o.logFile) {
    // Output printed before pipe-pane attached would be lost, so also log what is already there.
    const q = `'${o.logFile.replace(/'/g, `'\\''`)}'`;
    const pp = await tmux("pipe-pane", "-t", TMUX_SESSION, `cat >> ${q}`).catch(() => undefined);
    if (!pp || pp.code !== 0)
      log(`[claude-rc] cannot log pane output: ${pp?.stderr.trim() ?? "tmux failed"}`);
    else {
      const first = await probeSession(exec, o.tmuxBin, o.socket, 200);
      for (const l of first?.tail ?? []) log(l);
    }
  }

  const pollMs = o.pollMs ?? 1000;
  for (;;) {
    await sleep(pollMs, o.signal);
    if (o.signal?.aborted) {
      await teardown();
      return 143;
    }
    let p = await probeSession(exec, o.tmuxBin, o.socket, 0);
    // tmux can flag a pane dead a moment before it has reaped the child's status; ask again.
    for (
      let i = 0;
      p?.dead && p.exitStatus === undefined && readStatus() === undefined && i < 10;
      i++
    ) {
      await sleep(100, o.signal);
      p = await probeSession(exec, o.tmuxBin, o.socket, 0);
    }
    if (!p) {
      log("[claude-rc] tmux session disappeared");
      await teardown();
      return 1;
    }
    if (p.dead) {
      const full = await probeSession(exec, o.tmuxBin, o.socket, 40);
      const status = readStatus() ?? p.exitStatus ?? 1;
      log(`[claude-rc] pane exited with status ${status}; last output:`);
      for (const l of full?.tail ?? []) log(l);
      await teardown();
      return status;
    }
  }
}
