import { runTmuxKeeper } from "@nsheaps/claude-rc-core";

/** Base command that re-invokes this program (compiled binary, or bun on the entry script). */
export function selfCommand(
  self: { execPath: string; main: string } = { execPath: process.execPath, main: Bun.main },
): string[] {
  const compiled = self.main.startsWith("/$bunfs") || self.main.startsWith("B:/~BUN");
  return compiled ? [self.execPath] : [self.execPath, self.main];
}

export type TmuxRunArgs =
  | { tmux: string; socket: string; name: string; log?: string; cmd: string[] }
  | { error: string };

/** `--tmux BIN --socket PATH --name NAME [--log FILE] -- cmd args...` */
export function parseTmuxRunArgs(argv: string[]): TmuxRunArgs {
  const sep = argv.indexOf("--");
  const flags = sep >= 0 ? argv.slice(0, sep) : argv;
  const cmd = sep >= 0 ? argv.slice(sep + 1) : [];
  const v: Record<string, string> = {};
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i]!;
    if (f !== "--tmux" && f !== "--socket" && f !== "--name" && f !== "--log")
      return { error: `unknown argument ${f}` };
    const val = flags[++i];
    if (!val) return { error: `${f} needs a value` };
    v[f.slice(2)] = val;
  }
  for (const k of ["tmux", "socket", "name"]) if (!v[k]) return { error: `missing --${k}` };
  if (cmd.length === 0) return { error: "missing command after --" };
  return { tmux: v.tmux!, socket: v.socket!, name: v.name!, ...(v.log ? { log: v.log } : {}), cmd };
}

/** `claude-rc-daemon tmux-run ... -- <cmd>`: the foreground keeper a supervisor tracks for one repo. */
export async function tmuxRunMain(argv: string[]): Promise<number> {
  const a = parseTmuxRunArgs(argv);
  if ("error" in a) {
    console.error(
      `tmux-run: ${a.error}\nusage: claude-rc-daemon tmux-run --tmux BIN --socket PATH --name NAME -- <command> [args...]`,
    );
    return 2;
  }
  const ac = new AbortController();
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(sig, () => ac.abort());
  return runTmuxKeeper({
    tmuxBin: a.tmux,
    socket: a.socket,
    name: a.name,
    cwd: process.cwd(),
    ...(a.log ? { logFile: a.log } : {}),
    argv: a.cmd,
    env: process.env,
    signal: ac.signal,
    log: (l) => console.log(l),
  });
}
