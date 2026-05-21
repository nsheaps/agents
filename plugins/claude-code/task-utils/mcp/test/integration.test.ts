/**
 * Integration test — drives the BUILT server over stdio with the official MCP
 * SDK client, exercising all four tools end-to-end.
 *
 * The server is shipped as source and compiled to a native binary
 * (`dist/task-mcp`) by `bun build --compile`. `mise run test-task-mcp` runs
 * `build-task-mcp` first, so the compiled binary exists when this test runs.
 * A temp git repo is used as TASK_UTILS_TASK_DIR so real repos are never
 * polluted.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_BIN = join(HERE, "..", "dist", "task-mcp");

let storeDir: string;
let client: Client;

/** Parse the JSON text payload out of a tool result. */
function payload(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text) as Record<string, unknown>;
}

beforeAll(async () => {
  storeDir = mkdtempSync(join(tmpdir(), "task-utils-integ-"));
  execFileSync("git", ["init", "-q"], { cwd: storeDir });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: storeDir,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: storeDir });
  // Disable signing so the test is independent of the host's signing backend.
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: storeDir });

  const transport = new StdioClientTransport({
    command: SERVER_BIN,
    args: [],
    env: {
      ...process.env,
      TASK_UTILS_TASK_DIR: storeDir,
    },
  });
  client = new Client({ name: "integration-test", version: "0" });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  rmSync(storeDir, { recursive: true, force: true });
});

describe("MCP server over stdio", () => {
  test("the compiled binary exists", () => {
    expect(existsSync(SERVER_BIN)).toBe(true);
  });

  test("lists exactly the four task tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["task_create", "task_get", "task_list", "task_update"]);
  });

  test("task_create writes a flat <id>.yaml file", async () => {
    const res = await client.callTool({
      name: "task_create",
      arguments: { subject: "integration task one" },
    });
    const out = payload(res as never);
    const task = out.task as { id: string; subject: string };
    expect(task.id).toBe("1");
    expect(task.subject).toBe("integration task one");

    // Flat storage — directly under storeDir, no session subdir.
    const file = join(storeDir, "1.yaml");
    expect(existsSync(file)).toBe(true);
    const onDisk = yamlParse(readFileSync(file, "utf8"));
    expect(onDisk.id).toBe("1");
    expect(onDisk.status).toBe("pending");
    expect(onDisk.source).toBe("task-utils-mcp");
  });

  test("task_get reads a task back", async () => {
    const res = await client.callTool({
      name: "task_get",
      arguments: { taskId: "1" },
    });
    const out = payload(res as never);
    expect((out.task as { subject: string }).subject).toBe(
      "integration task one",
    );
  });

  test("task_get of a missing task is an error", async () => {
    const res = (await client.callTool({
      name: "task_get",
      arguments: { taskId: "999" },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  test("task_update enforces no born-in_progress invariant", async () => {
    // Cannot promote without a <validation-steps> block.
    const res = (await client.callTool({
      name: "task_update",
      arguments: { taskId: "1", status: "in_progress" },
    })) as { isError?: boolean; content: Array<{ text?: string }> };
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/no <validation-steps> block/);
  });

  test("task_update promotes with a validation-steps block", async () => {
    const res = await client.callTool({
      name: "task_update",
      arguments: {
        taskId: "1",
        status: "in_progress",
        description:
          "<validation-steps>\n - [ ] verify it works\n</validation-steps>",
      },
    });
    const out = payload(res as never);
    expect((out.task as { status: string }).status).toBe("in_progress");
  });

  test("task_update enforces the 0-or-1 in_progress invariant", async () => {
    await client.callTool({
      name: "task_create",
      arguments: { subject: "integration task two" },
    });
    const res = (await client.callTool({
      name: "task_update",
      arguments: {
        taskId: "2",
        status: "in_progress",
        description: "<validation-steps>\n - [ ] x\n</validation-steps>",
      },
    })) as { isError?: boolean; content: Array<{ text?: string }> };
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/already in_progress/);
  });

  test("task_update enforces RESULT lines on completion", async () => {
    const res = (await client.callTool({
      name: "task_update",
      arguments: { taskId: "1", status: "completed" },
    })) as { isError?: boolean; content: Array<{ text?: string }> };
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/unchecked/);
  });

  test("task_update completes with checked steps + RESULT", async () => {
    const res = await client.callTool({
      name: "task_update",
      arguments: {
        taskId: "1",
        status: "completed",
        description:
          "<validation-steps>\n - [x] verified it works\n       RESULT(2026-05-21 04:00Z): confirmed\n</validation-steps>",
      },
    });
    const out = payload(res as never);
    expect((out.task as { status: string }).status).toBe("completed");
  });

  test("task_list returns all tasks and filters by status", async () => {
    const all = payload(
      (await client.callTool({ name: "task_list", arguments: {} })) as never,
    );
    expect(all.count).toBe(2);

    const completed = payload(
      (await client.callTool({
        name: "task_list",
        arguments: { status: "completed" },
      })) as never,
    );
    expect(completed.count).toBe(1);
  });

  test("auto-commit produced conventional commits in the temp repo", () => {
    const log = execFileSync("git", ["log", "--pretty=%s"], {
      cwd: storeDir,
      encoding: "utf8",
    });
    // task_create + task_update calls each produce a chore(tasks) commit.
    expect(log).toMatch(/chore\(tasks\): add task 1 integration task one/);
    expect(log).toMatch(/chore\(tasks\): update task 1 \(in_progress\)/);
    expect(log).toMatch(/chore\(tasks\): update task 1 \(completed\)/);
  });

  test("task_update status=deleted removes the file", async () => {
    await client.callTool({
      name: "task_update",
      arguments: { taskId: "2", status: "deleted" },
    });
    expect(existsSync(join(storeDir, "2.yaml"))).toBe(false);
  });
});
