import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { selfPtyPrefix } from "./pty-cmd";

const MAIN = join(import.meta.dir, "main.ts");

describe("selfPtyPrefix", () => {
  test("dev run: bun + script path + pty-run --", () => {
    expect(selfPtyPrefix({}, { execPath: "/usr/bin/bun", main: "/src/main.ts" })).toEqual([
      "/usr/bin/bun",
      "/src/main.ts",
      "pty-run",
      "--",
    ]);
  });
  test("compiled binary: the binary itself", () => {
    expect(
      selfPtyPrefix({}, { execPath: "/opt/claude-rc-daemon", main: "/$bunfs/root/x" }),
    ).toEqual(["/opt/claude-rc-daemon", "pty-run", "--"]);
  });
  test("CLAUDE_RC_PTY=0 disables wrapping", () => {
    expect(
      selfPtyPrefix({ CLAUDE_RC_PTY: "0" }, { execPath: "/b", main: "/m.ts" }),
    ).toBeUndefined();
  });
});

describe("daemon `pty-run` subcommand (real process)", () => {
  const run = async (...argv: string[]) => {
    const p = Bun.spawn(["bun", "run", MAIN, "pty-run", ...argv], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
    return { out, code };
  };
  test("gives the command a TTY and passes output + exit code through", async () => {
    const r = await run("--", "sh", "-c", "[ -t 0 ] && [ -t 1 ] && echo TTY-YES; exit 5");
    expect(r.out).toContain("TTY-YES");
    expect(r.code).toBe(5);
  });
  test("requires a command", async () => {
    expect((await run("--")).code).toBe(2);
  });
});
