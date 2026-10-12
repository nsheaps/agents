import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addRepo, removeRepo } from "./config-edit";

const file = () => join(mkdtempSync(join(tmpdir(), "rc-ce-")), "sub", "rc.json");
const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));

describe("addRepo", () => {
  test("creates the file (and parent dirs) when absent", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    expect(read(f).repos).toEqual([{ name: "a", path: "/r/a" }]);
  });
  test("preserves other keys and existing repos", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    writeFileSync(f, JSON.stringify({ ...read(f), spawn: "same-dir", env: { X: "1" }, custom: 5 }));
    addRepo(f, { name: "b", path: "/r/b", spawn: "session" });
    const j = read(f);
    expect(j.spawn).toBe("same-dir");
    expect(j.custom).toBe(5);
    expect(j.repos.map((r: any) => r.name)).toEqual(["a", "b"]);
    expect(j.repos[1].spawn).toBe("session");
  });
  test("duplicate name is rejected and file untouched", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    const before = readFileSync(f, "utf8");
    expect(() => addRepo(f, { name: "a", path: "/r/other" })).toThrow(/duplicate/);
    expect(readFileSync(f, "utf8")).toBe(before);
  });
  test("relative path / bad name rejected", () => {
    const f = file();
    expect(() => addRepo(f, { name: "a", path: "rel" })).toThrow(/absolute/);
    expect(() => addRepo(f, { name: "a b", path: "/x" })).toThrow(/name/);
    expect(existsSync(f)).toBe(false);
  });
  test("refuses to edit an invalid existing file", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    writeFileSync(f, "{oops");
    expect(() => addRepo(f, { name: "b", path: "/r/b" })).toThrow(/invalid JSON/);
    expect(readFileSync(f, "utf8")).toBe("{oops");
  });
});

describe("removeRepo", () => {
  test("removes by name", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    addRepo(f, { name: "b", path: "/r/b" });
    removeRepo(f, "a");
    expect(read(f).repos.map((r: any) => r.name)).toEqual(["b"]);
  });
  test("unknown name lists configured ones", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    expect(() => removeRepo(f, "zzz")).toThrow(/unknown repo "zzz".*a/);
  });
  test("missing file -> clear error", () => {
    expect(() => removeRepo(file(), "a")).toThrow(/no repos configured/);
  });
});
