import { basename } from "node:path";
import { SPAWN_MODES, type SpawnMode } from "@nsheaps/claude-rc-core";

export type Command =
  | { cmd: "help" }
  | { cmd: "version" }
  | { cmd: "error"; message: string }
  | { cmd: "status"; json: boolean }
  | { cmd: "list"; json: boolean }
  | { cmd: "add"; path: string; name: string; spawn?: SpawnMode }
  | { cmd: "remove"; name: string }
  | { cmd: "restart"; name?: string }
  | { cmd: "start"; name: string }
  | { cmd: "stop"; name: string }
  | { cmd: "reload" }
  | { cmd: "trust"; name?: string }
  | { cmd: "logs"; name: string; lines: number; follow: boolean }
  | { cmd: "config"; sub: "path" | "show" | "validate" }
  | { cmd: "doctor" }
  | { cmd: "shutdown" };

const err = (message: string): Command => ({ cmd: "error", message });

export function parseArgs(argv: string[]): Command {
  const [first, ...rest] = argv;
  if (!first || first === "-h" || first === "--help" || first === "help") return { cmd: "help" };
  if (first === "-v" || first === "--version" || first === "version") return { cmd: "version" };

  const flags = new Map<string, string | true>();
  const pos: string[] = [];
  const valueFlags = new Set(["--name", "--spawn", "-n"]);
  const boolFlags = new Set(["--json", "-f", "--follow"]);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (valueFlags.has(a)) {
      const v = rest[++i];
      if (v === undefined) return err(`${a} needs a value`);
      flags.set(a, v);
    } else if (boolFlags.has(a)) flags.set(a, true);
    else if (a.startsWith("-")) return err(`unknown flag: ${a}`);
    else pos.push(a);
  }
  const need = (usage: string) => err(`usage: claude-rc ${usage}`);

  switch (first) {
    case "status":
      return { cmd: "status", json: flags.has("--json") };
    case "list":
    case "ls":
      return { cmd: "list", json: flags.has("--json") };
    case "add": {
      if (!pos[0]) return need("add <path> [--name <name>] [--spawn same-dir|worktree|session]");
      const spawn = flags.get("--spawn");
      if (spawn !== undefined && !(SPAWN_MODES as readonly string[]).includes(spawn as string))
        return err(`--spawn must be one of ${SPAWN_MODES.join(", ")}`);
      return {
        cmd: "add",
        path: pos[0],
        name: (flags.get("--name") as string | undefined) ?? basename(pos[0]),
        ...(spawn ? { spawn: spawn as SpawnMode } : {}),
      };
    }
    case "remove":
    case "rm":
      return pos[0] ? { cmd: "remove", name: pos[0] } : need("remove <name>");
    case "restart":
      return { cmd: "restart", name: pos[0] };
    case "start":
    case "stop":
      return pos[0] ? { cmd: first, name: pos[0] } : need(`${first} <name>`);
    case "reload":
    case "doctor":
    case "shutdown":
      return { cmd: first };
    case "trust":
      return { cmd: "trust", name: pos[0] };
    case "logs": {
      if (!pos[0]) return need("logs <name> [-n <lines>] [-f]");
      const n = flags.get("-n");
      const lines = n === undefined ? 50 : Number(n);
      if (!Number.isInteger(lines) || lines < 0) return err("-n must be a non-negative integer");
      return { cmd: "logs", name: pos[0], lines, follow: flags.has("-f") || flags.has("--follow") };
    }
    case "config": {
      const sub = pos[0] ?? "show";
      return sub === "path" || sub === "show" || sub === "validate"
        ? { cmd: "config", sub }
        : err(`unknown config subcommand "${sub}" (path, show, validate)`);
    }
    default:
      return err(`unknown command: ${first}`);
  }
}
