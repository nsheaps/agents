import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeSession } from "./tmux";
import { runTmuxKeeper, type KeeperOptions } from "./tmux-keeper";
import { realExec } from "./supervisor-types";

const TMUX = Bun.which("tmux");
const real = TMUX ? describe : describe.skip; // CI installs tmux; skip rather than fail where absent

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "rc-keeper-"));
  const socket = join(dir, "t", "x.sock");
  const lines: string[] = [];
  const ac = new AbortController();
  const opts = (argv: string[], extra: Partial<KeeperOptions> = {}): KeeperOptions => ({
    tmuxBin: TMUX!,
    socket,
    name: "x",
    cwd: dir,
    argv,
    pollMs: 50,
    signal: ac.signal,
    log: (s) => lines.push(s),
    ...extra,
  });
  cleanups.push(async () => {
    ac.abort();
    await realExec([TMUX!, "-S", socket, "kill-server"]);
  });
  const probe = () => probeSession(realExec, TMUX!, socket);
  const waitFor = async <T>(fn: () => Promise<T | null | undefined | false>, ms = 5000) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error("timed out");
      await Bun.sleep(30);
    }
  };
  return { dir, socket, lines, ac, opts, probe, waitFor };
}

real("runTmuxKeeper (real tmux)", () => {
  test("returns the command's exit status and tears the server down", async () => {
    const t = setup();
    const code = await runTmuxKeeper(t.opts(["sh", "-c", "echo bye; exit 7"]));
    expect(code).toBe(7);
    expect(await t.probe()).toBeNull();
  });

  test("the last output before an exit is written to the log", async () => {
    const t = setup();
    await runTmuxKeeper(t.opts(["sh", "-c", "echo last words; exit 1"]));
    expect(t.lines.join("\n")).toContain("last words");
    expect(t.lines.join("\n")).toContain("status 1");
  });

  test("logFile receives output printed while the session runs, including the first line", async () => {
    const t = setup();
    const logFile = join(t.dir, "out.log");
    const done = runTmuxKeeper(
      t.opts(["sh", "-c", "echo first-line; sleep 0.3; echo second-line; sleep 1"], { logFile }),
    );
    await t.waitFor(async () => {
      const txt = existsSync(logFile) ? readFileSync(logFile, "utf8") : "";
      return txt.includes("second-line") && txt;
    });
    // Output from before pipe-pane attached is replayed through log() (same file under a supervisor).
    expect(readFileSync(logFile, "utf8") + t.lines.join("\n")).toContain("first-line");
    await done;
  });

  test("a signal-killed command reports 128+signal", async () => {
    const t = setup();
    const code = await runTmuxKeeper(t.opts(["sh", "-c", "kill -TERM $$"]));
    expect(code).toBe(143);
  });

  test("while it runs the session is probeable and attachable", async () => {
    const t = setup();
    const done = runTmuxKeeper(t.opts(["sh", "-c", "echo ready; sleep 30"]));
    const p = await t.waitFor(async () => {
      const x = await t.probe();
      return x && x.tail.includes("ready") ? x : null;
    });
    expect(p.dead).toBe(false);
    expect(p.attached).toBe(0);
    expect(p.pid).toBeGreaterThan(0);
    t.ac.abort();
    expect(await done).toBe(143);
    expect(await t.probe()).toBeNull();
  });

  test("the command gets a real terminal, the repo directory, the env and exact argv", async () => {
    const t = setup();
    const script = 'test -t 0 && echo "tty=yes"; pwd; echo "env=$FOO"; echo "arg=$1"';
    const code = await runTmuxKeeper(
      t.opts(["sh", "-c", script, "_", "a b"], { env: { ...process.env, FOO: "bar" } }),
    );
    expect(code).toBe(0);
    const log = t.lines.join("\n");
    expect(log).toContain("tty=yes");
    expect(log).toContain(t.dir);
    expect(log).toContain("env=bar");
    expect(log).toContain("arg=a b");
  });

  test("an outside kill of the session makes the keeper exit non-zero", async () => {
    const t = setup();
    const done = runTmuxKeeper(t.opts(["sleep", "30"]));
    await t.waitFor(t.probe);
    await realExec([TMUX!, "-S", t.socket, "kill-server"]);
    expect(await done).toBe(1);
    expect(t.lines.join("\n")).toContain("disappeared");
  });

  test("a stale server left on the socket is replaced", async () => {
    const t = setup();
    const first = runTmuxKeeper(t.opts(["sh", "-c", "echo old; sleep 30"], { signal: undefined }));
    await t.waitFor(async () => (await t.probe())?.tail.includes("old"));
    // Pretend the first keeper was SIGKILLed: its server survives. A second keeper takes over.
    const second = runTmuxKeeper(t.opts(["sh", "-c", "echo fresh; sleep 30"]));
    const p = await t.waitFor(async () => {
      const x = await t.probe();
      return x?.tail.includes("fresh") ? x : null;
    });
    expect(p.tail).not.toContain("old");
    t.ac.abort();
    await second;
    first.catch(() => {});
  });

  test("socket directory is private and a generated config is written beside it", async () => {
    const t = setup();
    const done = runTmuxKeeper(t.opts(["sleep", "30"]));
    await t.waitFor(t.probe);
    expect(statSync(join(t.dir, "t")).mode & 0o777).toBe(0o700);
    const conf = join(t.dir, "t", "x.conf");
    expect(existsSync(conf)).toBe(true);
    expect(readFileSync(conf, "utf8")).toContain("remain-on-exit on");
    t.ac.abort();
    await done;
  });

  test("a command that cannot start is an error, not a hang", async () => {
    const t = setup();
    const code = await runTmuxKeeper(t.opts(["/definitely/not/a/binary"]));
    expect(code).not.toBe(0);
  });

  test("an unusable tmux binary returns 127 with a clear message", async () => {
    const t = setup();
    const code = await runTmuxKeeper(t.opts(["sleep", "1"], { tmuxBin: "/no/such/tmux" }));
    expect(code).toBe(127);
    expect(t.lines.join("\n")).toContain("tmux");
  });
});
