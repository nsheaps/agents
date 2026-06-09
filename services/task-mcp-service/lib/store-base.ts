/**
 * lib/store-base.ts — generic flat-file YAML store + git-root resolution.
 *
 * Generic: contains no record-type-specific assumptions. Reusable by any
 * MCP server that stores records as flat YAML files in a git repo.
 *
 * To re-skin for a new server (e.g. ticket-mcp-service):
 *   - Parameterise the env-var name (e.g. TICKET_UTILS_TICKET_DIR)
 *   - Parameterise the store sub-path (e.g. .claude/tickets)
 *   - Provide a concrete record type for T
 *
 * Everything else (gitRepoRoot, resolveStoreRoot, StoreBase CRUD,
 * compareIds) carries over unchanged.
 */

import { execFileSync } from "node:child_process";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Resolve the directory of the CWD's git working tree, or null if not in one.
 *
 * @param fromDir directory to run `git rev-parse` from
 */
export function gitRepoRoot(fromDir: string): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fromDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the store root directory.
 *
 * Resolution order:
 *   1. `envVarName` env var (absolute path) — used verbatim.
 *   2. `<git-repo-root>/<storePath>` — repo root of `baseDir`.
 *   3. `<baseDir>/<storePath>` — fallback when not in a git repo.
 *
 * @param env         process environment (injected for testability)
 * @param baseDir     directory to resolve the git repo / fallback from
 * @param envVarName  name of the override env var (e.g. TASK_UTILS_TASK_DIR)
 * @param storePath   default sub-path under repo root (e.g. .claude/tasks)
 */
export function resolveStoreRoot(
  env: NodeJS.ProcessEnv,
  baseDir: string,
  envVarName: string,
  storePath: string,
): string {
  const override = env[envVarName];
  if (override && override.trim().length > 0) {
    return resolve(override.trim());
  }
  const repoRoot = gitRepoRoot(baseDir);
  if (repoRoot) {
    return join(repoRoot, storePath);
  }
  return join(resolve(baseDir), storePath);
}

/** Numeric-aware id comparison so "2" sorts before "10". */
export function compareIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isInteger(na) && Number.isInteger(nb)) {
    return na - nb;
  }
  return a.localeCompare(b);
}

/**
 * Generic flat-file YAML store bound to a resolved root directory.
 *
 * T must be an object with an `id: string` field.
 */
export class StoreBase<T extends { id: string }> {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private ensureDir(): void {
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  filePath(id: string): string {
    return join(this.root, `${id}.yaml`);
  }

  /** List all ids present in the store. */
  listIds(): string[] {
    if (!existsSync(this.root)) {
      return [];
    }
    return readdirSync(this.root)
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.slice(0, -5));
  }

  /** Read a single record, or null if it does not exist / is unparseable. */
  read(id: string): T | null {
    const path = this.filePath(id);
    if (!existsSync(path)) {
      return null;
    }
    try {
      return yamlParse(readFileSync(path, "utf8")) as T;
    } catch {
      return null;
    }
  }

  /** Read every record in the store (skips unparseable files). */
  readAll(): T[] {
    const records: T[] = [];
    for (const id of this.listIds()) {
      const r = this.read(id);
      if (r) {
        records.push(r);
      }
    }
    records.sort((a, b) => compareIds(a.id, b.id));
    return records;
  }

  /** Write (create or overwrite) a record file. Returns the file path. */
  write(record: T): string {
    this.ensureDir();
    const path = this.filePath(record.id);
    writeFileSync(path, yamlStringify(record), "utf8");
    return path;
  }

  /** Delete a record file. Returns the path that was removed (or would be). */
  remove(id: string): string {
    const path = this.filePath(id);
    if (existsSync(path)) {
      rmSync(path);
    }
    return path;
  }

  /**
   * Assign the next id. Mirrors the built-in Task tools' integer ids:
   * the smallest positive integer not already used. Non-numeric ids are
   * ignored for the max computation.
   */
  nextId(): string {
    let max = 0;
    for (const id of this.listIds()) {
      const n = Number(id);
      if (Number.isInteger(n) && n > max) {
        max = n;
      }
    }
    return String(max + 1);
  }
}
