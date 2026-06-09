/**
 * lib/git-helper.ts — generic best-effort git auto-commit + push engine.
 *
 * Generic: contains no task-specific assumptions. Reusable by any MCP server
 * that writes files to a git repo (e.g. a future ticket-mcp-service).
 *
 * The CRUD operation type and tryGitAutoCommit() are fully decoupled from the
 * commit-message format — callers supply their own commit message string
 * (e.g. "chore(tasks): …" or "chore(tickets): …").
 *
 * Guarantees:
 *   - TEMPLATED conventional-commit messages — never an AI model call.
 *   - BEST-EFFORT — any git failure is caught, logged, and the calling tool
 *     still succeeds. A store write must never fail on git.
 *   - Git is only attempted when the store is inside a git working tree.
 *
 * Errors are appended to `<storeRoot>/.git-auto-commit.log` for debugging.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

/** Generic CRUD operation type — valid for any flat-file store. */
export type CrudOperation = "create" | "update" | "delete";

export interface GitAutoCommitResult {
  /** true if a commit was produced */
  committed: boolean;
  /** true if a push was attempted (regardless of push success) */
  pushAttempted: boolean;
  /** true if the push command exited 0 */
  pushed: boolean;
  /** the stage at which the sequence stopped, for diagnostics */
  stoppedAt: "not-a-repo" | "add" | "commit" | "push" | "done";
  /** human-readable note (error message or success) */
  detail: string;
}

function git(cwd: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr =
      typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? e.message ?? String(err));
    return { ok: false, out: stderr.trim() };
  }
}

function logError(
  storeRoot: string,
  filePath: string,
  operation: CrudOperation,
  stage: string,
  detail: string,
): void {
  const line =
    `[${new Date().toISOString()}] mcp-service git auto-commit\n` +
    `  file: ${filePath}\n` +
    `  operation: ${operation}\n` +
    `  git-status: failed at ${stage} stage\n` +
    `  error: ${detail}\n` +
    `  action: logged; store file written; commit + push abandoned\n`;
  try {
    appendFileSync(join(storeRoot, ".git-auto-commit.log"), line, "utf8");
  } catch {
    // logging is itself best-effort
  }
}

/**
 * Attempt to auto-commit and push a store file. Never throws.
 *
 * @param storeRoot    the store root directory (also the git cwd)
 * @param filePath     absolute path to the file that changed
 * @param operation    create | update | delete
 * @param commitMessage  caller-supplied conventional-commit message
 */
export function tryGitAutoCommit(
  storeRoot: string,
  filePath: string,
  operation: CrudOperation,
  commitMessage: string,
): GitAutoCommitResult {
  // 1. Only proceed inside a git working tree.
  const insideRepo = git(storeRoot, ["rev-parse", "--git-dir"]);
  if (!insideRepo.ok) {
    return {
      committed: false,
      pushAttempted: false,
      pushed: false,
      stoppedAt: "not-a-repo",
      detail: "store is not inside a git working tree — git skipped",
    };
  }

  // 2. Stage the file. For a delete the file is gone; `git add` of a removed
  //    path stages the deletion.
  const add = git(storeRoot, ["add", "--", filePath]);
  if (!add.ok) {
    logError(storeRoot, filePath, operation, "add", add.out);
    return {
      committed: false,
      pushAttempted: false,
      pushed: false,
      stoppedAt: "add",
      detail: add.out,
    };
  }

  // 3. Commit. If nothing is staged (e.g. an idempotent write), `git commit`
  //    exits non-zero — that is a benign no-op, not a failure.
  const commit = git(storeRoot, ["commit", "-m", commitMessage, "--", filePath]);
  if (!commit.ok) {
    logError(storeRoot, filePath, operation, "commit", commit.out);
    return {
      committed: false,
      pushAttempted: false,
      pushed: false,
      stoppedAt: "commit",
      detail: commit.out,
    };
  }

  // 4. Push — best-effort, no retry on rejection.
  const push = git(storeRoot, ["push"]);
  if (!push.ok) {
    logError(storeRoot, filePath, operation, "push", push.out);
    return {
      committed: true,
      pushAttempted: true,
      pushed: false,
      stoppedAt: "push",
      detail: `committed locally; push failed: ${push.out}`,
    };
  }

  return {
    committed: true,
    pushAttempted: true,
    pushed: true,
    stoppedAt: "done",
    detail: "committed and pushed",
  };
}
