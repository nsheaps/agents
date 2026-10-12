import { describe, expect, test } from "bun:test";
import { getPaths } from "./paths";

describe("getPaths", () => {
  test("defaults under ~/.claude", () => {
    const p = getPaths({}, "/home/u");
    expect(p.configPath).toBe("/home/u/.claude/daemon/rc.json");
    expect(p.claudeJson).toBe("/home/u/.claude.json");
    expect(p.logDir).toBe("/home/u/.claude/daemon/logs");
    expect(p.runDir).toBe("/home/u/.claude/daemon/run");
    expect(p.socketPath).toBe("/home/u/.claude/daemon/rc.sock");
    expect(p.statePath).toBe("/home/u/.claude/daemon/state.json");
  });
  test("CLAUDE_RC_HOME overrides the daemon dir; CLAUDE_CONFIG_DIR moves ~/.claude.json", () => {
    const p = getPaths({ CLAUDE_RC_HOME: "/x/d", CLAUDE_CONFIG_DIR: "/c" }, "/home/u");
    expect(p.configPath).toBe("/x/d/rc.json");
    expect(p.claudeJson).toBe("/c/.claude.json");
  });
  test("falls back to a short temp socket when the path would exceed the unix limit", () => {
    const long = "/home/" + "u".repeat(120);
    const p = getPaths({ TMPDIR: "/tmp" }, long);
    expect(p.socketPath.length).toBeLessThan(100);
    expect(p.socketPath.startsWith("/tmp/")).toBe(true);
  });
});
