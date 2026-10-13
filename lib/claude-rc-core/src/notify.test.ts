import { describe, expect, test } from "bun:test";
import { createNotifier, escapeAppleScript } from "./notify";
import type { Exec } from "./supervisor-types";

const rec = (have: string[] = []) => {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    return { code: 0, stdout: "", stderr: "" };
  };
  return { exec, calls, which: (n: string) => (have.includes(n) ? `/usr/bin/${n}` : null) };
};

describe("escapeAppleScript", () => {
  test("escapes quotes and backslashes so text cannot break out of the string", () => {
    expect(escapeAppleScript('a"b\\c')).toBe('a\\"b\\\\c');
    expect(escapeAppleScript('x" & (do shell script "id") & "')).toBe(
      'x\\" & (do shell script \\"id\\") & \\"',
    );
  });
  test("newlines become spaces", () => {
    expect(escapeAppleScript("a\nb")).toBe("a b");
  });
});

describe("createNotifier", () => {
  test("macOS: osascript display notification, text passed as one argv element", async () => {
    const r = rec();
    const n = await createNotifier("darwin", r.exec, r.which);
    await n.notify({ title: 'T"', body: "B" });
    expect(r.calls).toEqual([["osascript", "-e", 'display notification "B" with title "T\\""']]);
    expect(n.kind).toBe("osascript");
  });
  test("linux: notify-send with -- guard when present", async () => {
    const r = rec(["notify-send"]);
    const n = await createNotifier("linux", r.exec, r.which);
    await n.notify({ title: "-T", body: "B" });
    expect(r.calls.at(-1)).toEqual(["notify-send", "-a", "claude-rc", "--", "-T", "B"]);
    expect(n.kind).toBe("notify-send");
  });
  test("linux without notify-send: kind none, notify is a no-op and never throws", async () => {
    const r = rec([]);
    const n = await createNotifier("linux", r.exec, r.which);
    expect(n.kind).toBe("none");
    await n.notify({ title: "t", body: "b" });
    expect(r.calls.filter((c) => c[0] === "notify-send")).toEqual([]);
  });
  test("a failing notifier does not throw", async () => {
    const exec: Exec = async () => ({ code: 1, stdout: "", stderr: "boom" });
    const n = await createNotifier("darwin", exec);
    await n.notify({ title: "t", body: "b" });
  });
});
