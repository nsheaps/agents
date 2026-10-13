import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  watchFile,
  unwatchFile,
  realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  addRepo,
  getPaths,
  ensureTrusted,
  ipcRequest,
  loadConfig,
  pickSupervisor,
  realExec,
  removeRepo,
  resolveClaude,
  trustKeyFor,
  VERSION,
  type IpcRequest,
  type IpcResponse,
  type RcPaths,
} from "@nsheaps/claude-rc-core";
import type { Command } from "./args";
import { formatStatus, type StatusData } from "./format";

export const EXIT = { ok: 0, error: 1, usage: 2, notRunning: 3 } as const;

export interface Ctx {
  env: Record<string, string | undefined>;
  home: string;
  paths: RcPaths;
  color: boolean;
  out: (s: string) => void;
  err: (s: string) => void;
}

export function makeCtx(
  env: Record<string, string | undefined>,
  out: (s: string) => void,
  err: (s: string) => void,
  color: boolean,
): Ctx {
  const home = env.HOME ?? homedir();
  return { env, home, paths: getPaths(env, home), color, out, err };
}

export const HELP = `claude-rc — manage the claude-rc daemon (keeps \`claude rc\` running for your repos)

Usage: claude-rc <command> [options]

Repos:
  add <path> [--name <n>] [--spawn same-dir|worktree|session]   Add a repo to ~/.claude/daemon/rc.json
  remove <name>                                                 Remove a repo (alias: rm)
  list [--json]                                                 List configured repos (alias: ls)
  trust [name]                                                  Pre-accept Claude's workspace-trust dialog

Daemon:
  status [--json]        Show daemon and per-repo state (exit 3 if the daemon is not running)
  start|stop|restart [name]   Control one repo's \`claude rc\` (restart without a name restarts all)
  reload                 Re-read rc.json now (the daemon also watches it)
  ui [--print]           Open the settings/monitor page in your browser (--print: just show the URL)
  logs <name> [-n N] [-f]  Show a repo's \`claude rc\` log
  shutdown               Stop the daemon and its repos

Other:
  config [path|show|validate]
  doctor                 Check claude, config, trust, and the service manager
  -v, --version, -h, --help

Start the daemon with: brew services start claude-rc
Docs: ~/.claude/daemon/rc.json = { "repos": [{ "name": "...", "path": "/abs/path" }], "spawn": "worktree", "env": { "KEY": "value" } }
`;

const NOT_RUNNING =
  "claude-rc daemon is not running. Start it with: brew services start claude-rc   (or run claude-rc-daemon)";

async function call(
  ctx: Ctx,
  req: IpcRequest,
  timeoutMs?: number,
): Promise<IpcResponse | undefined> {
  try {
    return await ipcRequest(ctx.paths.socketPath, req, timeoutMs);
  } catch (e) {
    if ((e as Error).message.includes("not running")) return undefined;
    throw e;
  }
}

async function daemonUp(ctx: Ctx): Promise<boolean> {
  return (await call(ctx, { cmd: "ping" }, 3000))?.ok === true;
}

async function fetchStatus(ctx: Ctx): Promise<StatusData | undefined> {
  const r = await call(ctx, { cmd: "status" });
  if (!r) return undefined;
  if (!r.ok) throw new Error(r.error);
  return r.data as StatusData;
}

function lastLines(path: string, n: number): string {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-n).join("\n");
}

export async function run(cmd: Command, ctx: Ctx): Promise<number> {
  switch (cmd.cmd) {
    case "help":
      ctx.out(HELP);
      return EXIT.ok;
    case "version":
      ctx.out(`claude-rc ${VERSION}`);
      return EXIT.ok;
    case "error":
      ctx.err(`claude-rc: ${cmd.message}\nRun \`claude-rc --help\` for usage.`);
      return EXIT.usage;

    case "status": {
      const st = await fetchStatus(ctx);
      if (!st) {
        ctx.err(NOT_RUNNING);
        return EXIT.notRunning;
      }
      ctx.out(cmd.json ? JSON.stringify(st, null, 2) : formatStatus(st, ctx.color));
      return EXIT.ok;
    }

    case "list": {
      const loaded = loadConfig(ctx.paths.configPath);
      if (!loaded.ok) {
        ctx.err(loaded.errors.join("\n"));
        return EXIT.error;
      }
      const { repos, spawn } = loaded.config;
      if (cmd.json)
        ctx.out(
          JSON.stringify(
            repos.map((r) => ({ ...r, spawn: r.spawn ?? spawn })),
            null,
            2,
          ),
        );
      else if (repos.length === 0)
        ctx.out("no repos configured — add one with: claude-rc add <path>");
      else for (const r of repos) ctx.out(`${r.name}\t${r.spawn ?? spawn}\t${r.path}`);
      return EXIT.ok;
    }

    case "add": {
      const abs = resolve(cmd.path);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) {
        ctx.err(`claude-rc: ${abs} is not a directory`);
        return EXIT.error;
      }
      const real = realpathSync(abs);
      if (real === realpathSync(ctx.home)) {
        ctx.err(
          "claude-rc: refusing to add your home directory (Claude Code never saves workspace trust there)",
        );
        return EXIT.error;
      }
      const loaded = loadConfig(ctx.paths.configPath);
      const spawn = cmd.spawn ?? (loaded.ok ? loaded.config.spawn : "worktree");
      const isRepo =
        Bun.spawnSync(["git", "rev-parse", "--git-dir"], {
          cwd: real,
          stdout: "ignore",
          stderr: "ignore",
        }).exitCode === 0;
      if (spawn === "worktree" && !isRepo) {
        ctx.err(
          `claude-rc: ${real} is not a git repository, and --spawn worktree needs one (or a WorktreeCreate hook).\nUse --spawn same-dir, or run \`git init\` first.`,
        );
        return EXIT.error;
      }
      addRepo(ctx.paths.configPath, {
        name: cmd.name,
        path: real,
        ...(cmd.spawn ? { spawn: cmd.spawn } : {}),
      });
      ctx.out(`added ${cmd.name} (${real}, spawn: ${spawn})`);
      return afterEdit(ctx);
    }

    case "remove":
      removeRepo(ctx.paths.configPath, cmd.name);
      ctx.out(`removed ${cmd.name}`);
      return afterEdit(ctx);

    case "reload": {
      const r = await call(ctx, { cmd: "reload" });
      if (!r) return (ctx.err(NOT_RUNNING), EXIT.notRunning);
      if (!r.ok) return (ctx.err(`claude-rc: reload failed: ${r.error}`), EXIT.error);
      ctx.out("reloaded");
      return EXIT.ok;
    }

    case "start":
    case "stop":
    case "restart": {
      const r = await call(ctx, { cmd: cmd.cmd, name: cmd.name });
      if (!r) return (ctx.err(NOT_RUNNING), EXIT.notRunning);
      if (!r.ok) return (ctx.err(`claude-rc: ${r.error}`), EXIT.error);
      const past = { start: "started", stop: "stopped", restart: "restarted" } as const;
      ctx.out(`${past[cmd.cmd]} ${cmd.name ?? "all repos"}`);
      return EXIT.ok;
    }

    case "shutdown": {
      const r = await call(ctx, { cmd: "shutdown" });
      if (!r) return (ctx.err(NOT_RUNNING), EXIT.notRunning);
      ctx.out("daemon shutting down");
      return EXIT.ok;
    }

    case "trust": {
      const loaded = loadConfig(ctx.paths.configPath);
      if (!loaded.ok) return (ctx.err(loaded.errors.join("\n")), EXIT.error);
      const repos = cmd.name
        ? loaded.config.repos.filter((r) => r.name === cmd.name)
        : loaded.config.repos;
      if (cmd.name && repos.length === 0)
        return (ctx.err(`claude-rc: unknown repo "${cmd.name}"`), EXIT.error);
      let failed = false;
      for (const r of repos) {
        try {
          const key = trustKeyFor(r.path);
          ctx.out(
            `${r.name}: ${ensureTrusted(ctx.paths.claudeJson, key) === "added" ? "trusted" : "already trusted"} (${key})`,
          );
        } catch (e) {
          failed = true;
          ctx.err(`${r.name}: ${(e as Error).message}`);
        }
      }
      return failed ? EXIT.error : EXIT.ok;
    }

    case "logs": {
      const file = `${ctx.paths.logDir}/${cmd.name}.log`;
      if (!existsSync(file)) {
        ctx.err(`claude-rc: no log for "${cmd.name}" yet (${file})`);
        return EXIT.error;
      }
      const tail = lastLines(file, cmd.lines);
      if (tail) ctx.out(tail);
      if (!cmd.follow) return EXIT.ok;
      let pos = statSync(file).size;
      await new Promise<void>((done) => {
        watchFile(file, { interval: 250 }, (cur) => {
          if (cur.size < pos) pos = 0; // truncated/rotated
          if (cur.size === pos) return;
          const fd = openSync(file, "r");
          const buf = Buffer.alloc(cur.size - pos);
          readSync(fd, buf, 0, buf.length, pos);
          closeSync(fd);
          pos = cur.size;
          process.stdout.write(buf);
        });
        process.once("SIGINT", () => (unwatchFile(file), done()));
      });
      return EXIT.ok;
    }

    case "config": {
      if (cmd.sub === "path") return (ctx.out(ctx.paths.configPath), EXIT.ok);
      const loaded = loadConfig(ctx.paths.configPath);
      if (!loaded.ok) return (ctx.err(loaded.errors.join("\n")), EXIT.error);
      if (cmd.sub === "validate") {
        ctx.out(
          loaded.missing
            ? `${ctx.paths.configPath} does not exist yet (that is valid: no repos)`
            : `${ctx.paths.configPath} is valid (${loaded.config.repos.length} repo(s))`,
        );
        return EXIT.ok;
      }
      ctx.out(
        loaded.missing ? "(no config yet)" : readFileSync(ctx.paths.configPath, "utf8").trimEnd(),
      );
      return EXIT.ok;
    }

    case "ui": {
      if (!(await daemonUp(ctx))) return (ctx.err(NOT_RUNNING), EXIT.notRunning);
      let rec: { url?: string; token?: string };
      try {
        rec = JSON.parse(readFileSync(ctx.paths.uiPath, "utf8"));
      } catch {
        ctx.err(
          `claude-rc: the daemon's web UI is not available (${ctx.paths.uiPath} missing); see its log for "web UI disabled"`,
        );
        return EXIT.error;
      }
      const link = `${rec.url}/?token=${rec.token}`;
      if (cmd.print) return (ctx.out(link), EXIT.ok);
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      const r = Bun.spawnSync([opener, link], { stdout: "ignore", stderr: "ignore" });
      if (r.exitCode !== 0) {
        ctx.err(`claude-rc: could not run ${opener}; open this link yourself:`);
        ctx.out(link);
      } else ctx.out(`opened ${rec.url} in your browser`);
      return EXIT.ok;
    }

    case "doctor":
      return doctor(ctx);
  }
}

/** After editing rc.json, tell a running daemon to reload so the user gets an immediate, checked result. */
async function afterEdit(ctx: Ctx): Promise<number> {
  if (!(await daemonUp(ctx))) {
    ctx.out("(daemon is not running; changes apply when it starts: brew services start claude-rc)");
    return EXIT.ok;
  }
  const r = await call(ctx, { cmd: "reload" });
  if (r && !r.ok) {
    ctx.err(`claude-rc: daemon could not apply the change: ${r.error}`);
    return EXIT.error;
  }
  return EXIT.ok;
}

async function doctor(ctx: Ctx): Promise<number> {
  let bad = 0;
  const ok = (m: string) => ctx.out(`${ctx.color ? "\x1b[32m✓\x1b[0m" : "✓"} ${m}`);
  const no = (m: string, hint?: string) => {
    bad++;
    ctx.out(`${ctx.color ? "\x1b[31m✗\x1b[0m" : "✗"} ${m}${hint ? `\n    ${hint}` : ""}`);
  };

  const claude = resolveClaude(ctx.env, ctx.home);
  if (claude) {
    const v = Bun.spawnSync([claude, "--version"], { stdout: "pipe", stderr: "pipe" });
    ok(`claude found: ${claude}${v.exitCode === 0 ? ` (${v.stdout.toString().trim()})` : ""}`);
  } else
    no(
      "claude not found",
      "Install Claude Code (https://claude.ai/install) or set CLAUDE_RC_CLAUDE_BIN",
    );

  const loaded = loadConfig(ctx.paths.configPath);
  if (!loaded.ok) no("config invalid", loaded.errors.join("; "));
  else {
    ok(
      loaded.missing
        ? `config: none yet (${ctx.paths.configPath})`
        : `config valid: ${loaded.config.repos.length} repo(s)`,
    );
    let claudeJson: any = {};
    try {
      claudeJson = JSON.parse(readFileSync(ctx.paths.claudeJson, "utf8"));
    } catch {}
    for (const r of loaded.config.repos) {
      if (!existsSync(r.path)) {
        no(`${r.name}: path missing ${r.path}`);
        continue;
      }
      let trusted = false;
      try {
        trusted = claudeJson.projects?.[trustKeyFor(r.path)]?.hasTrustDialogAccepted === true;
      } catch {}
      if (trusted) ok(`${r.name}: workspace trusted`);
      else if (loaded.config.autoTrust)
        ok(
          `${r.name}: not yet trusted (daemon will trust it on start; or run: claude-rc trust ${r.name})`,
        );
      else
        no(
          `${r.name}: workspace not trusted and autoTrust is off`,
          `run: claude-rc trust ${r.name}`,
        );
    }
  }

  const picked = await pickSupervisor({
    platform: process.platform,
    exec: realExec,
    uid: process.getuid?.() ?? 0,
    runDir: ctx.paths.runDir,
  }).catch((e) => ({ supervisor: undefined, reason: (e as Error).message }));
  if (picked.supervisor?.kind === "inproc") ok(`service manager: none native — ${picked.reason}`);
  else if (picked.supervisor) ok(`service manager: ${picked.supervisor.kind}`);
  else no("service manager unavailable", picked.reason);

  if (process.platform === "darwin") ok("desktop notifications: osascript");
  else if (Bun.which("notify-send")) ok("desktop notifications: notify-send");
  else
    ctx.out(
      `${ctx.color ? "\x1b[33m!\x1b[0m" : "!"} notify-send not found, so desktop notifications are off\n    install libnotify (Debian/Ubuntu: apt install libnotify-bin; Fedora: dnf install libnotify)`,
    );

  const st = await fetchStatus(ctx).catch(() => undefined);
  if (st) ok(`daemon running (pid ${st.pid}, ${st.version}, supervisor ${st.supervisor.kind})`);
  else no("daemon not running", "brew services start claude-rc");
  if (st?.configError) no(`daemon reports config error: ${st.configError}`);
  if (st?.upgrade && !st.upgrade.ok) no(`last claude upgrade failed: ${st.upgrade.output}`);
  for (const r of st?.repos ?? [])
    if (r.state !== "running" && !r.stoppedByUser)
      no(`${r.name}: ${r.state}${r.error ? ` — ${r.error}` : ""}`);

  return bad ? EXIT.error : EXIT.ok;
}
