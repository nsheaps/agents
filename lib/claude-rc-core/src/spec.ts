import { accessSync, constants, statSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import type { RepoConfig, RcConfig } from "./config";
import type { RcPaths } from "./paths";
import type { ServiceSpec } from "./supervisor-types";

/** Base env forwarded to children; everything else in the daemon's env stays out of unit files. */
const ENV_ALLOW = [
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_STATE_HOME",
  "CLAUDE_CONFIG_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS",
];

export function extraBinDirs(home: string): string[] {
  return [
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    join(home, ".npm-global", "bin"),
    join(home, ".bun", "bin"),
    "/opt/homebrew/bin",
    "/home/linuxbrew/.linuxbrew/bin",
    "/usr/local/bin",
  ];
}

const isExec = (f: string) => {
  try {
    if (!statSync(f).isFile()) return false;
    accessSync(f, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export function resolveClaude(
  env: Record<string, string | undefined>,
  home: string,
): string | undefined {
  if (env.CLAUDE_RC_CLAUDE_BIN && isExec(env.CLAUDE_RC_CLAUDE_BIN)) return env.CLAUDE_RC_CLAUDE_BIN;
  const dirs = [...(env.PATH ?? "").split(delimiter).filter(Boolean), ...extraBinDirs(home)];
  for (const d of dirs) {
    const f = join(d, "claude");
    if (isExec(f)) return f;
  }
  return undefined;
}

export interface BuildCtx {
  claudeBin: string;
  baseEnv: Record<string, string | undefined>;
  paths: Pick<RcPaths, "logDir">;
}

export function buildSpec(
  repo: RepoConfig,
  cfg: Pick<RcConfig, "spawn" | "env">,
  ctx: BuildCtx,
): ServiceSpec {
  const env: Record<string, string> = {};
  for (const k of ENV_ALLOW) if (ctx.baseEnv[k] !== undefined) env[k] = ctx.baseEnv[k]!;
  const home = ctx.baseEnv.HOME ?? "";
  const pathDirs = (ctx.baseEnv.PATH ?? "/usr/bin:/bin").split(delimiter).filter(Boolean);
  for (const d of [dirname(ctx.claudeBin), ...extraBinDirs(home)])
    if (!pathDirs.includes(d)) pathDirs.push(d);
  env.PATH = pathDirs.join(delimiter);
  Object.assign(env, cfg.env, repo.env);
  return {
    name: repo.name,
    cwd: repo.path,
    argv: [ctx.claudeBin, "rc", "--spawn", repo.spawn ?? cfg.spawn, "--verbose"],
    env,
    logFile: join(ctx.paths.logDir, `${repo.name}.log`),
  };
}

export function specHash(s: ServiceSpec): string {
  const env = Object.fromEntries(Object.entries(s.env).sort(([a], [b]) => (a < b ? -1 : 1)));
  const h = new Bun.CryptoHasher("sha256");
  h.update(JSON.stringify({ name: s.name, cwd: s.cwd, argv: s.argv, env, logFile: s.logFile }));
  return h.digest("hex");
}
