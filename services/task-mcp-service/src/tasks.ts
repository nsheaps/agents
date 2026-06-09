/**
 * src/tasks.ts — task lifecycle logic for the task-mcp MCP server.
 *
 * Re-implements the invariants enforced by `hooks/task-invariant.sh` IN-PROCESS,
 * because the PreToolUse hook only matches the literal built-in tool names
 * `TaskCreate|TaskUpdate` — the MCP tools (`task_create` / `task_update`) are
 * different tool names and never trigger the hook. The MCP server is therefore
 * responsible for policing the same invariants the hook would.
 *
 * Enforced invariants (parity with task-invariant.sh):
 *   - A task may NOT be born `in_progress` — there is no `status` input on
 *     create.
 *   - 0-or-1 task `in_progress` at any time (across the MCP task store).
 *   - `pending -> in_progress` requires a <validation-steps> block with >=1
 *     unchecked `- [ ]` item.
 *   - `in_progress -> completed` requires every step `- [x]` and every checked
 *     step followed by a RESULT(...) line.
 *   - `pending -> completed` skips the validation-step check.
 *
 * On a rejected transition the caller surfaces `TaskError.message` to the
 * agent — the prose mirrors the hook's deny text so coaching is identical.
 */

import { buildCommitMessage, TaskStore } from "./store.js";
import type { GitAutoCommitResult, TaskRecord, TaskStatus } from "./store.js";
import type { CrudOperation } from "../lib/git-helper.js";
import { tryGitAutoCommit } from "../lib/git-helper.js";
import { parseValidationSteps } from "./validation-steps.js";

/** A lifecycle-invariant violation — surfaced to the agent as `isError`. */
export class TaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskError";
  }
}

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed"]);
const VALID_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "in_progress",
  "completed",
  "deleted",
]);

function nowIso(): string {
  return new Date().toISOString();
}

export interface CreateInput {
  subject: string;
  description?: string;
  activeForm?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateInput {
  taskId: string;
  status?: "pending" | "in_progress" | "completed" | "deleted";
  subject?: string;
  description?: string;
  activeForm?: string;
  addBlocks?: string[];
  addBlockedBy?: string[];
  owner?: string;
  metadata?: Record<string, unknown>;
}

export interface MutationResult {
  task: TaskRecord;
  git: GitAutoCommitResult;
}

export interface DeleteResult {
  id: string;
  git: GitAutoCommitResult;
}

/**
 * The TaskManager binds a TaskStore and performs lifecycle-validated mutations.
 * Each mutation triggers a best-effort git auto-commit.
 */
export class TaskManager {
  private readonly store: TaskStore;
  private readonly sessionId: string | undefined;

  constructor(store: TaskStore, sessionId?: string) {
    this.store = store;
    this.sessionId = sessionId;
  }

  get storeRoot(): string {
    return this.store.root;
  }

  /** Create a new task. Tasks are born `pending` — no status input. */
  create(input: CreateInput): MutationResult {
    const subject = input.subject?.trim();
    if (!subject) {
      throw new TaskError("task_create requires a non-empty `subject`.");
    }
    const id = this.store.nextId();
    const ts = nowIso();
    const task: TaskRecord = {
      id,
      subject,
      status: "pending",
      description: input.description ?? "",
      activeForm: input.activeForm,
      blocks: [],
      blockedBy: [],
      metadata: input.metadata ?? {},
      source: "task-utils-mcp",
      createdAt: ts,
      updatedAt: ts,
      session: this.sessionId,
    };
    const path = this.store.write(task);
    const git = this.autoCommit(path, "create", {
      id,
      subject: task.subject,
    });
    return { task, git };
  }

  /** Update a task. `status: "deleted"` removes the task file. */
  update(input: UpdateInput): MutationResult | DeleteResult {
    const id = input.taskId?.trim();
    if (!id) {
      throw new TaskError("task_update requires a `taskId`.");
    }
    if (input.status && !VALID_STATUSES.has(input.status)) {
      throw new TaskError(
        `Invalid status "${input.status}" — must be one of pending, in_progress, completed, deleted.`,
      );
    }

    const current = this.store.read(id);
    if (!current) {
      throw new TaskError(`No task #${id} found in the task store.`);
    }

    // Deletion path.
    if (input.status === "deleted") {
      const path = this.store.remove(id);
      const git = this.autoCommit(path, "delete", { id });
      return { id, git };
    }

    if (TERMINAL_STATUSES.has(current.status) && input.status && input.status !== current.status) {
      throw new TaskError(
        `Task #${id} is completed — completed is terminal. Create a new task instead of re-opening it.`,
      );
    }

    const newStatus = (input.status ?? current.status) as TaskStatus;

    // Effective description = input.description if provided, else current.
    const effectiveDesc = input.description !== undefined ? input.description : current.description;

    // ---- Invariant: pending -> in_progress -----------------------------
    if (newStatus === "in_progress" && current.status !== "in_progress") {
      this.assertNoOtherInProgress(id);
      const vs = parseValidationSteps(effectiveDesc);
      if (vs.unchecked < 1) {
        throw new TaskError(
          `Cannot move task #${id} to in_progress — the task description has no <validation-steps> block with at least one unchecked "- [ ]" item. Add validation steps that capture the pass/fail criteria for this task, in this format inside the description:\n\n  <validation-steps>\n   - [ ] step one\n   - [ ] step two\n  </validation-steps>\n\nYou can set the description AND the status in the SAME task_update call — the server merges them before evaluating. If the task truly has no validation work to do, prefer pending->completed (which skips validation checks).`,
        );
      }
    }

    // ---- Invariant: in_progress -> completed ---------------------------
    if (newStatus === "completed" && current.status === "in_progress") {
      const vs = parseValidationSteps(effectiveDesc);
      if (vs.unchecked > 0) {
        throw new TaskError(
          `Cannot move task #${id} to completed — ${vs.unchecked} validation step(s) remain unchecked in <validation-steps>. Either complete the work (and check each item + add a RESULT(...) line as evidence), or park the task back to pending to keep the lifecycle honest. Note: pending->completed (without ever transitioning to in_progress) IS allowed when no validation is intended.`,
        );
      }
      if (vs.missingResult.length > 0) {
        throw new TaskError(
          `Cannot move task #${id} to completed — the following checked validation step(s) are missing RESULT lines (1-based item indices): ${vs.missingResult.join(",")}. Add a RESULT(<timestamp>[, by (<agentName>|Agent(<subAgentId>))]): <evidence> line directly after each "- [x]" item documenting how you verified it.`,
        );
      }
    }

    // ---- Apply the patch ----------------------------------------------
    const updated: TaskRecord = {
      ...current,
      status: newStatus,
      subject: input.subject?.trim() ? input.subject.trim() : current.subject,
      description: effectiveDesc,
      activeForm: input.activeForm !== undefined ? input.activeForm : current.activeForm,
      owner: input.owner !== undefined ? input.owner : current.owner,
      metadata: input.metadata ? { ...current.metadata, ...input.metadata } : current.metadata,
      blocks: mergeEdges(current.blocks, input.addBlocks),
      blockedBy: mergeEdges(current.blockedBy, input.addBlockedBy),
      updatedAt: nowIso(),
    };
    const path = this.store.write(updated);
    const git = this.autoCommit(path, "update", {
      id,
      status: updated.status,
    });
    return { task: updated, git };
  }

  /** Read a single task. Returns null if not found. */
  get(id: string): TaskRecord | null {
    return this.store.read(id.trim());
  }

  /** List tasks, optionally filtered by status. */
  list(status?: string): TaskRecord[] {
    const all = this.store.readAll();
    if (!status) {
      return all;
    }
    return all.filter((t) => t.status === status);
  }

  /** Throw if any OTHER task is already in_progress (0-or-1 invariant). */
  private assertNoOtherInProgress(exceptId: string): void {
    const others = this.store
      .readAll()
      .filter((t) => t.id !== exceptId && t.status === "in_progress");
    if (others.length > 0) {
      const list = others.map((t) => `#${t.id} (${t.subject})`).join("; ");
      throw new TaskError(
        `Cannot move task #${exceptId} to in_progress — already in_progress: ${list}. Project rule: exactly 0 or 1 task may be in_progress. Pick one: (a) complete the current task via task_update status=completed, (b) move it back to pending via task_update status=pending, (c) create a sub-task via task_create to capture the new direction.`,
      );
    }
  }

  private autoCommit(
    filePath: string,
    operation: CrudOperation,
    opts: { id: string; subject?: string; status?: string },
  ): GitAutoCommitResult {
    const msg = buildCommitMessage(operation, opts.id, {
      subject: opts.subject,
      status: opts.status,
    });
    return tryGitAutoCommit(this.store.root, filePath, operation, msg);
  }
}

/** Merge dependency-edge ids, de-duplicating, preserving insertion order. */
function mergeEdges(existing: string[], additions?: string[]): string[] {
  if (!additions || additions.length === 0) {
    return existing;
  }
  const set = new Set(existing);
  for (const a of additions) {
    set.add(a);
  }
  return [...set];
}
