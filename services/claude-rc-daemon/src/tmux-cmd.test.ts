import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTmuxRunArgs, selfCommand } from "./tmux-cmd";

describe("parseTmuxRunArgs", () => {
  test("parses the keeper flags and the command after --", () => {
    expect(
      parseTmuxRunArgs([
        "--tmux",
        "/t",
        "--socket",
        "/s.sock",
        "--name",
        "a",
        "--",
        "claude",
        "rc",
        "--spawn",
        "x",
      ]),
    ).toEqual({ tmux: "/t", socket: "/s.sock", name: "a", cmd: ["claude", "rc", "--spawn", "x"] });
  });
  test.each([
    [["--socket", "/s", "--name", "a", "--", "c"], "--tmux"],
    [["--tmux", "/t", "--name", "a", "--", "c"], "--socket"],
    [["--tmux", "/t", "--socket", "/s", "--", "c"], "--name"],
    [["--tmux", "/t", "--socket", "/s", "--name", "a"], "command"],
    [["--tmux", "/t", "--socket", "/s", "--name", "a", "--"], "command"],
    [["--tmux"], "--tmux"],
    [["--bogus", "--"], "--bogus"],
  ])("rejects %j mentioning %s", (argv, needle) => {
    const r = parseTmuxRunArgs(argv as string[]);
    expect("error" in r && r.error).toContain(needle);
  });
});

describe("selfCommand", () => {
  test("compiled binaries re-exec themselves; dev runs re-exec bun on the script", () => {
    expect(selfCommand({ execPath: "/bin/rcd", main: "/$bunfs/root/rcd" })).toEqual(["/bin/rcd"]);
    expect(selfCommand({ execPath: "/bin/bun", main: "/src/main.ts" })).toEqual([
      "/bin/bun",
      "/src/main.ts",
    ]);
  });
});

const TMUX = Bun.which("tmux");
(TMUX ? describe : describe.skip)("tmux-run through the daemon binary", () => {
  test("runs the command in tmux and exits with its status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rc-tr-"));
    const p = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "main.ts"),
        "tmux-run",
        "--tmux",
        TMUX!,
        "--socket",
        join(dir, "t", "a.sock"),
        "--name",
        "a",
        "--",
        "sh",
        "-c",
        "echo hi-from-pane; exit 5",
      ],
      { cwd: dir, stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    );
    const out = await new Response(p.stdout).text();
    expect(await p.exited).toBe(5);
    expect(out).toContain("hi-from-pane");
  });

  test("SIGTERM tears the session down and exits 143", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rc-tr-"));
    const sock = join(dir, "t", "a.sock");
    const p = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "main.ts"),
        "tmux-run",
        "--tmux",
        TMUX!,
        "--socket",
        sock,
        "--name",
        "a",
        "--",
        "sleep",
        "60",
      ],
      { cwd: dir, stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    );
    for (let i = 0; i < 100; i++) {
      const r = Bun.spawnSync([TMUX!, "-S", sock, "has-session", "-t", "rc"]);
      if (r.exitCode === 0) break;
      await Bun.sleep(50);
    }
    p.kill("SIGTERM");
    expect(await p.exited).toBe(143);
    expect(Bun.spawnSync([TMUX!, "-S", sock, "has-session", "-t", "rc"]).exitCode).not.toBe(0);
  });
});

describe("parseTmuxRunArgs --log", () => {
  test("accepts an optional log file", () => {
    expect(
      parseTmuxRunArgs(["--tmux", "/t", "--socket", "/s", "--name", "n", "--log", "/l", "--", "x"]),
    ).toEqual({ tmux: "/t", socket: "/s", name: "n", log: "/l", cmd: ["x"] });
  });
});
