import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

export const SPAWN_MODES = ["same-dir", "worktree", "session"] as const;
export type SpawnMode = (typeof SPAWN_MODES)[number];

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
}

export type ParseResult = { ok: true; config: RcConfig } | { ok: false; errors: string[] };
export type LoadResult =
  | { ok: true; config: RcConfig; missing: boolean }
  | { ok: false; errors: string[] };

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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
    : { ok: true, config: { repos, spawn, env, autoTrust } };
}

export function loadConfig(path: string): LoadResult {
  if (!existsSync(path))
    return {
      ok: true,
      missing: true,
      config: { repos: [], spawn: "worktree", env: {}, autoTrust: true },
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
