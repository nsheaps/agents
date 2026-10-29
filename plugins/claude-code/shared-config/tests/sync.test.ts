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
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  dedupSources,
  ensureSymlink,
  normalizeSource,
  parseEnvFile,
  parseRepoRef,
  resolveToken,
  runSync,
  toolArgv,
} from "../src/index.ts";

function isLink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

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

  // Fixture A: resources at repo root (+ a settings fragment for mergeSettings).
  const A = join(GIT_BASE, "acme", "shared-a");
  write(join(A, "rules", "alpha.md"), "# rule alpha\n");
  write(join(A, "skills", "demo-skill", "SKILL.md"), "---\nname: demo-skill\n---\ndemo\n");
  write(join(A, "commands", "do-thing.md"), "# cmd\n");
  write(join(A, "agents", "helper.md"), "# agent\n");
  write(
    join(A, "settings", "settings.json"),
    JSON.stringify({ env: { FROM_SHARED: "1", SHARED_ONLY: "yes" } }),
  );
  gitInit(A);

  // Fixture: org-level bootstrap config repo (referenced via the upstream env).
  const BOOT = join(GIT_BASE, "org", "bootstrap");
  write(join(BOOT, "config", "shared-config.settings.yaml"), "sources:\n  - acme/shared-a\n");
  gitInit(BOOT);

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

test("toolArgv: PATH first, mise delegation when absent, else bare", () => {
  const dir = mkdtempSync(join(tmpdir(), "scfg-tool-"));
  writeFileSync(join(dir, "mise"), "#!/bin/sh\n");
  chmodSync(join(dir, "mise"), 0o755);
  const orig = process.env.PATH;
  try {
    // git present on the real PATH -> use it directly
    process.env.PATH = orig;
    expect(toolArgv("git", ["clone", "x"])).toEqual(["git", ["clone", "x"]]);

    // git absent, mise present in dir -> delegate to mise exec
    process.env.PATH = dir;
    expect(toolArgv("git", ["clone", "x"])).toEqual([
      "mise",
      ["exec", "git@latest", "--", "git", "clone", "x"],
    ]);

    // neither present -> bare name (fails loudly downstream)
    process.env.PATH = join(dir, "nonexistent");
    expect(toolArgv("jsonnet", ["f.jsonnet"])).toEqual(["jsonnet", ["f.jsonnet"]]);
  } finally {
    process.env.PATH = orig;
  }
});

test("resourceTypes is honored (only linked types get a .shared)", () => {
  const projE = runProject(
    "projE",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nresourceTypes: [rules]\nsources:\n  - acme/shared-a\n",
  );
  expect(existsSync(join(projE, ".claude", "rules", ".shared"))).toBe(true);
  expect(existsSync(join(projE, ".claude", "skills", ".shared"))).toBe(false);
});

test("upstream bootstrap ($AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM) contributes sources", () => {
  // Project declares no sources of its own; the upstream config supplies them.
  const proj = runProject("projUp", "enabled: true\nwaitForTokenTimeoutSeconds: 0\n", {
    AGENT_PLUGIN_SHARED_CONFIG_UPSTREAM: "org/bootstrap/config",
  });
  expect(existsSync(join(proj, ".claude", "rules", ".shared", "acme__shared-a", "alpha.md"))).toBe(
    true,
  );
});

test("per-source targetDir overrides where .shared is placed", () => {
  const proj = runProject(
    "projTD",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - repo: acme/shared-a\n    targetDir: .altclaude\n",
  );
  expect(
    existsSync(join(proj, ".altclaude", "rules", ".shared", "acme__shared-a", "alpha.md")),
  ).toBe(true);
  expect(existsSync(join(proj, ".claude", "rules", ".shared"))).toBe(false);
});

test("mergeSettings merges source fragments with project winning + backup", () => {
  const proj = join(WORK, "projMerge");
  mkdirSync(join(proj, ".claude"), { recursive: true });
  writeFileSync(
    join(proj, ".claude", "settings.json"),
    JSON.stringify({ env: { FROM_SHARED: "overridden", PROJECT_ONLY: "p" } }),
  );
  runProject(
    "projMerge",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nmergeSettings: true\nsources:\n  - acme/shared-a\n",
  );
  const merged = JSON.parse(readFileSync(join(proj, ".claude", "settings.json"), "utf8"));
  expect(merged.env.SHARED_ONLY).toBe("yes"); // contributed by the shared fragment
  expect(merged.env.FROM_SHARED).toBe("overridden"); // project value wins on conflict
  expect(merged.env.PROJECT_ONLY).toBe("p");
  expect(existsSync(join(proj, ".claude", "settings.json.shared-config.bak"))).toBe(true);
});

test("removing a custom-targetDir source cleans up its orphaned .shared", () => {
  const proj = runProject(
    "projOrphan",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - repo: acme/shared-a\n    targetDir: .orphanbase\n",
  );
  expect(isLink(join(proj, ".orphanbase", "rules", ".shared"))).toBe(true);
  // Re-run without the custom-targetDir source: its orphaned link is removed.
  runProject(
    "projOrphan",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - acme/shared-a\n",
  );
  expect(existsSync(join(proj, ".orphanbase", "rules", ".shared"))).toBe(false);
  expect(isLink(join(proj, ".orphanbase", "rules", ".shared"))).toBe(false);
});

test("ensureSymlink replaces a dangling symlink instead of throwing EEXIST", () => {
  const d = mkdtempSync(join(tmpdir(), "scfg-es-"));
  const target = join(d, "realdir");
  mkdirSync(target);
  const link = join(d, "link");
  symlinkSync(join(d, "missing-target"), link); // dangling
  expect(existsSync(link)).toBe(false); // confirms dangling
  expect(ensureSymlink(link, target)).toBe(true);
  expect(realpathSync(link)).toBe(realpathSync(target));
});

test("withLock takes over a stale lock and still syncs", () => {
  const lockDir = join(DATA, "shared-configs", ".sync.lock");
  mkdirSync(lockDir, { recursive: true });
  const old = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago (> 3 min stale)
  utimesSync(lockDir, old, old);
  const proj = runProject(
    "projLockStale",
    "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - acme/shared-a\n",
  );
  expect(existsSync(join(proj, ".claude", "rules", ".shared", "acme__shared-a", "alpha.md"))).toBe(
    true,
  );
  expect(existsSync(lockDir)).toBe(false); // released after the run
});

test("withLock skips the run when a fresh lock is held", () => {
  const lockDir = join(DATA, "shared-configs", ".sync.lock");
  mkdirSync(lockDir, { recursive: true }); // fresh (held by a "concurrent" run)
  process.env.SHARED_CONFIG_LOCK_WAIT_MS = "300"; // don't wait the full 30s
  try {
    const proj = runProject(
      "projLockHeld",
      "enabled: true\nwaitForTokenTimeoutSeconds: 0\nsources:\n  - acme/shared-a\n",
    );
    expect(existsSync(join(proj, ".claude", "rules", ".shared"))).toBe(false); // skipped
  } finally {
    delete process.env.SHARED_CONFIG_LOCK_WAIT_MS;
    rmSync(lockDir, { recursive: true, force: true });
  }
});

test("resolveToken reads the github-app token from CLAUDE_ENV_FILE", () => {
  const envF = join(WORK, "tok_env");
  writeFileSync(envF, 'export GH_TOKEN="ghs_xyz"\nexport GITHUB_TOKEN_FILE=/run/tok\n');
  const keys = ["GH_TOKEN", "GITHUB_TOKEN", "GITHUB_TOKEN_FILE", "CLAUDE_ENV_FILE"] as const;
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  try {
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN_FILE;
    process.env.CLAUDE_ENV_FILE = envF;
    expect(resolveToken(2)).toBe("ghs_xyz");
    expect(process.env.GH_TOKEN).toBe("ghs_xyz");

    // No env file + timeout 0 -> falls back to an ambient token.
    delete process.env.GITHUB_TOKEN_FILE;
    delete process.env.CLAUDE_ENV_FILE;
    process.env.GH_TOKEN = "ambient";
    expect(resolveToken(0)).toBe("ambient");
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  }
});
