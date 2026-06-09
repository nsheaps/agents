/**
 * src/server.ts — the task-mcp MCP task server entry point.
 *
 * Exposes four MCP tools — `task_create`, `task_update`, `task_list`,
 * `task_get` — that mirror the built-in Claude Code Task tools. This server is
 * a FALLBACK for contexts where the built-in Task tools are unavailable
 * (notably Claude Code on the web), so the `task-utils` write-gate hook stays
 * satisfiable.
 *
 * Storage is FLAT in the CWD git repo: `<repo-root>/.claude/tasks/<id>.yaml`
 * (overridable with `TASK_UTILS_TASK_DIR`). Every mutation triggers a
 * best-effort templated git auto-commit + push.
 *
 * Transport: stdio (the server runs as a child process of Claude Code).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { TaskStore } from "./store.js";
import { TaskError, TaskManager } from "./tasks.js";

const SERVER_NAME = "task-mcp";
const SERVER_VERSION = "0.1.4";

const STATUS_ENUM = z.enum(["pending", "in_progress", "completed"]);
const UPDATE_STATUS_ENUM = z.enum(["pending", "in_progress", "completed", "deleted"]);

/** Build a successful text result carrying a JSON payload. */
function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

/** Build an error result. `TaskError` messages are surfaced verbatim. */
function errorResult(err: unknown) {
  const message =
    err instanceof TaskError
      ? err.message
      : err instanceof Error
        ? `task-utils-mcp error: ${err.message}`
        : `task-utils-mcp error: ${String(err)}`;
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

/** Construct the TaskManager from the live environment. */
function buildManager(): TaskManager {
  const baseDir =
    process.env.CLAUDE_PROJECT_DIR && process.env.CLAUDE_PROJECT_DIR.trim()
      ? process.env.CLAUDE_PROJECT_DIR.trim()
      : process.cwd();
  const store = TaskStore.fromEnv(process.env, baseDir);
  return new TaskManager(store, process.env.CLAUDE_CODE_SESSION_ID);
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // ---- task_create --------------------------------------------------------
  server.registerTool(
    "task_create",
    {
      title: "Create task",
      description:
        "Create a new task. The task is born in `pending` state — it cannot be created in_progress (use task_update to promote it once it has a <validation-steps> block). Mirrors the built-in TaskCreate tool.",
      inputSchema: {
        subject: z.string().describe("Short imperative task subject."),
        description: z
          .string()
          .optional()
          .describe(
            "Task description. Include a <validation-steps> block when the task is meant to be startable.",
          ),
        activeForm: z
          .string()
          .optional()
          .describe("Present-continuous form of the subject, e.g. 'Fixing X'."),
        metadata: z.record(z.any()).optional().describe("Free-form metadata object."),
      },
    },
    async (args) => {
      try {
        const manager = buildManager();
        const result = manager.create({
          subject: args.subject,
          description: args.description,
          activeForm: args.activeForm,
          metadata: args.metadata,
        });
        return jsonResult({
          task: { id: result.task.id, subject: result.task.subject },
          git: result.git,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ---- task_update --------------------------------------------------------
  server.registerTool(
    "task_update",
    {
      title: "Update task",
      description:
        'Update a task by id — change status, subject, description, dependency edges, owner, or metadata. `status: "deleted"` removes the task. Enforces the task-utils lifecycle invariants in-process (0-or-1 in_progress, validation-steps required for pending->in_progress, RESULT lines required for in_progress->completed). Mirrors the built-in TaskUpdate tool.',
      inputSchema: {
        taskId: z.string().describe("The id of the task to update."),
        status: UPDATE_STATUS_ENUM.optional().describe(
          "New status. 'deleted' removes the task file.",
        ),
        subject: z.string().optional().describe("Replacement subject."),
        description: z
          .string()
          .optional()
          .describe(
            "Replacement description. May be set in the same call as a status change — the server merges before evaluating invariants.",
          ),
        activeForm: z.string().optional().describe("Replacement active form."),
        addBlocks: z
          .array(z.string())
          .optional()
          .describe("Task ids this task blocks (added to the edge set)."),
        addBlockedBy: z
          .array(z.string())
          .optional()
          .describe("Task ids that block this task (added to the edge set)."),
        owner: z.string().optional().describe("Assignee."),
        metadata: z.record(z.any()).optional().describe("Metadata to merge into the task."),
      },
    },
    async (args) => {
      try {
        const manager = buildManager();
        const result = manager.update({
          taskId: args.taskId,
          status: args.status,
          subject: args.subject,
          description: args.description,
          activeForm: args.activeForm,
          addBlocks: args.addBlocks,
          addBlockedBy: args.addBlockedBy,
          owner: args.owner,
          metadata: args.metadata,
        });
        if ("task" in result) {
          return jsonResult({ task: result.task, git: result.git });
        }
        return jsonResult({ deleted: result.id, git: result.git });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ---- task_list ----------------------------------------------------------
  server.registerTool(
    "task_list",
    {
      title: "List tasks",
      description:
        "List all tasks in the store, optionally filtered by status. Read-only. Mirrors the built-in TaskList tool.",
      inputSchema: {
        status: STATUS_ENUM.optional().describe("Optional status filter."),
      },
    },
    async (args) => {
      try {
        const manager = buildManager();
        const tasks = manager.list(args.status);
        return jsonResult({ tasks, count: tasks.length });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ---- task_get -----------------------------------------------------------
  server.registerTool(
    "task_get",
    {
      title: "Get task",
      description: "Get a single task by id. Read-only. Mirrors the built-in TaskGet tool.",
      inputSchema: {
        taskId: z.string().describe("The id of the task to fetch."),
      },
    },
    async (args) => {
      try {
        const manager = buildManager();
        const task = manager.get(args.taskId);
        if (!task) {
          return errorResult(new TaskError(`No task #${args.taskId} found in the task store.`));
        }
        return jsonResult({ task });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run only when executed directly (not when imported by tests).
//
// `import.meta.main` is the reliable signal across every way this module runs:
//   - `bun build --compile` native binary  → true when the binary is run
//   - `bun run src/server.ts`              → true
//   - imported by a test file              → false (the test file is main)
// It is preferred over `process.argv[1]` path checks, which do not match a
// compiled binary (whose entrypoint path is the binary, not "server.js").
const isMain = (() => {
  try {
    return import.meta.main === true;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((err) => {
    process.stderr.write(`task-utils-mcp fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
