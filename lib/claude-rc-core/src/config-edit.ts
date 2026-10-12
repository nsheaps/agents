import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
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
