import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

export const SPAWN_MODES = ["same-dir", "worktree", "session"] as const;
export type SpawnMode = (typeof SPAWN_MODES)[number];

/** How `claude rc` gets a terminal: tmux (attachable), a bare pty, or tmux when installed. */
export const TERMINAL_MODES = ["auto", "tmux", "pty"] as const;
export type TerminalMode = (typeof TERMINAL_MODES)[number];

export interface RepoConfig {
  name: string;
  path: string;
  spawn?: SpawnMode;
  env?: Record<string, string>;
}

export interface RcConfig {
  repos: RepoConfig[];
  spawn: SpawnMode;
  env: Record<string, string>;
  /** Pre-accept the workspace trust dialog for each repo in ~/.claude.json. */
  autoTrust: boolean;
  /** Desktop notifications when a service starts/exits. */
  notifications: { enabled: boolean; onStart: boolean; onExit: boolean; allUsers: boolean };
  /** Daily update checks (one switch per thing checked), auto-upgrade at startup, idle threshold. */
  updates: { claudeRc: boolean; claude: boolean; autoUpgrade: boolean; idleSeconds: number };
  /** Local settings page served by the daemon; port 0 = pick a free one. */
  ui: { port: number; terminal: boolean };
  terminal: TerminalMode;
}

export const DEFAULT_IDLE_SECONDS = 120;

export const DEFAULT_UI_PORT = 47474;

export type ParseResult = { ok: true; config: RcConfig } | { ok: false; errors: string[] };
export type LoadResult =
  | { ok: true; config: RcConfig; missing: boolean }
  | { ok: false; errors: string[] };

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A valid repo name from a directory path ("My Project" -> "My-Project"). */
export function deriveRepoName(path: string): string {
  const base = (path.replace(/\/+$/, "").split("/").pop() ?? "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "");
  return base || "repo";
}

function checkEnv(v: unknown, where: string, errors: string[]): Record<string, string> {
  if (v === undefined) return {};
  if (!isObject(v)) {
    errors.push(`${where}: env must be an object of string values`);
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!ENV_KEY_RE.test(k)) errors.push(`${where}: env key "${k}" is not a valid variable name`);
    else if (typeof val !== "string")
      errors.push(`${where}: env value for "${k}" must be a string`);
    else if (/[\x00-\x08\x0A-\x1F\x7F]/.test(val))
      errors.push(`${where}: env value for "${k}" contains a control character`);
    else out[k] = val;
  }
  return out;
}

function checkSpawn(v: unknown, where: string, errors: string[]): SpawnMode | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string" && (SPAWN_MODES as readonly string[]).includes(v))
    return v as SpawnMode;
  errors.push(
    `${where}: spawn must be one of ${SPAWN_MODES.join(", ")} (got ${JSON.stringify(v)})`,
  );
  return undefined;
}

function checkBools<K extends string>(
  v: unknown,
  where: string,
  keys: readonly K[],
  errors: string[],
): Record<K, boolean> {
  const out = Object.fromEntries(keys.map((k) => [k, true])) as Record<K, boolean>;
  if (v === undefined) return out;
  if (!isObject(v)) {
    errors.push(`config: ${where} must be an object`);
    return out;
  }
  for (const k of keys) {
    if (v[k] === undefined) continue;
    if (typeof v[k] === "boolean") out[k] = v[k] as boolean;
    else errors.push(`config: ${where}.${k} must be a boolean`);
  }
  return out;
}

export function parseConfig(input: unknown): ParseResult {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["config must be a JSON object"] };

  const spawn = checkSpawn(input.spawn, "config", errors) ?? "worktree";
  const env = checkEnv(input.env, "config", errors);

  let autoTrust = true;
  if (input.autoTrust !== undefined) {
    if (typeof input.autoTrust === "boolean") autoTrust = input.autoTrust;
    else errors.push("config: autoTrust must be a boolean");
  }

  const notifications = checkBools(
    input.notifications,
    "notifications",
    ["enabled", "onStart", "onExit", "allUsers"] as const,
    errors,
  );
  const updateFlags = checkBools(
    input.updates,
    "updates",
    ["claudeRc", "claude", "autoUpgrade"] as const,
    errors,
  );
  let idleSeconds = DEFAULT_IDLE_SECONDS;
  if (isObject(input.updates) && input.updates.idleSeconds !== undefined) {
    const n = input.updates.idleSeconds;
    if (typeof n === "number" && Number.isInteger(n) && n >= 0) idleSeconds = n;
    else errors.push("config: updates.idleSeconds must be a non-negative integer");
  }
  const updates = { ...updateFlags, idleSeconds };
  let port = DEFAULT_UI_PORT;
  let uiTerminal = true;
  if (input.ui !== undefined) {
    if (!isObject(input.ui)) errors.push("config: ui must be an object");
    else {
      if (input.ui.port !== undefined) {
        const p = input.ui.port;
        if (typeof p === "number" && Number.isInteger(p) && p >= 0 && p <= 65535) port = p;
        else errors.push("config: ui.port must be an integer 0-65535");
      }
      if (input.ui.terminal !== undefined) {
        if (typeof input.ui.terminal === "boolean") uiTerminal = input.ui.terminal;
        else errors.push("config: ui.terminal must be a boolean");
      }
    }
  }
  let terminal: TerminalMode = "auto";
  if (input.terminal !== undefined) {
    if (
      typeof input.terminal === "string" &&
      (TERMINAL_MODES as readonly string[]).includes(input.terminal)
    )
      terminal = input.terminal as TerminalMode;
    else
      errors.push(
        `config: terminal must be one of ${TERMINAL_MODES.join(", ")} (got ${JSON.stringify(input.terminal)})`,
      );
  }

  const repos: RepoConfig[] = [];
  if (!Array.isArray(input.repos)) {
    errors.push("config: repos must be an array of { name, path }");
  } else {
    const seen = new Set<string>();
    input.repos.forEach((r, i) => {
      const where = `repos[${i}]`;
      if (!isObject(r)) {
        errors.push(`${where}: must be an object`);
        return;
      }
      const { name, path } = r;
      if (typeof name !== "string" || !NAME_RE.test(name)) {
        errors.push(`${where}: name must match ${NAME_RE} (got ${JSON.stringify(name)})`);
      } else if (seen.has(name)) {
        errors.push(`${where}: duplicate repo name "${name}"`);
      } else {
        seen.add(name);
      }
      if (typeof path !== "string" || !isAbsolute(path)) {
        errors.push(`${where}: path must be an absolute path (got ${JSON.stringify(path)})`);
      }
      const rs = checkSpawn(r.spawn, where, errors);
      const renv = r.env === undefined ? undefined : checkEnv(r.env, where, errors);
      if (typeof name === "string" && typeof path === "string") {
        repos.push({ name, path, ...(rs ? { spawn: rs } : {}), ...(renv ? { env: renv } : {}) });
      }
    });
  }

  return errors.length
    ? { ok: false, errors }
    : {
        ok: true,
        config: {
          repos,
          spawn,
          env,
          autoTrust,
          notifications,
          updates,
          ui: { port, terminal: uiTerminal },
          terminal,
        },
      };
}

export function loadConfig(path: string): LoadResult {
  if (!existsSync(path))
    return {
      ok: true,
      missing: true,
      config: {
        repos: [],
        spawn: "worktree",
        env: {},
        autoTrust: true,
        notifications: { enabled: true, onStart: true, onExit: true, allUsers: true },
        updates: {
          claudeRc: true,
          claude: true,
          autoUpgrade: true,
          idleSeconds: DEFAULT_IDLE_SECONDS,
        },
        ui: { port: DEFAULT_UI_PORT, terminal: true },
        terminal: "auto",
      },
    };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { ok: false, errors: [`${path}: invalid JSON (${(e as Error).message})`] };
  }
  const r = parseConfig(raw);
  return r.ok
    ? { ok: true, config: r.config, missing: false }
    : { ok: false, errors: r.errors.map((m) => `${path}: ${m}`) };
}
