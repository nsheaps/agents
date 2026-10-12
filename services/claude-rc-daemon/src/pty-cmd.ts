import { runInPty } from "@nsheaps/claude-rc-core";

/**
 * Command prefix a supervisor can use to re-invoke this daemon as `pty-run`.
 * Compiled binaries re-exec themselves; dev runs re-exec bun on this script.
 * `CLAUDE_RC_PTY=0` disables the wrapper.
 */
export function selfPtyPrefix(
  env: Record<string, string | undefined>,
  self: { execPath: string; main: string } = { execPath: process.execPath, main: Bun.main },
): string[] | undefined {
  if (env.CLAUDE_RC_PTY === "0") return undefined;
  const compiled = self.main.startsWith("/$bunfs") || self.main.startsWith("B:/~BUN");
  return compiled ? [self.execPath, "pty-run", "--"] : [self.execPath, self.main, "pty-run", "--"];
}

/** `claude-rc-daemon pty-run [--] <cmd> [args...]`: run cmd on a pseudo-terminal, mirror its output. */
export async function ptyRunMain(argv: string[]): Promise<number> {
  const i = argv.indexOf("--");
  const cmd = i >= 0 ? argv.slice(i + 1) : argv;
  if (cmd.length === 0) {
    console.error("usage: claude-rc-daemon pty-run -- <command> [args...]");
    return 2;
  }
  const ac = new AbortController();
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => ac.abort());
  return runInPty(cmd, {
    env: process.env,
    signal: ac.signal,
    onData: (s) => process.stdout.write(s),
  });
}
