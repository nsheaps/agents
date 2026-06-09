/**
 * src/store.ts — task-specific store for the task-mcp MCP server.
 *
 * Task-specific: defines TaskRecord, TaskStatus, the env-var name
 * (TASK_UTILS_TASK_DIR), the store sub-path (.claude/tasks), and the
 * task-flavoured git commit-message builder.
 *
 * The generic store engine lives in ../lib/store-base.ts. To build a
 * ticket-mcp-service, provide a TicketRecord type, a different env-var name,
 * and a different store sub-path — the rest is inherited from StoreBase.
 *
 * Storage model:
 *   - DEFAULT: tasks stored FLAT at `<git-repo-root>/.claude/tasks/<id>.yaml`.
 *     Repo root resolved via `git rev-parse --show-toplevel` from cwd.
 *   - OVERRIDE: when `TASK_UTILS_TASK_DIR` is set, that absolute path is used
 *     verbatim.
 *   - FALLBACK: `<cwd>/.claude/tasks` when not in a git repo.
 *
 * The plugin hooks (`require-task-in-progress.sh`, `task-invariant.sh`)
 * resolve the same store root, so the server and hooks agree.
 */

import { StoreBase, resolveStoreRoot as resolveStoreRootBase, compareIds } from "../lib/store-base.js";
export { compareIds };
import { CrudOperation, tryGitAutoCommit } from "../lib/git-helper.js";
import type { GitAutoCommitResult } from "../lib/git-helper.js";

export type { GitAutoCommitResult };
export type { CrudOperation as TaskOperation };

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

const ENV_VAR = "TASK_UTILS_TASK_DIR";
const STORE_PATH = ".claude/tasks";

/**
 * Task-specific convenience wrapper around the generic resolveStoreRoot.
 * Keeps the 2-arg call signature used in the plugin hooks and tests.
 */
export function resolveStoreRoot(env: NodeJS.ProcessEnv, baseDir: string): string {
  return resolveStoreRootBase(env, baseDir, ENV_VAR, STORE_PATH);
}

/**
 * Build the templated conventional-commit message for a task operation.
 *
 *   create -> chore(tasks): add task <id> <subject>
 *   update -> chore(tasks): update task <id> (<status>)
 *   delete -> chore(tasks): remove task <id>
 */
export function buildCommitMessage(
  operation: CrudOperation,
  id: string,
  opts: { subject?: string; status?: string } = {},
): string {
  switch (operation) {
    case "create": {
      const subject = (opts.subject ?? "").trim();
      return `chore(tasks): add task ${id}${subject ? ` ${subject}` : ""}`;
    }
    case "update": {
      const status = (opts.status ?? "").trim();
      return `chore(tasks): update task ${id}${status ? ` (${status})` : ""}`;
    }
    case "delete":
      return `chore(tasks): remove task ${id}`;
  }
}

/** Task store: flat-file YAML store for TaskRecord objects. */
export class TaskStore extends StoreBase<TaskRecord> {
  /** Resolve a store from the environment + base directory. */
  static fromEnv(env: NodeJS.ProcessEnv, baseDir: string): TaskStore {
    return new TaskStore(resolveStoreRoot(env, baseDir, ENV_VAR, STORE_PATH));
  }

  /**
   * Write the task file and trigger a best-effort git auto-commit.
   * Returns the file path and the git result.
   */
  writeWithGit(
    task: TaskRecord,
    operation: CrudOperation,
    opts: { subject?: string; status?: string } = {},
  ): { filePath: string; git: GitAutoCommitResult } {
    const filePath = this.write(task);
    const commitMessage = buildCommitMessage(operation, task.id, opts);
    const git = tryGitAutoCommit(this.root, filePath, operation, commitMessage);
    return { filePath, git };
  }

  /**
   * Remove the task file and trigger a best-effort git auto-commit.
   * Returns the file path and the git result.
   */
  removeWithGit(id: string): { filePath: string; git: GitAutoCommitResult } {
    const filePath = this.remove(id);
    const commitMessage = buildCommitMessage("delete", id);
    const git = tryGitAutoCommit(this.root, filePath, "delete", commitMessage);
    return { filePath, git };
  }
}
