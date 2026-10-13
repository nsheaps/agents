import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { parseConfig, type RepoConfig } from "./config";

function readRaw(path: string): Record<string, any> {
  if (!existsSync(path)) return { repos: [] };
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    if (typeof j !== "object" || j === null || Array.isArray(j)) throw new Error("not an object");
    return j;
  } catch (e) {
    throw new Error(`${path}: invalid JSON (${(e as Error).message}); fix it by hand first`);
  }
}

function write(path: string, data: unknown): void {
  const parsed = parseConfig(data);
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));
  mkdirSync(dirname(path), { recursive: true });
  // Keep a mode the user chose (e.g. 0600 for a file holding env secrets); new files start private.
  const mode = existsSync(path) ? statSync(path).mode & 0o777 : 0o600;
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode });
  chmodSync(tmp, mode); // writeFileSync's mode is masked by umask
  renameSync(tmp, path);
}

/** Add a repo, preserving every other key. Validates the whole result before writing. */
export function addRepo(path: string, repo: RepoConfig): void {
  const raw = readRaw(path);
  raw.repos = [...(Array.isArray(raw.repos) ? raw.repos : []), repo];
  write(path, raw);
}

export function removeRepo(path: string, name: string): void {
  if (!existsSync(path)) throw new Error(`no repos configured (${path} does not exist)`);
  const raw = readRaw(path);
  const repos: RepoConfig[] = Array.isArray(raw.repos) ? raw.repos : [];
  if (!repos.some((r) => r.name === name))
    throw new Error(
      `unknown repo "${name}" (configured: ${repos.map((r) => r.name).join(", ") || "none"})`,
    );
  raw.repos = repos.filter((r) => r.name !== name);
  write(path, raw);
}

const NESTED = ["notifications", "updates", "ui"] as const;
const SETTABLE = ["spawn", "env", "autoTrust", "terminal", ...NESTED];

/**
 * Change top-level settings (not repos). `notifications`, `updates` and `ui` are merged
 * key-by-key; `env` and scalars are replaced. Validates the whole result before writing.
 */
export function updateSettings(path: string, patch: Record<string, unknown>): void {
  const bad = Object.keys(patch).filter((k) => !SETTABLE.includes(k));
  if (bad.length)
    throw new Error(`cannot change ${bad.join(", ")} here (settable: ${SETTABLE.join(", ")})`);
  const raw = readRaw(path);
  for (const [k, v] of Object.entries(patch)) {
    const nested = (NESTED as readonly string[]).includes(k);
    const cur = raw[k];
    if (nested && v && typeof v === "object" && !Array.isArray(v)) {
      raw[k] = { ...(cur && typeof cur === "object" ? cur : {}), ...(v as object) };
    } else raw[k] = v;
  }
  if (!Array.isArray(raw.repos)) raw.repos = [];
  write(path, raw);
}
