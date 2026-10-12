import { describe, expect, test } from "bun:test";
import type { Exec, ExecResult } from "./supervisor-types";
import { SystemdSupervisor } from "./systemd";

function fake(responses: Record<string, Partial<ExecResult>> = {}) {
  const calls: string[][] = [];
  const exec: Exec = async (argv) => {
    calls.push(argv);
    const key = Object.keys(responses).find((k) => argv.join(" ").includes(k));
    return { code: 0, stdout: "", stderr: "", ...(key ? responses[key] : {}) };
  };
  return { exec, calls };
}
const spec = {
  name: "web",
  cwd: "/r/web",
  argv: ["/bin/claude", "rc", "--spawn", "worktree", "--verbose"],
  env: { A: "b c", PATH: "/x" },
  logFile: "/l/web.log",
};

describe("SystemdSupervisor", () => {
  test("start: stops + resets any old unit, then systemd-run --user with restart-always and log files", async () => {
    const { exec, calls } = fake();
    await new SystemdSupervisor(exec).start(spec);
    expect(calls[0]).toEqual(["systemctl", "--user", "stop", "claude-rc-web.service"]);
    // a previously failed unit of the same name would block systemd-run
    expect(calls[1]).toEqual(["systemctl", "--user", "reset-failed", "claude-rc-web.service"]);
    const run = calls[2]!;
    expect(run.slice(0, 2)).toEqual(["systemd-run", "--user"]);
    expect(run).toContain("--unit=claude-rc-web");
    expect(run).toContain("--collect");
    expect(run).toContain("--property=Restart=always");
    expect(run).toContain("--property=StartLimitIntervalSec=0");
    expect(run).toContain("--property=WorkingDirectory=/r/web");
    expect(run).toContain("--property=StandardOutput=append:/l/web.log");
    expect(run).toContain("--property=StandardError=append:/l/web.log");
    expect(run).toContain("--setenv=A=b c");
    expect(run).toContain("--setenv=PATH=/x");
    const dash = run.indexOf("--");
    expect(run.slice(dash + 1)).toEqual(spec.argv);
  });
  test("start throws with stderr when systemd-run fails", async () => {
    const { exec } = fake({ "systemd-run": { code: 1, stderr: "Failed to connect to bus" } });
    await expect(new SystemdSupervisor(exec).start(spec)).rejects.toThrow(
      /Failed to connect to bus/,
    );
  });
  test("stop issues systemctl stop and tolerates unknown unit", async () => {
    const { exec, calls } = fake({ stop: { code: 5, stderr: "not loaded" } });
    await new SystemdSupervisor(exec).stop("web");
    expect(calls[0]).toEqual(["systemctl", "--user", "stop", "claude-rc-web.service"]);
  });
  test.each([
    [
      "LoadState=loaded\nActiveState=active\nSubState=running\nMainPID=42\nNRestarts=3\n",
      { state: "running", pid: 42, restarts: 3 },
    ],
    [
      "LoadState=loaded\nActiveState=activating\nSubState=auto-restart\nMainPID=0\nNRestarts=7\n",
      { state: "starting", restarts: 7 },
    ],
    [
      "LoadState=loaded\nActiveState=failed\nSubState=failed\nMainPID=0\nNRestarts=0\n",
      { state: "failed", restarts: 0 },
    ],
    [
      "LoadState=not-found\nActiveState=inactive\nSubState=dead\nMainPID=0\nNRestarts=0\n",
      { state: "stopped" },
    ],
  ])("status parses %#", async (stdout, want) => {
    const { exec } = fake({ show: { stdout } });
    const s = await new SystemdSupervisor(exec).status("web");
    expect(s).toMatchObject({ name: "web", supervisor: "systemd", ...want });
  });
  test("list returns repo names for claude-rc-* units only", async () => {
    const out =
      "claude-rc-web.service loaded active running claude rc (web)\nclaude-rc-api.service loaded failed failed x\nclaude-rc-daemon.service loaded active running d\n";
    const { exec, calls } = fake({ "list-units": { stdout: out } });
    expect((await new SystemdSupervisor(exec).list()).sort()).toEqual(["api", "web"]);
    expect(calls[0]).toContain("--user");
  });
  test("dispose does not stop services (native backend)", async () => {
    const { exec, calls } = fake();
    await new SystemdSupervisor(exec).dispose();
    expect(calls).toEqual([]);
  });
});
