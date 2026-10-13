import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addRepo, removeRepo, updateSettings } from "./config-edit";

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

describe("updateSettings", () => {
  test("merges nested notifications/updates/ui, replaces env, keeps repos and unknown keys", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    writeFileSync(f, JSON.stringify({ ...read(f), custom: 5, notifications: { onExit: false } }));
    updateSettings(f, {
      spawn: "session",
      env: { X: "1" },
      autoTrust: false,
      notifications: { onStart: false },
      updates: { claude: false },
      ui: { port: 5000 },
    });
    const j = read(f);
    expect(j.spawn).toBe("session");
    expect(j.env).toEqual({ X: "1" });
    expect(j.autoTrust).toBe(false);
    expect(j.notifications).toEqual({ onExit: false, onStart: false });
    expect(j.updates).toEqual({ claude: false });
    expect(j.ui).toEqual({ port: 5000 });
    expect(j.custom).toBe(5);
    expect(j.repos.length).toBe(1);
  });
  test("rejects unknown keys, naming them, without touching the file", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    const before = readFileSync(f, "utf8");
    expect(() => updateSettings(f, { repos: [] } as any)).toThrow("repos");
    expect(() => updateSettings(f, { bogus: 1 } as any)).toThrow("bogus");
    expect(readFileSync(f, "utf8")).toBe(before);
  });
  test("rejects invalid values via the normal validation, leaving the file untouched", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/r/a" });
    const before = readFileSync(f, "utf8");
    expect(() => updateSettings(f, { spawn: "nope" })).toThrow("spawn");
    expect(() => updateSettings(f, { ui: { port: 99999 } })).toThrow("ui.port");
    expect(() => updateSettings(f, { notifications: true as any })).toThrow("notifications");
    expect(readFileSync(f, "utf8")).toBe(before);
  });
  test("creates the file when absent", () => {
    const f = file();
    updateSettings(f, { spawn: "same-dir" });
    expect(read(f)).toEqual({ repos: [], spawn: "same-dir" });
  });
});

describe("file mode", () => {
  test("new rc.json is private (0600)", () => {
    const f = file();
    addRepo(f, { name: "a", path: "/a" });
    expect(statSync(f).mode & 0o777).toBe(0o600);
  });

  test("an existing mode chosen by the user survives edits", () => {
    const f = file();
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify({ repos: [] }));
    chmodSync(f, 0o640);
    addRepo(f, { name: "a", path: "/a" });
    expect(statSync(f).mode & 0o777).toBe(0o640);
    removeRepo(f, "a");
    expect(statSync(f).mode & 0o777).toBe(0o640);
  });
});
