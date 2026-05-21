/**
 * Unit tests for the git auto-commit helper. Uses temp git repos so real
 * repos are never touched.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildCommitMessage, tryGitAutoCommit } from "../src/git-helper.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "task-utils-git-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo(dir: string): void {
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  // Disable commit signing so tests are independent of the host's signing
  // configuration (some CI/sandbox hosts force a signing backend).
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["config", "tag.gpgsign", "false"]);
}

describe("buildCommitMessage", () => {
  test("create message", () => {
    expect(buildCommitMessage("create", "3", { subject: "fix the bug" })).toBe(
      "chore(tasks): add task 3 fix the bug",
    );
  });

  test("create message without subject", () => {
    expect(buildCommitMessage("create", "3")).toBe("chore(tasks): add task 3");
  });

  test("update message includes status", () => {
    expect(buildCommitMessage("update", "5", { status: "in_progress" })).toBe(
      "chore(tasks): update task 5 (in_progress)",
    );
  });

  test("delete message", () => {
    expect(buildCommitMessage("delete", "9")).toBe(
      "chore(tasks): remove task 9",
    );
  });
});

describe("tryGitAutoCommit", () => {
  test("not a git repo -> skipped, no throw", () => {
    const file = join(tmp, "1.json");
    writeFileSync(file, "{}");
    const r = tryGitAutoCommit(tmp, file, "create", "chore(tasks): add task 1");
    expect(r.stoppedAt).toBe("not-a-repo");
    expect(r.committed).toBe(false);
  });

  test("commits a task file in a git repo", () => {
    initRepo(tmp);
    const file = join(tmp, "1.json");
    writeFileSync(file, '{"id":"1"}');
    const r = tryGitAutoCommit(
      tmp,
      file,
      "create",
      "chore(tasks): add task 1 do something",
    );
    expect(r.committed).toBe(true);
    const last = git(tmp, ["log", "-1", "--pretty=%s"]);
    expect(last).toBe("chore(tasks): add task 1 do something");
  });

  test("push attempted against a real remote and succeeds", () => {
    // Bare remote.
    const remote = mkdtempSync(join(tmpdir(), "task-utils-remote-"));
    try {
      git(remote, ["init", "-q", "--bare"]);
      initRepo(tmp);
      git(tmp, ["remote", "add", "origin", remote]);
      // Initial commit so there is a branch to push.
      writeFileSync(join(tmp, "README"), "x");
      git(tmp, ["add", "README"]);
      git(tmp, ["commit", "-q", "-m", "init"]);
      git(tmp, ["push", "-q", "-u", "origin", "HEAD"]);

      const file = join(tmp, "1.json");
      writeFileSync(file, '{"id":"1"}');
      const r = tryGitAutoCommit(
        tmp,
        file,
        "create",
        "chore(tasks): add task 1",
      );
      expect(r.committed).toBe(true);
      expect(r.pushAttempted).toBe(true);
      expect(r.pushed).toBe(true);
      expect(r.stoppedAt).toBe("done");
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }
  });

  test("commit succeeds but push fails (no remote) -> swallowed", () => {
    initRepo(tmp);
    const file = join(tmp, "1.json");
    writeFileSync(file, '{"id":"1"}');
    const r = tryGitAutoCommit(tmp, file, "create", "chore(tasks): add task 1");
    expect(r.committed).toBe(true);
    expect(r.pushAttempted).toBe(true);
    expect(r.pushed).toBe(false);
    expect(r.stoppedAt).toBe("push");
  });

  test("delete operation stages a removal", () => {
    initRepo(tmp);
    const file = join(tmp, "1.json");
    writeFileSync(file, '{"id":"1"}');
    git(tmp, ["add", "1.json"]);
    git(tmp, ["commit", "-q", "-m", "add"]);
    rmSync(file);
    const r = tryGitAutoCommit(tmp, file, "delete", "chore(tasks): remove task 1");
    expect(r.committed).toBe(true);
    const last = git(tmp, ["log", "-1", "--pretty=%s"]);
    expect(last).toBe("chore(tasks): remove task 1");
  });
});
