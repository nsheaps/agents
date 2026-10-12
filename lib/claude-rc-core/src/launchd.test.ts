import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LaunchdSupervisor, renderPlist } from "./launchd";
import type { Exec, ExecResult } from "./supervisor-types";

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
  argv: ["/bin/claude", "rc", "--verbose"],
  env: { A: "x&y<z>" },
  logFile: "/l/web.log",
};

describe("renderPlist", () => {
  const p = renderPlist("dev.nsheaps.claude-rc.web", spec);
  test("has label, args, cwd, KeepAlive, logs", () => {
    expect(p).toContain("<key>Label</key><string>dev.nsheaps.claude-rc.web</string>");
    expect(p).toContain("<string>/bin/claude</string>");
    expect(p).toContain("<key>WorkingDirectory</key><string>/r/web</string>");
    expect(p).toContain("<key>KeepAlive</key><true/>");
    expect(p).toContain("<key>StandardOutPath</key><string>/l/web.log</string>");
    expect(p).toContain("<key>StandardErrorPath</key><string>/l/web.log</string>");
  });
  test("escapes XML in env values", () => {
    expect(p).toContain("x&amp;y&lt;z&gt;");
  });
  test("is not auto-loaded at login on its own (lives outside LaunchAgents; RunAtLoad only applies after bootstrap)", () => {
    expect(p).toContain("<key>RunAtLoad</key><true/>");
  });
});

describe("LaunchdSupervisor", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "rc-ld-"));
  test("start writes plist OUTSIDE ~/Library/LaunchAgents and bootstraps it into gui/<uid>", async () => {
    const d = dir();
    const { exec, calls } = fake();
    await new LaunchdSupervisor(exec, d, 501).start(spec);
    const plist = join(d, "dev.nsheaps.claude-rc.web.plist");
    expect(existsSync(plist)).toBe(true);
    expect(readFileSync(plist, "utf8")).toContain("dev.nsheaps.claude-rc.web");
    expect(calls[0]).toEqual(["launchctl", "bootout", "gui/501/dev.nsheaps.claude-rc.web"]);
    expect(calls[1]).toEqual(["launchctl", "bootstrap", "gui/501", plist]);
    expect(plist).not.toContain("LaunchAgents");
  });
  test("start surfaces bootstrap errors", async () => {
    const { exec } = fake({ bootstrap: { code: 5, stderr: "Bootstrap failed: 5" } });
    await expect(new LaunchdSupervisor(exec, dir(), 501).start(spec)).rejects.toThrow(
      /Bootstrap failed/,
    );
  });
  test("stop boots out and removes the plist", async () => {
    const d = dir();
    const { exec, calls } = fake();
    const s = new LaunchdSupervisor(exec, d, 501);
    await s.start(spec);
    await s.stop("web");
    expect(calls.at(-1)).toEqual(["launchctl", "bootout", "gui/501/dev.nsheaps.claude-rc.web"]);
    expect(existsSync(join(d, "dev.nsheaps.claude-rc.web.plist"))).toBe(false);
  });
  test("status parses launchctl print", async () => {
    const out = "\tstate = running\n\tpid = 321\n\truns = 4\n";
    const { exec } = fake({ print: { stdout: out } });
    expect(await new LaunchdSupervisor(exec, dir(), 501).status("web")).toMatchObject({
      state: "running",
      pid: 321,
      restarts: 3,
      supervisor: "launchd",
    });
  });
  test("status: not loaded -> stopped", async () => {
    const { exec } = fake({ print: { code: 113, stderr: "Could not find service" } });
    expect((await new LaunchdSupervisor(exec, dir(), 501).status("web")).state).toBe("stopped");
  });
  test("status: waiting/throttled -> starting", async () => {
    const { exec } = fake({ print: { stdout: "\tstate = waiting\n\truns = 2\n" } });
    expect((await new LaunchdSupervisor(exec, dir(), 501).status("web")).state).toBe("starting");
  });
  test("list reads launchctl list for our prefix", async () => {
    const out =
      "PID\tStatus\tLabel\n12\t0\tdev.nsheaps.claude-rc.web\n-\t1\tdev.nsheaps.claude-rc.api\n1\t0\tcom.apple.x\n";
    const { exec } = fake({ "launchctl list": { stdout: out } });
    expect((await new LaunchdSupervisor(exec, dir(), 501).list()).sort()).toEqual(["api", "web"]);
  });
});
