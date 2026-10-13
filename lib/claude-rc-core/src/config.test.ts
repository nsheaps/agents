import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveRepoName, loadConfig, parseConfig } from "./config";

const ok = (v: unknown) => {
  const r = parseConfig(v);
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.config;
};
const errs = (v: unknown) => {
  const r = parseConfig(v);
  if (r.ok) throw new Error("expected failure");
  return r.errors.join("\n");
};

describe("parseConfig", () => {
  test("accepts the documented shape and applies defaults", () => {
    const c = ok({ repos: [{ name: "a", path: "/abs/a" }] });
    expect(c.spawn).toBe("worktree");
    expect(c.env).toEqual({});
    expect(c.autoTrust).toBe(true);
    expect(c.repos).toEqual([{ name: "a", path: "/abs/a" }]);
  });

  test("keeps spawn, env, autoTrust and per-repo overrides", () => {
    const c = ok({
      repos: [{ name: "a", path: "/a", spawn: "same-dir", env: { X: "1" } }],
      spawn: "session",
      env: { FOO: "bar" },
      autoTrust: false,
    });
    expect(c.spawn).toBe("session");
    expect(c.env).toEqual({ FOO: "bar" });
    expect(c.autoTrust).toBe(false);
    expect(c.repos[0]).toEqual({ name: "a", path: "/a", spawn: "same-dir", env: { X: "1" } });
  });

  test("notifications and updates default to everything on; ui to the default port", () => {
    const c = ok({ repos: [] });
    expect(c.notifications).toEqual({ enabled: true, onStart: true, onExit: true });
    expect(c.updates).toEqual({ claudeRc: true, claude: true });
    expect(c.ui).toEqual({ port: 47474 });
  });

  test("notifications, updates and ui can be set partially", () => {
    const c = ok({
      repos: [],
      notifications: { onExit: false },
      updates: { claude: false },
      ui: { port: 0 },
    });
    expect(c.notifications).toEqual({ enabled: true, onStart: true, onExit: false });
    expect(c.updates).toEqual({ claudeRc: true, claude: false });
    expect(c.ui.port).toBe(0);
  });

  test.each([
    [{ repos: [], notifications: true }, "notifications"],
    [{ repos: [], notifications: { enabled: "no" } }, "notifications.enabled"],
    [{ repos: [], updates: { claude: 1 } }, "updates.claude"],
    [{ repos: [], ui: { port: 70000 } }, "ui.port"],
    [{ repos: [], ui: { port: "80" } }, "ui.port"],
  ])("rejects %j mentioning %s", (input, needle) => {
    expect(errs(input)).toContain(needle as string);
  });

  test.each([["a\nb"], ["a\0b"], ["a\x7fb"]])(
    "rejects control characters in env values (%j)",
    (v) => {
      expect(errs({ repos: [], env: { K: v } })).toContain("control character");
    },
  );
  test("allows tabs and unicode in env values", () => {
    expect(ok({ repos: [], env: { K: "a\tb é" } }).env.K).toBe("a\tb é");
  });

  test("empty repos list is valid", () => {
    expect(ok({ repos: [] }).repos).toEqual([]);
  });

  test.each([
    [null, "object"],
    [[], "object"],
    [{}, "repos"],
    [{ repos: "x" }, "repos"],
    [{ repos: [{ name: "a" }] }, "path"],
    [{ repos: [{ path: "/a" }] }, "name"],
    [{ repos: [{ name: "a", path: "relative/p" }] }, "absolute"],
    [{ repos: [{ name: "bad name", path: "/a" }] }, "name"],
    [{ repos: [{ name: "../x", path: "/a" }] }, "name"],
    [{ repos: [{ name: "", path: "/a" }] }, "name"],
    [{ repos: [], spawn: "nope" }, "spawn"],
    [{ repos: [], env: { "BAD-KEY": "x" } }, "env"],
    [{ repos: [], env: { A: 1 } }, "env"],
    [{ repos: [], autoTrust: "yes" }, "autoTrust"],
  ])("rejects %j mentioning %s", (input, needle) => {
    expect(errs(input)).toContain(needle as string);
  });

  test("rejects duplicate repo names, naming the duplicate", () => {
    const e = errs({
      repos: [
        { name: "a", path: "/a" },
        { name: "a", path: "/b" },
      ],
    });
    expect(e).toContain("duplicate");
    expect(e).toContain('"a"');
  });

  test("reports every error, not just the first", () => {
    const e = errs({ repos: [{ name: "x y", path: "rel" }], spawn: "nope" });
    expect(e.split("\n").length).toBeGreaterThanOrEqual(3);
  });
});

describe("loadConfig", () => {
  const dir = mkdtempSync(join(tmpdir(), "rc-cfg-"));
  test("missing file -> ok with empty repos and missing=true", () => {
    const r = loadConfig(join(dir, "nope.json"));
    expect(r.ok && r.missing).toBe(true);
    expect(r.ok && r.config.repos).toEqual([]);
  });
  test("invalid JSON -> error naming the file", () => {
    const p = join(dir, "bad.json");
    writeFileSync(p, "{oops");
    const r = loadConfig(p);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toContain("bad.json");
  });
  test("valid file loads", () => {
    const p = join(dir, "good.json");
    writeFileSync(p, JSON.stringify({ repos: [{ name: "a", path: "/a" }] }));
    const r = loadConfig(p);
    expect(r.ok && r.config.repos.length).toBe(1);
  });
});

describe("deriveRepoName", () => {
  test.each([
    ["/home/a/My Project", "My-Project"],
    ["/r/my-repo/", "my-repo"],
    ["/r/.hidden", "hidden"],
    ["/r/_x", "x"],
    ["/r/a b  c", "a-b-c"],
    ["/", "repo"],
  ])("%s -> %s", (p, want) => {
    expect(deriveRepoName(p)).toBe(want);
    expect(ok({ repos: [{ name: deriveRepoName(p), path: "/abs" }] }).repos.length).toBe(1);
  });
});
