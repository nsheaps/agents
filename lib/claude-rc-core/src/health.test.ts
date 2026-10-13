import { describe, expect, test } from "bun:test";
import { assessTail, computeHealth, CrashLoopTracker, isIdle } from "./health";
import type { SessionProbe } from "./tmux";

const probe = (over: Partial<SessionProbe> = {}): SessionProbe => ({
  dead: false,
  pid: 1,
  lastActivity: 1000,
  attached: 0,
  tail: [],
  ...over,
});

describe("assessTail", () => {
  test.each([
    ["Do you trust the files in this folder?"],
    ["  Quick safety check: trust this workspace  "],
    ["You are not logged in. Run `claude auth login`"],
    ["Error: OAuth token has expired"],
    ["authentication failed"],
    ["Press Enter to continue"],
  ])("flags %j", (line) => {
    expect(assessTail(["ok", line, "more"]).attention).toBe(line.trim());
  });
  test("ordinary output is not flagged", () => {
    expect(assessTail(["Remote Control active", "waiting for sessions", "connected"])).toEqual({});
    expect(assessTail([])).toEqual({});
  });
  test("reports the most recent matching line", () => {
    expect(assessTail(["not logged in", "fine", "Press Enter to continue"]).attention).toBe(
      "Press Enter to continue",
    );
  });
  test("only the last 30 lines count, so old prompts that scrolled away are ignored", () => {
    const old = ["Do you trust this folder?"];
    const filler = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    expect(assessTail([...old, ...filler])).toEqual({});
  });
  test("very long lines are clipped in the detail", () => {
    const r = assessTail(["not logged in " + "x".repeat(500)]);
    expect(r.attention!.length).toBeLessThanOrEqual(200);
  });
});

describe("CrashLoopTracker", () => {
  test("three exits within the window is a loop; fewer is not", () => {
    const t = new CrashLoopTracker(3, 600_000);
    expect(t.record("a", 0)).toBe(false);
    expect(t.record("a", 1000)).toBe(false);
    expect(t.record("a", 2000)).toBe(true);
    expect(t.looping("a", 3000)).toBe(true);
  });
  test("old exits age out; other repos are independent", () => {
    const t = new CrashLoopTracker(3, 600_000);
    t.record("a", 0);
    t.record("a", 1000);
    t.record("a", 2000);
    expect(t.looping("a", 700_000)).toBe(false);
    expect(t.looping("b", 0)).toBe(false);
  });
  test("reset clears a repo", () => {
    const t = new CrashLoopTracker(2, 1000);
    t.record("a", 0);
    t.record("a", 1);
    t.reset("a");
    expect(t.looping("a", 2)).toBe(false);
  });
});

describe("isIdle", () => {
  test("idle needs nobody attached and quiet for the threshold", () => {
    expect(isIdle(probe({ lastActivity: 0 }), 120_000, 120_000)).toBe(true);
    expect(isIdle(probe({ lastActivity: 1 }), 120_000, 120_000)).toBe(false);
    expect(isIdle(probe({ lastActivity: 0, attached: 1 }), 999_999, 120_000)).toBe(false);
  });
  test("unknown activity is never treated as idle", () => {
    expect(isIdle({ attached: 0 }, 1e9, 1)).toBe(false);
  });
  test("a zero threshold means idle as soon as nobody is attached", () => {
    expect(isIdle(probe({ lastActivity: 5000 }), 5000, 0)).toBe(true);
  });
});

describe("computeHealth", () => {
  const base = { terminal: "tmux" as const, running: true, crashLoop: false };
  test("ok", () => {
    expect(computeHealth({ ...base, probe: probe({ tail: ["fine"] }) })).toMatchObject({
      state: "ok",
      tail: ["fine"],
      attached: 0,
      lastActivity: 1000,
    });
  });
  test("service not running -> down", () => {
    expect(computeHealth({ ...base, running: false, probe: null }).state).toBe("down");
  });
  test("running but no session -> down", () => {
    const h = computeHealth({ ...base, probe: null });
    expect(h.state).toBe("down");
    expect(h.detail).toContain("session");
  });
  test("dead pane -> down with the exit status", () => {
    const h = computeHealth({ ...base, probe: probe({ dead: true, exitStatus: 7 }) });
    expect(h).toMatchObject({ state: "down" });
    expect(h.detail).toContain("7");
  });
  test("attention beats ok and carries the line", () => {
    const h = computeHealth({ ...base, probe: probe({ tail: ["x", "not logged in"] }) });
    expect(h).toMatchObject({ state: "attention", detail: "not logged in" });
  });
  test("crash loop beats attention", () => {
    expect(
      computeHealth({ ...base, crashLoop: true, probe: probe({ tail: ["not logged in"] }) }).state,
    ).toBe("crash-loop");
  });
  test("pty mode only knows liveness", () => {
    expect(computeHealth({ ...base, terminal: "pty", probe: null }).state).toBe("unknown");
    expect(computeHealth({ ...base, terminal: "pty", running: false, probe: null }).state).toBe(
      "down",
    );
  });
});
