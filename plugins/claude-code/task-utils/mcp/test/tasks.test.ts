/**
 * Unit tests for the TaskManager lifecycle invariants — parity with
 * `hooks/task-invariant.sh`. Temp dirs only; no git remote (auto-commit is
 * best-effort and tested separately).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TaskStore } from "../src/store.js";
import { TaskError, TaskManager } from "../src/tasks.js";

let tmp: string;
let manager: TaskManager;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "task-utils-tasks-"));
  manager = new TaskManager(new TaskStore(tmp));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const VS_OPEN = ["<validation-steps>", " - [ ] do the thing", "</validation-steps>"].join("\n");

const VS_DONE = [
  "<validation-steps>",
  " - [x] did the thing",
  "       RESULT(2026-05-21 04:00Z): evidence",
  "</validation-steps>",
].join("\n");

describe("task_create", () => {
  test("creates a pending task with an assigned id", () => {
    const r = manager.create({ subject: "first task" });
    expect("task" in r).toBe(true);
    if ("task" in r) {
      expect(r.task.id).toBe("1");
      expect(r.task.status).toBe("pending");
      expect(r.task.source).toBe("task-utils-mcp");
    }
  });

  test("a task can never be born in_progress (no status input)", () => {
    const r = manager.create({ subject: "x" });
    if ("task" in r) {
      expect(r.task.status).toBe("pending");
    }
  });

  test("rejects an empty subject", () => {
    expect(() => manager.create({ subject: "  " })).toThrow(TaskError);
  });

  test("ids increment", () => {
    manager.create({ subject: "a" });
    const r = manager.create({ subject: "b" });
    if ("task" in r) {
      expect(r.task.id).toBe("2");
    }
  });
});

describe("task_update — pending -> in_progress", () => {
  test("denied without a <validation-steps> block", () => {
    manager.create({ subject: "a" });
    expect(() => manager.update({ taskId: "1", status: "in_progress" })).toThrow(
      /no <validation-steps> block/,
    );
  });

  test("allowed with a validation-steps block (same-call merge)", () => {
    manager.create({ subject: "a" });
    const r = manager.update({
      taskId: "1",
      status: "in_progress",
      description: VS_OPEN,
    });
    if ("task" in r) {
      expect(r.task.status).toBe("in_progress");
    }
  });

  test("denied when another task is already in_progress (0-or-1)", () => {
    manager.create({ subject: "a" });
    manager.create({ subject: "b" });
    manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN });
    expect(() =>
      manager.update({ taskId: "2", status: "in_progress", description: VS_OPEN }),
    ).toThrow(/already in_progress/);
  });
});

describe("task_update — completed transitions", () => {
  test("in_progress -> completed denied with unchecked steps", () => {
    manager.create({ subject: "a" });
    manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN });
    expect(() => manager.update({ taskId: "1", status: "completed" })).toThrow(
      /validation step\(s\) remain unchecked/,
    );
  });

  test("in_progress -> completed denied when a [x] lacks a RESULT line", () => {
    manager.create({ subject: "a" });
    const noResult = ["<validation-steps>", " - [x] did it", "</validation-steps>"].join("\n");
    manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN });
    expect(() =>
      manager.update({ taskId: "1", status: "completed", description: noResult }),
    ).toThrow(/missing RESULT lines/);
  });

  test("in_progress -> completed allowed with all steps checked + RESULT", () => {
    manager.create({ subject: "a" });
    manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN });
    const r = manager.update({
      taskId: "1",
      status: "completed",
      description: VS_DONE,
    });
    if ("task" in r) {
      expect(r.task.status).toBe("completed");
    }
  });

  test("pending -> completed skips the validation-step check", () => {
    manager.create({ subject: "a" });
    const r = manager.update({ taskId: "1", status: "completed" });
    if ("task" in r) {
      expect(r.task.status).toBe("completed");
    }
  });

  test("completed is terminal — cannot re-open", () => {
    manager.create({ subject: "a" });
    manager.update({ taskId: "1", status: "completed" });
    expect(() =>
      manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN }),
    ).toThrow(/terminal/);
  });
});

describe("task_update — patches and deletion", () => {
  test("status: deleted removes the task", () => {
    manager.create({ subject: "a" });
    const r = manager.update({ taskId: "1", status: "deleted" });
    expect("id" in r && !("task" in r)).toBe(true);
    expect(manager.get("1")).toBeNull();
  });

  test("updating a missing task throws", () => {
    expect(() => manager.update({ taskId: "404", subject: "x" })).toThrow(/No task #404/);
  });

  test("addBlockedBy / addBlocks merge dependency edges", () => {
    manager.create({ subject: "a" });
    const r = manager.update({
      taskId: "1",
      addBlocks: ["2"],
      addBlockedBy: ["3", "3"],
    });
    if ("task" in r) {
      expect(r.task.blocks).toEqual(["2"]);
      expect(r.task.blockedBy).toEqual(["3"]);
    }
  });

  test("park back to pending is always allowed", () => {
    manager.create({ subject: "a" });
    manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN });
    const r = manager.update({ taskId: "1", status: "pending" });
    if ("task" in r) {
      expect(r.task.status).toBe("pending");
    }
  });
});

describe("task_list / task_get", () => {
  test("list returns all tasks", () => {
    manager.create({ subject: "a" });
    manager.create({ subject: "b" });
    expect(manager.list().length).toBe(2);
  });

  test("list filters by status", () => {
    manager.create({ subject: "a" });
    manager.create({ subject: "b" });
    manager.update({ taskId: "1", status: "in_progress", description: VS_OPEN });
    expect(manager.list("in_progress").map((t) => t.id)).toEqual(["1"]);
    expect(manager.list("pending").map((t) => t.id)).toEqual(["2"]);
  });

  test("get returns the full task or null", () => {
    manager.create({ subject: "a" });
    expect(manager.get("1")?.subject).toBe("a");
    expect(manager.get("99")).toBeNull();
  });
});
