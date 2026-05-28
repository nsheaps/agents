/**
 * Tests for patch-event missing-file tolerance.
 *
 * Run with: bun test apps/pr-status-cli/src/patch-event.test.ts
 *
 * These tests exercise the file-seeding path added in fix/patch-event-tolerate-missing:
 * when docs/pr-status/per-repo/<slug>.md or docs/pr-status/all.md doesn't exist,
 * patch-event should seed the file and insert the PR line instead of skipping.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI = join(import.meta.dir, "index.ts");

/** Minimal GitHub pull_request event payload */
function makeEvent(overrides: Partial<{
  action: string;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  login: string;
  full_name: string;
}> = {}): object {
  const o = {
    action: "opened",
    number: 42,
    title: "feat: add something",
    html_url: "https://github.com/owner/repo/pull/42",
    state: "open" as "open" | "closed",
    draft: false,
    merged: false,
    mergeable: null,
    login: "testuser",
    full_name: "owner/repo",
    ...overrides,
  };
  return {
    action: o.action,
    pull_request: {
      number: o.number,
      title: o.title,
      html_url: o.html_url,
      state: o.state,
      draft: o.draft,
      merged: o.merged,
      mergeable: o.mergeable,
      user: { login: o.login, html_url: `https://github.com/${o.login}` },
      base: { repo: { full_name: o.full_name } },
      labels: [],
    },
    repository: { full_name: o.full_name },
  };
}

function runPatchEvent(eventFile: string, digestDir: string): ReturnType<typeof spawnSync> {
  return spawnSync(
    "bun",
    ["run", CLI, "patch-event", "--event-file", eventFile, "--digest-dir", digestDir],
    { encoding: "utf8" },
  );
}

describe("patch-event: missing digest file", () => {
  let tmpDir: string;
  let eventFile: string;
  let digestDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `pr-status-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    eventFile = join(tmpDir, "event.json");
    digestDir = join(tmpDir, "docs", "pr-status");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("seeds per-repo file and all.md when neither exists", () => {
    const event = makeEvent({ action: "opened", number: 1, title: "first PR", full_name: "owner/repo" });
    writeFileSync(eventFile, JSON.stringify(event));

    const result = runPatchEvent(eventFile, digestDir);
    expect(result.status).toBe(0);

    const perRepoPath = join(digestDir, "per-repo", "owner--repo.md");
    const allPath = join(digestDir, "all.md");

    expect(existsSync(perRepoPath)).toBe(true);
    expect(existsSync(allPath)).toBe(true);

    const perRepoContent = readFileSync(perRepoPath, "utf8");
    // Should have a header line
    expect(perRepoContent).toMatch(/^# PR Status — owner\/repo/m);
    // Should include the PR line
    expect(perRepoContent).toContain("[[owner/repo#1] first PR]");

    const allContent = readFileSync(allPath, "utf8");
    expect(allContent).toMatch(/^# PR Status — REPOS\.md scope/m);
    expect(allContent).toContain("[[owner/repo#1] first PR]");
  });

  it("seeds only the missing per-repo file when all.md already exists", () => {
    const event = makeEvent({ number: 7, title: "PR in existing all", full_name: "acme/widget" });
    writeFileSync(eventFile, JSON.stringify(event));

    // Pre-create all.md but NOT the per-repo file
    mkdirSync(digestDir, { recursive: true });
    const allPath = join(digestDir, "all.md");
    writeFileSync(allPath, "# PR Status — REPOS.md scope (combined)\n\nexisting line\n");

    const result = runPatchEvent(eventFile, digestDir);
    expect(result.status).toBe(0);

    const perRepoPath = join(digestDir, "per-repo", "acme--widget.md");
    expect(existsSync(perRepoPath)).toBe(true);
    const perRepoContent = readFileSync(perRepoPath, "utf8");
    expect(perRepoContent).toContain("[[acme/widget#7] PR in existing all]");

    // all.md should have the PR appended into existing content
    const allContent = readFileSync(allPath, "utf8");
    expect(allContent).toContain("existing line");
    expect(allContent).toContain("[[acme/widget#7] PR in existing all]");
  });

  it("inserts line into existing file that lacks the PR entry", () => {
    const event = makeEvent({ number: 99, title: "new PR", full_name: "org/service" });
    writeFileSync(eventFile, JSON.stringify(event));

    const perRepoDir = join(digestDir, "per-repo");
    mkdirSync(perRepoDir, { recursive: true });
    const perRepoPath = join(perRepoDir, "org--service.md");
    const allPath = join(digestDir, "all.md");
    // Existing files with other PRs
    writeFileSync(perRepoPath, "# PR Status — org/service\n\n[🟢](# \"open\")... [[org/service#1] old PR](url) by [@u](u)\n");
    writeFileSync(allPath, "# PR Status — combined\n\n[🟢](# \"open\")... [[org/service#1] old PR](url) by [@u](u)\n");

    const result = runPatchEvent(eventFile, digestDir);
    expect(result.status).toBe(0);

    const perRepoContent = readFileSync(perRepoPath, "utf8");
    // old line preserved
    expect(perRepoContent).toContain("[[org/service#1] old PR]");
    // new line inserted
    expect(perRepoContent).toContain("[[org/service#99] new PR]");
  });

  it("exits 0 when event payload is valid — never crashes on missing digest", () => {
    // Closed/merged PR with no digest files at all
    const event = makeEvent({ action: "closed", state: "closed", merged: true, number: 5, full_name: "x/y" });
    writeFileSync(eventFile, JSON.stringify(event));

    const result = runPatchEvent(eventFile, digestDir);
    expect(result.status).toBe(0);
    // File should be seeded
    expect(existsSync(join(digestDir, "per-repo", "x--y.md"))).toBe(true);
  });
});
