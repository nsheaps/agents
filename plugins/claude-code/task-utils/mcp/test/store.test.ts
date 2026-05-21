/**
 * Unit tests for store-root resolution and the TaskStore. All file-touching
 * tests use a temp directory so they never write to a real ~/.claude.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { compareIds, resolveStoreRoot, TaskStore } from "../src/store.js";
import type { TaskRecord } from "../src/store.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "task-utils-store-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function sampleTask(id: string): TaskRecord {
  const ts = new Date().toISOString();
  return {
    id,
    subject: `task ${id}`,
    status: "pending",
    description: "",
    blocks: [],
    blockedBy: [],
    metadata: {},
    source: "task-utils-mcp",
    createdAt: ts,
    updatedAt: ts,
  };
}

describe("resolveStoreRoot", () => {
  test("TASK_UTILS_TASK_DIR override wins", () => {
    const root = resolveStoreRoot({ TASK_UTILS_TASK_DIR: tmp }, "/some/dir");
    expect(root).toBe(tmp);
  });

  test("override wins even when baseDir is a git repo", () => {
    execFileSync("git", ["init", "-q"], { cwd: tmp });
    const root = resolveStoreRoot({ TASK_UTILS_TASK_DIR: "/explicit" }, tmp);
    expect(root).toBe("/explicit");
  });

  test("git repo root -> <repo>/.claude/tasks (flat)", () => {
    execFileSync("git", ["init", "-q"], { cwd: tmp });
    const root = resolveStoreRoot({}, tmp);
    expect(root).toBe(join(tmp, ".claude", "tasks"));
  });

  test("not a git repo -> <baseDir>/.claude/tasks fallback", () => {
    const root = resolveStoreRoot({}, tmp);
    expect(root).toBe(join(tmp, ".claude", "tasks"));
  });

  test("empty override is ignored", () => {
    const root = resolveStoreRoot({ TASK_UTILS_TASK_DIR: "  " }, tmp);
    expect(root).toBe(join(tmp, ".claude", "tasks"));
  });
});

describe("TaskStore", () => {
  test("write then read round-trips", () => {
    const store = new TaskStore(tmp);
    const task = sampleTask("1");
    store.write(task);
    expect(store.read("1")).toEqual(task);
  });

  test("write creates a flat <id>.yaml file", () => {
    const store = new TaskStore(join(tmp, "tasks"));
    store.write(sampleTask("7"));
    expect(store.filePath("7")).toBe(join(tmp, "tasks", "7.yaml"));
    expect(store.listIds()).toEqual(["7"]);
  });

  test("read of a missing task returns null", () => {
    expect(new TaskStore(tmp).read("99")).toBeNull();
  });

  test("nextId starts at 1 and increments past the max", () => {
    const store = new TaskStore(tmp);
    expect(store.nextId()).toBe("1");
    store.write(sampleTask("1"));
    store.write(sampleTask("2"));
    expect(store.nextId()).toBe("3");
    store.write(sampleTask("10"));
    expect(store.nextId()).toBe("11");
  });

  test("remove deletes the file", () => {
    const store = new TaskStore(tmp);
    store.write(sampleTask("1"));
    expect(store.read("1")).not.toBeNull();
    store.remove("1");
    expect(store.read("1")).toBeNull();
  });

  test("readAll returns tasks in numeric id order", () => {
    const store = new TaskStore(tmp);
    store.write(sampleTask("10"));
    store.write(sampleTask("2"));
    store.write(sampleTask("1"));
    expect(store.readAll().map((t) => t.id)).toEqual(["1", "2", "10"]);
  });
});

describe("compareIds", () => {
  test("numeric ids compare numerically", () => {
    expect(compareIds("2", "10")).toBeLessThan(0);
    expect(compareIds("10", "2")).toBeGreaterThan(0);
  });

  test("non-numeric ids compare lexically", () => {
    expect(compareIds("abc", "abd")).toBeLessThan(0);
  });
});
