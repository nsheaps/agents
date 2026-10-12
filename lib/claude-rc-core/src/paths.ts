import { join } from "node:path";

export interface RcPaths {
  daemonDir: string;
  configPath: string;
  claudeJson: string;
  logDir: string;
  runDir: string;
  socketPath: string;
  statePath: string;
}

const UNIX_SOCKET_MAX = 100; // sun_path is 104 on macOS, 108 on Linux; keep headroom

export function getPaths(env: Record<string, string | undefined>, home: string): RcPaths {
  const daemonDir = env.CLAUDE_RC_HOME ?? join(home, ".claude", "daemon");
  let socketPath = join(daemonDir, "rc.sock");
  if (socketPath.length >= UNIX_SOCKET_MAX) {
    const uid = typeof process.getuid === "function" ? process.getuid() : 0;
    socketPath = join(env.TMPDIR ?? "/tmp", `claude-rc-${uid}.sock`);
  }
  return {
    daemonDir,
    configPath: join(daemonDir, "rc.json"),
    claudeJson: join(env.CLAUDE_CONFIG_DIR ?? home, ".claude.json"),
    logDir: join(daemonDir, "logs"),
    runDir: join(daemonDir, "run"),
    socketPath,
    statePath: join(daemonDir, "state.json"),
  };
}
