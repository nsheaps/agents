import { describe, expect, test } from "bun:test";
import {
  attachArgv,
  tmuxRunPrefix,
  attachCommandLine,
  probeSession,
  tmuxConf,
  tmuxSocketFor,
  TMUX_SESSION,
} from "./tmux";
import type { Exec } from "./supervisor-types";

describe("tmuxSocketFor", () => {
  test("lives under run/tmux, one socket per repo", () => {
    const p = { runDir: "/home/u/.claude/daemon/run" };
    expect(tmuxSocketFor(p, {}, "api")).toBe("/home/u/.claude/daemon/run/tmux/api.sock");
    expect(tmuxSocketFor(p, {}, "web")).not.toBe(tmuxSocketFor(p, {}, "api"));
  });
  test("a path too long for a unix socket falls back to a short, stable, per-name path", () => {
    const p = { runDir: "/very/long/" + "x".repeat(120) + "/run" };
    const a = tmuxSocketFor(p, { TMPDIR: "/var/tmp" }, "api");
    expect(a.length).toBeLessThan(100);
    expect(a).toStartWith("/var/tmp/claude-rc-");
    expect(tmuxSocketFor(p, { TMPDIR: "/var/tmp" }, "api")).toBe(a);
    expect(tmuxSocketFor(p, { TMPDIR: "/var/tmp" }, "web")).not.toBe(a);
  });
});

describe("tmuxConf", () => {
  const c = tmuxConf("my-repo");
  test("keeps dead panes (so the exit status is readable) and sizes to the latest client", () => {
    expect(c).toContain("set -g remain-on-exit on");
    expect(c).toContain("set -g window-size latest");
    expect(c).toContain("set -g mouse on");
  });
  test("names the repo in the status line, safely quoted", () => {
    expect(c).toContain("claude-rc: my-repo");
    expect(tmuxConf('a"b')).not.toContain('a"b'); // quotes never reach the config unescaped
  });
});

describe("attach helpers", () => {
  test("argv targets the private socket and session", () => {
    expect(attachArgv("/usr/bin/tmux", "/s/a.sock")).toEqual([
      "/usr/bin/tmux",
      "-S",
      "/s/a.sock",
      "attach",
      "-t",
      TMUX_SESSION,
    ]);
  });
  test("the display command line is copy-pasteable, quoting spaces", () => {
    expect(attachCommandLine("/s/a.sock")).toBe("tmux -S /s/a.sock attach -t rc");
    expect(attachCommandLine("/my dir/a.sock")).toBe("tmux -S '/my dir/a.sock' attach -t rc");
    expect(attachCommandLine("/o'neil/a.sock")).toBe("tmux -S '/o'\\''neil/a.sock' attach -t rc");
  });
});

function fakeTmux(panes: string | null, capture = "") {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    if (argv.includes("list-panes"))
      return panes === null
        ? { code: 1, stdout: "", stderr: "no server running" }
        : { code: 0, stdout: panes + "\n", stderr: "" };
    if (argv.includes("capture-pane")) return { code: 0, stdout: capture, stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  return { exec, calls };
}

describe("probeSession", () => {
  test("alive pane: pid, activity (ms), attached clients, trimmed tail", async () => {
    const t = fakeTmux("0|||4242|1700000000|2", "one\ntwo\n\n\n");
    const p = await probeSession(t.exec, "tmux", "/s.sock");
    expect(p).toEqual({
      dead: false,
      pid: 4242,
      lastActivity: 1_700_000_000_000,
      attached: 2,
      tail: ["one", "two"],
    });
    expect(t.calls[0]).toEqual([
      "tmux",
      "-S",
      "/s.sock",
      "list-panes",
      "-t",
      "rc",
      "-F",
      "#{pane_dead}|#{pane_dead_status}|#{pane_dead_signal}|#{pane_pid}|#{window_activity}|#{session_attached}",
    ]);
  });
  test("dead pane carries the exit status", async () => {
    const t = fakeTmux("1|7||4242|1700000000|0", "boom");
    expect(await probeSession(t.exec, "tmux", "/s.sock")).toMatchObject({
      dead: true,
      exitStatus: 7,
      tail: ["boom"],
    });
  });
  test("a pane killed by a signal reports 128+signal", async () => {
    const t = fakeTmux("1||15|4242|1700000000|0", "");
    expect(await probeSession(t.exec, "tmux", "/s.sock")).toMatchObject({ exitStatus: 143 });
  });
  test.each(["TERM", "SIGTERM", "term"])("newer tmux prints the signal by name (%s)", async (n) => {
    const t = fakeTmux(`1||${n}|4242|1700000000|0`, "");
    expect(await probeSession(t.exec, "tmux", "/s.sock")).toMatchObject({ exitStatus: 143 });
  });
  test("tailLines 0 skips the capture call entirely", async () => {
    const t = fakeTmux("0|||1|1|0", "x");
    const p = await probeSession(t.exec, "tmux", "/s.sock", 0);
    expect(p!.tail).toEqual([]);
    expect(t.calls.some((c) => c.includes("capture-pane"))).toBe(false);
  });
  test("no server / no session -> null", async () => {
    expect(await probeSession(fakeTmux(null).exec, "tmux", "/s.sock")).toBeNull();
  });
  test("garbage output -> null rather than NaN fields", async () => {
    expect(await probeSession(fakeTmux("what").exec, "tmux", "/s.sock")).toBeNull();
  });
  test("tail is limited to the last N lines", async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `l${i}`).join("\n");
    const p = await probeSession(fakeTmux("0|||1|1|0", lines).exec, "tmux", "/s.sock", 5);
    expect(p!.tail).toEqual(["l95", "l96", "l97", "l98", "l99"]);
  });
  test("blank rows and tmux's dead-pane banner are dropped so short output is not pushed out", async () => {
    const screen = ["first", ...Array(30).fill(""), "Pane is dead (status 1, Tue)"].join("\n");
    const p = await probeSession(fakeTmux("1|1||1|1|0", screen).exec, "tmux", "/s.sock", 5);
    expect(p!.tail).toEqual(["first"]);
  });
  test("capture failing still reports the session, with an empty tail", async () => {
    const exec: Exec = async (argv) =>
      argv.includes("list-panes")
        ? { code: 0, stdout: "0|||9|1|0\n", stderr: "" }
        : { code: 1, stdout: "", stderr: "x" };
    expect(await probeSession(exec, "tmux", "/s.sock")).toMatchObject({ pid: 9, tail: [] });
  });
});

describe("tmuxRunPrefix", () => {
  test("re-invokes this binary as the keeper for one repo, ending in the -- separator", () => {
    expect(tmuxRunPrefix(["/bin/rcd"], "/usr/bin/tmux", "/s/a.sock", "a")).toEqual([
      "/bin/rcd",
      "tmux-run",
      "--tmux",
      "/usr/bin/tmux",
      "--socket",
      "/s/a.sock",
      "--name",
      "a",
      "--",
    ]);
    expect(tmuxRunPrefix(["bun", "/x/main.ts"], "tmux", "/s", "n").slice(0, 3)).toEqual([
      "bun",
      "/x/main.ts",
      "tmux-run",
    ]);
  });
});
