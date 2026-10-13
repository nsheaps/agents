#!/usr/bin/env bun
import { mkdirSync, watch } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";
import {
  createNotifier,
  DEFAULT_UI_PORT,
  getPaths,
  loadConfig,
  parseClaudeVersion,
  pickSupervisor,
  realExec,
  serveIpc,
  VERSION,
} from "@nsheaps/claude-rc-core";
import { DAEMON_HELP, parseDaemonArgs } from "./args";
import { Daemon } from "./daemon";
import { ptyRunMain, selfPtyPrefix } from "./pty-cmd";
import { runUpgrade } from "./upgrade";
import { startWebUi, type WebUi } from "./web";

const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);

async function main(): Promise<number> {
  if (process.argv[2] === "pty-run") return ptyRunMain(process.argv.slice(3));
  const args = parseDaemonArgs(process.argv.slice(2), process.env);
  if (args.kind === "version") return (console.log(`claude-rc-daemon ${VERSION}`), 0);
  if (args.kind === "help") return (console.log(DAEMON_HELP), 0);
  if (args.kind === "error")
    return (console.error(`claude-rc-daemon: ${args.message}\n\n${DAEMON_HELP}`), 2);

  const home = process.env.HOME ?? homedir();
  const paths = getPaths(process.env, home);
  mkdirSync(paths.logDir, { recursive: true });
  mkdirSync(paths.runDir, { recursive: true });

  const picked = await pickSupervisor({
    prefer: args.supervisor,
    platform: process.platform,
    exec: realExec,
    uid: process.getuid?.() ?? 0,
    runDir: paths.runDir,
  });
  log(
    `claude-rc-daemon ${VERSION} starting (supervisor: ${picked.supervisor.kind} — ${picked.reason})`,
  );

  const daemon = new Daemon({
    env: process.env,
    home,
    paths,
    supervisor: picked.supervisor,
    supervisorReason: picked.reason,
    ptyPrefix: selfPtyPrefix(process.env),
    upgrade: (bin) => runUpgrade(bin),
    notifier: await createNotifier(process.platform, realExec),
    claudeVersion: async (bin) => parseClaudeVersion((await realExec([bin, "--version"])).stdout),
    log,
  });

  let stopping = false;
  let closeIpc: (() => Promise<void>) | undefined;
  let webUi: WebUi | undefined;
  const stop = async (why: string, code = 0) => {
    if (stopping) return;
    stopping = true;
    log(`shutting down (${why})`);
    try {
      await daemon.shutdown();
      await webUi?.stop();
      await closeIpc?.();
    } finally {
      process.exit(code);
    }
  };

  closeIpc = await serveIpc(paths.socketPath, async (req) => {
    if (req.cmd === "shutdown") {
      setTimeout(() => void stop("requested over IPC"), 50);
      return { ok: true };
    }
    return daemon.handle(req);
  });
  log(`listening on ${paths.socketPath}`);

  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on(
    "SIGHUP",
    () =>
      void daemon
        .handle({ cmd: "reload" })
        .then((r) => log(`reload (SIGHUP): ${r.ok ? "ok" : r.error}`)),
  );

  // Reload when rc.json changes (editors often replace the file, so watch the directory).
  let debounce: ReturnType<typeof setTimeout> | undefined;
  watch(paths.daemonDir, (_ev, file) => {
    if (file && basename(file.toString()) !== "rc.json") return;
    clearTimeout(debounce);
    debounce = setTimeout(
      () =>
        void daemon
          .handle({ cmd: "reload" })
          .then((r) => log(`reload (rc.json changed): ${r.ok ? "ok" : r.error}`)),
      500,
    );
  });

  await daemon.start();
  log("ready");

  const cfg = loadConfig(paths.configPath);
  try {
    webUi = await startWebUi({
      paths,
      port: cfg.ok ? cfg.config.ui.port : DEFAULT_UI_PORT,
      handle: (r) => daemon.handle(r),
      log,
    });
  } catch (e) {
    log(`web UI disabled: ${(e as Error).message}`); // non-fatal: services matter more
  }

  const pollMs = Number(process.env.CLAUDE_RC_POLL_MS) || 10_000;
  // Watch for starts/exits every 10s (CLAUDE_RC_POLL_MS overrides); check for updates at startup and then hourly (the check
  // itself is rate-limited to once a day via state.json).
  const guard = (what: string, p: Promise<unknown>) =>
    p.catch((e) => log(`${what} failed: ${(e as Error).message}`));
  setInterval(() => void guard("poll", daemon.pollOnce()), pollMs).unref();
  setInterval(() => void guard("update check", daemon.checkUpdates()), 60 * 60 * 1000).unref();
  void guard("poll", daemon.pollOnce());
  void guard("update check", daemon.checkUpdates());
  return -1; // keep running
}

main()
  .then((code) => {
    if (code >= 0) process.exit(code);
  })
  .catch((e) => {
    console.error(`claude-rc-daemon: fatal: ${(e as Error).message}`);
    process.exit(1);
  });
