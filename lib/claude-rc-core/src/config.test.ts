import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, parseConfig } from "./config";

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
