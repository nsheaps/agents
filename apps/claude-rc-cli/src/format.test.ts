import { describe, expect, test } from "bun:test";
import { formatStatus } from "./format";

const st: any = {
  pid: 10,
  version: "1.2.3",
  phase: "ready",
  startedAt: "2026-01-01T00:00:00.000Z",
  supervisor: { kind: "systemd", reason: "ok" },
  configPath: "/h/rc.json",
  repos: [
    { name: "web", path: "/r/web", spawn: "worktree", state: "running", pid: 5, restarts: 2 },
    {
      name: "api",
      path: "/r/api",
      spawn: "same-dir",
      state: "failed",
      error: "repo path does not exist: /r/api",
    },
    { name: "old", path: "/r/old", spawn: "worktree", state: "stopped", stoppedByUser: true },
  ],
};
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("formatStatus", () => {
  test("header shows version, pid, supervisor", () => {
    const o = formatStatus(st, false);
    expect(o).toContain("claude-rc-daemon 1.2.3");
    expect(o).toContain("pid 10");
    expect(o).toContain("systemd");
  });
  test("table has a row per repo with state, pid, restarts", () => {
    const o = formatStatus(st, false);
    expect(o).toMatch(/web\s+running\s+5\s+2\s+worktree\s+\/r\/web/);
    expect(o).toMatch(/api\s+failed/);
    expect(o).toContain("stopped (manual)");
  });
  test("errors are listed under the table", () => {
    expect(formatStatus(st, false)).toContain("api: repo path does not exist: /r/api");
  });
  test("surfaces configError, claudeError, upgrade failure", () => {
    const o = formatStatus(
      {
        ...st,
        configError: "bad json",
        claudeError: "claude not found",
        upgrade: { ok: false, output: "net down", at: "x" },
      },
      false,
    );
    expect(o).toContain("config error: bad json");
    expect(o).toContain("claude not found");
    expect(o).toContain("claude upgrade failed: net down");
  });
  test("no repos -> hint to add one", () => {
    expect(formatStatus({ ...st, repos: [] }, false)).toContain("claude-rc add");
  });
  test("color only when requested", () => {
    expect(formatStatus(st, false)).not.toContain("\x1b[");
    expect(formatStatus(st, true)).toContain("\x1b[");
    expect(strip(formatStatus(st, true))).toBe(formatStatus(st, false));
  });
});

describe("formatStatus tmux + updates", () => {
  const base = {
    pid: 1,
    version: "1.0.0",
    phase: "ready",
    startedAt: "",
    supervisor: { kind: "inproc", reason: "" },
    configPath: "/c",
  };
  const repo = {
    name: "a",
    path: "/p",
    spawn: "worktree",
    state: "running",
    pid: 2,
    attach: { socket: "/s", command: "tmux -S /s attach -t rc" },
  };
  test("flags unhealthy sessions, pending restarts and available updates", () => {
    const out = formatStatus(
      {
        ...base,
        repos: [{ ...repo, health: { state: "attention", detail: "trust prompt" } }],
        updates: { available: { claude: "9.9.9", claudeRc: "8.8.8" }, pendingRestart: ["a"] },
      },
      false,
    );
    expect(out).toContain("running (attention)");
    expect(out).toContain("a: attention — trust prompt");
    expect(out).toContain("Claude Code 9.9.9 available");
    expect(out).toContain("brew upgrade claude-rc");
    expect(out).toContain("restarting when idle: a");
    expect(out).toContain("claude-rc attach <name>");
  });
  test("a healthy session looks plain", () => {
    const out = formatStatus({ ...base, repos: [{ ...repo, health: { state: "ok" } }] }, false);
    expect(out).toContain("running ");
    expect(out).not.toContain("(ok)");
  });
});
