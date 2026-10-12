#!/usr/bin/env bun
import { mkdirSync, watch } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";
import { getPaths, pickSupervisor, realExec, serveIpc, VERSION } from "@nsheaps/claude-rc-core";
import { DAEMON_HELP, parseDaemonArgs } from "./args";
import { Daemon } from "./daemon";
import { runUpgrade } from "./upgrade";

const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);

async function main(): Promise<number> {
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
    upgrade: (bin) => runUpgrade(bin),
    log,
  });

  let stopping = false;
  let closeIpc: (() => Promise<void>) | undefined;
  const stop = async (why: string, code = 0) => {
    if (stopping) return;
    stopping = true;
    log(`shutting down (${why})`);
    try {
      await daemon.shutdown();
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
