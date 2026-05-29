/**
 * store.ts — task-file storage for the task-utils MCP server.
 *
 * Storage model (per the implementation corrections that override the original
 * per-session-directory plan):
 *
 *   - DEFAULT: tasks are stored FLAT in the CWD git repo at
 *     `<repo-root>/.claude/tasks/<task-id>.yaml`. No `<session_id>`
 *     subdirectory, no `-mcp` suffix dir. The repo root is resolved with
 *     `git rev-parse --show-toplevel`.
 *   - OVERRIDE: when `TASK_UTILS_TASK_DIR` is set and non-empty, that absolute
 *     path is the task-store root, used verbatim (still flat).
 *   - FALLBACK: if neither applies (not in a git repo, no override), the store
 *     root is `<cwd>/.claude/tasks`.
 *
 * The plugin hooks (`require-task-in-progress.sh`, `task-invariant.sh`) resolve
 * the same store root, so the server and hooks agree on where task files live.
 */

import { execFileSync } from "node:child_process";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type TaskStatus = "pending" | "in_progress" | "completed";

/** The on-disk task record. Superset of the four fields the hooks read. */
export interface TaskRecord {
  /** stable id — MUST equal the filename stem (`<id>.yaml`) */
  id: string;
  /** required by the hooks */
  subject: string;
  status: TaskStatus;
  /** may contain a <validation-steps> block */
  description: string;
  activeForm?: string;
  blocks: string[];
  blockedBy: string[];
  owner?: string;
  metadata: Record<string, unknown>;
  /** marks the file as MCP-managed */
  source: "task-utils-mcp";
  /** ISO-8601 UTC */
  createdAt: string;
  /** ISO-8601 UTC */
  updatedAt: string;
  /** optional — the Claude Code session id, kept for debugging only */
  session?: string;
}

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
 * Resolve the task-store root directory.
 *
 * Resolution order:
 *   1. `TASK_UTILS_TASK_DIR` env var (absolute path) — used verbatim.
 *   2. `<git-repo-root>/.claude/tasks` — repo root of `baseDir`.
 *   3. `<baseDir>/.claude/tasks` — fallback when not in a git repo.
 *
 * @param env  process environment (injected for testability)
 * @param baseDir directory to resolve the git repo / fallback from
 */
export function resolveStoreRoot(env: NodeJS.ProcessEnv, baseDir: string): string {
  const override = env.TASK_UTILS_TASK_DIR;
  if (override && override.trim().length > 0) {
    return resolve(override.trim());
  }
  const repoRoot = gitRepoRoot(baseDir);
  if (repoRoot) {
    return join(repoRoot, ".claude", "tasks");
  }
  return join(resolve(baseDir), ".claude", "tasks");
}

/** A task store bound to a resolved root directory. */
export class TaskStore {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /** Resolve a store from the environment + base directory. */
  static fromEnv(env: NodeJS.ProcessEnv, baseDir: string): TaskStore {
    return new TaskStore(resolveStoreRoot(env, baseDir));
  }

  private ensureDir(): void {
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  filePath(id: string): string {
    return join(this.root, `${id}.yaml`);
  }

  /** List all task ids present in the store. */
  listIds(): string[] {
    if (!existsSync(this.root)) {
      return [];
    }
    return readdirSync(this.root)
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.slice(0, -5));
  }

  /** Read a single task, or null if it does not exist / is unparseable. */
  read(id: string): TaskRecord | null {
    const path = this.filePath(id);
    if (!existsSync(path)) {
      return null;
    }
    try {
      return yamlParse(readFileSync(path, "utf8")) as TaskRecord;
    } catch {
      return null;
    }
  }

  /** Read every task in the store (skips unparseable files). */
  readAll(): TaskRecord[] {
    const tasks: TaskRecord[] = [];
    for (const id of this.listIds()) {
      const t = this.read(id);
      if (t) {
        tasks.push(t);
      }
    }
    // Stable numeric-aware ordering by id for deterministic output.
    tasks.sort((a, b) => compareIds(a.id, b.id));
    return tasks;
  }

  /** Write (create or overwrite) a task file. Returns the file path. */
  write(task: TaskRecord): string {
    this.ensureDir();
    const path = this.filePath(task.id);
    writeFileSync(path, yamlStringify(task), "utf8");
    return path;
  }

  /** Delete a task file. Returns the path that was removed (or would be). */
  remove(id: string): string {
    const path = this.filePath(id);
    if (existsSync(path)) {
      rmSync(path);
    }
    return path;
  }

  /**
   * Assign the next task id. Mirrors the built-in Task tools' integer ids:
   * the smallest positive integer not already used. If non-numeric ids exist
   * they are ignored for the max computation.
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

/** Numeric-aware id comparison so "2" sorts before "10". */
export function compareIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isInteger(na) && Number.isInteger(nb)) {
    return na - nb;
  }
  return a.localeCompare(b);
}
