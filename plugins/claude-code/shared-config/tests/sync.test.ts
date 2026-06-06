/**
 * Hermetic tests for the shared-config orchestrator — no network.
 *
 * Builds local fixture git repos, runs runSync() for separate "projects", and
 * asserts the clone + symlink layout, source-side sourceDir override, the
 * uses:-style subpath, source union, resourceTypes honoring, idempotency, and
 * the cross-project single-realpath dedup property.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  dedupSources,
  normalizeSource,
  parseEnvFile,
  parseRepoRef,
  runSync,
} from "../src/index.ts";

let WORK: string;
let GIT_BASE: string;
let DATA: string;

function gitInit(dir: string): void {
  const run = (args: string[]) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.t"]);
  run(["config", "user.name", "t"]);
  run(["config", "commit.gpgsign", "false"]);
  run(["config", "tag.gpgsign", "false"]);
  run(["add", "-A"]);
  spawnSync("git", ["-C", dir, "commit", "-q", "--no-gpg-sign", "-m", "init"], {
    encoding: "utf8",
  });
}

function write(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function runProject(name: string, settingsYaml: string, env: Record<string, string> = {}): string {
  const proj = join(WORK, name);
  write(join(proj, ".claude", "shared-config.settings.yaml"), settingsYaml);
  const prev: Record<string, string | undefined> = {};
  const merged = { SHARED_CONFIG_TEST_GIT_BASE: GIT_BASE, ...env };
  for (const [k, v] of Object.entries(merged)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    runSync(proj, DATA);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  return proj;
}

beforeAll(() => {
  WORK = mkdtempSync(join(tmpdir(), "shared-config-"));
  GIT_BASE = join(WORK, "remotes");
  DATA = join(WORK, "data");
  mkdirSync(GIT_BASE, { recursive: true });
  mkdirSync(DATA, { recursive: true });

  // Fixture A: resources at repo root.
  const A = join(GIT_BASE, "acme", "shared-a");
  write(join(A, "rules", "alpha.md"), "# rule alpha\n");
  write(join(A, "skills", "demo-skill", "SKILL.md"), "---\nname: demo-skill\n---\ndemo\n");
  write(join(A, "commands", "do-thing.md"), "# cmd\n");
  write(join(A, "agents", "helper.md"), "# agent\n");
  gitInit(A);

  // Fixture B: resources under .claude/ (source-side roots override).
  const B = join(GIT_BASE, "acme", "shared-b");
  write(join(B, ".claude", "rules", "beta.md"), "# rule beta\n");
  write(join(B, ".claude", "skills", "b-skill", "SKILL.md"), "---\nname: b-skill\n---\n");
  write(join(B, ".claude", "shared-config-roots.yaml"), "sourceDir: .claude\n");
  gitInit(B);
});

afterAll(() => {
  if (WORK) rmSync(WORK, { recursive: true, force: true });
});

test("parseRepoRef handles org/repo and subpaths", () => {
  expect(parseRepoRef("acme/repo")).toEqual({ org: "acme", repo: "repo", subpath: "" });
  expect(parseRepoRef("acme/repo/a/b")).toEqual({ org: "acme", repo: "repo", subpath: "a/b" });
  expect(parseRepoRef("acme/repo@main")).toEqual({ org: "acme", repo: "repo", subpath: "" });
  expect(() => parseRepoRef("nope")).toThrow();
});

test("normalizeSource + dedupSources", () => {
  expect(normalizeSource("a/b/c/d")).toEqual({
    org: "a",
    repo: "b",
    sourceDir: "c/d",
    targetDir: null,
  });
  expect(normalizeSource({ repo: "a/b", sourceDir: "x", targetDir: ".claude" })).toEqual({
    org: "a",
    repo: "b",
    sourceDir: "x",
    targetDir: ".claude",
  });
  expect(dedupSources(["a/b", "a/b", "a/b/c"]).length).toBe(2);
});

test("parseEnvFile resolves exports and follows source lines", () => {
  const f = join(WORK, "env_main");
  const child = join(WORK, "env_child");
  writeFileSync(child, 'export GH_TOKEN="abc123"\nexport GITHUB_TOKEN_FILE=/tmp/tok\n');
  writeFileSync(f, `source ${child}\nexport OTHER=1\n`);
  const env = parseEnvFile(f);
  expect(env.GH_TOKEN).toBe("abc123");
  expect(env.GITHUB_TOKEN_FILE).toBe("/tmp/tok");
  expect(env.OTHER).toBe("1");
});

test("links sources into a project (root + sourceDir override) and dedups across projects", () => {
  const yaml =
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - acme/shared-a\n  - acme/shared-b\n";
  const projA = runProject("projA", yaml);
  const projB = runProject("projB", yaml);

  // one clone per source repo
  expect(existsSync(join(DATA, "shared-configs", "sources", "acme", "shared-a", ".git"))).toBe(
    true,
  );
  expect(existsSync(join(DATA, "shared-configs", "sources", "acme", "shared-b", ".git"))).toBe(
    true,
  );

  for (const t of ["rules", "skills", "commands", "agents"]) {
    expect(existsSync(join(projA, ".claude", t, ".shared"))).toBe(true);
  }
  expect(existsSync(join(projA, ".claude", "rules", ".shared", "acme__shared-a", "alpha.md"))).toBe(
    true,
  );
  // sourceDir override: shared-b's .claude/rules is what gets linked
  expect(existsSync(join(projA, ".claude", "rules", ".shared", "acme__shared-b", "beta.md"))).toBe(
    true,
  );
  expect(
    existsSync(
      join(projA, ".claude", "skills", ".shared", "acme__shared-a", "demo-skill", "SKILL.md"),
    ),
  ).toBe(true);

  // dedup hypothesis: same realpath from both projects, inside the source clone
  const ra = realpathSync(join(projA, ".claude", "rules", ".shared", "acme__shared-a", "alpha.md"));
  const rb = realpathSync(join(projB, ".claude", "rules", ".shared", "acme__shared-a", "alpha.md"));
  expect(ra).toBe(rb);
  expect(ra).toBe(
    realpathSync(join(DATA, "shared-configs", "sources", "acme", "shared-a", "rules", "alpha.md")),
  );

  // idempotent rerun
  runProject("projA", yaml);
  expect(existsSync(join(projA, ".claude", "rules", ".shared", "acme__shared-a", "alpha.md"))).toBe(
    true,
  );
});

test("uses:-style subpath selects the source dir", () => {
  const projC = runProject(
    "projC",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - acme/shared-b/.claude\n",
  );
  expect(
    existsSync(join(projC, ".claude", "rules", ".shared", "acme__shared-b__.claude", "beta.md")),
  ).toBe(true);
});

test("resourceTypes is honored (only linked types get a .shared)", () => {
  const projE = runProject(
    "projE",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nresourceTypes: [rules]\nsources:\n  - acme/shared-a\n",
  );
  expect(existsSync(join(projE, ".claude", "rules", ".shared"))).toBe(true);
  expect(existsSync(join(projE, ".claude", "skills", ".shared"))).toBe(false);
});
