import type { SupervisorKind } from "@nsheaps/claude-rc-core";

export type DaemonArgs =
  | { kind: "run"; supervisor: SupervisorKind | "auto" }
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "error"; message: string };

const SUPERVISORS = ["auto", "systemd", "launchd", "inproc"];

export const DAEMON_HELP = `claude-rc-daemon — keeps \`claude rc\` running for every repo in ~/.claude/daemon/rc.json

Usage: claude-rc-daemon [--supervisor auto|systemd|launchd|inproc]

Options:
  --supervisor <kind>  How per-repo services are supervised. Default: auto
                       (systemd --user on Linux, launchd on macOS, else in-process).
                       Env: CLAUDE_RC_SUPERVISOR
  -v, --version        Print version
  -h, --help           Print this help

Normally started by \`brew services start claude-rc\`. Control it with \`claude-rc\`.
`;

export function parseDaemonArgs(
  argv: string[],
  env: Record<string, string | undefined>,
): DaemonArgs {
  let supervisor = env.CLAUDE_RC_SUPERVISOR ?? "auto";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--version" || a === "-v") return { kind: "version" };
    if (a === "--help" || a === "-h") return { kind: "help" };
    if (a === "--supervisor" || a.startsWith("--supervisor=")) {
      const v = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i];
      if (!v) return { kind: "error", message: "--supervisor needs a value" };
      supervisor = v;
      continue;
    }
    return { kind: "error", message: `unknown argument: ${a}` };
  }
  if (!SUPERVISORS.includes(supervisor))
    return {
      kind: "error",
      message: `invalid supervisor "${supervisor}" (expected ${SUPERVISORS.join(", ")})`,
    };
  return { kind: "run", supervisor: supervisor as SupervisorKind | "auto" };
}
