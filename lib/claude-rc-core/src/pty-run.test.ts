import { describe, expect, test } from "bun:test";
import { runInPty } from "./pty-run";

const sh = (script: string) => ["sh", "-c", script];
const collect = () => {
  const out: string[] = [];
  return { out, onData: (s: string) => out.push(s), text: () => out.join("") };
};

describe("runInPty", () => {
  test("child sees a TTY on stdin and stdout", async () => {
    const c = collect();
    const code = await runInPty(sh("[ -t 0 ] && [ -t 1 ] && echo TTY-YES || echo TTY-NO"), {
      onData: c.onData,
    });
    expect(code).toBe(0);
    expect(c.text()).toContain("TTY-YES");
  });

  test("contrast: without the PTY wrapper the same check fails", async () => {
    const p = Bun.spawn(sh("[ -t 0 ] && [ -t 1 ] && echo TTY-YES || echo TTY-NO"), {
      stdin: "ignore",
      stdout: "pipe",
    });
    expect((await new Response(p.stdout).text()).trim()).toBe("TTY-NO");
  });

  test("propagates the exit code", async () => {
    expect(await runInPty(sh("exit 7"), { onData: () => {} })).toBe(7);
  });

  test("uses cwd and env", async () => {
    const c = collect();
    await runInPty(sh('echo "$MARK:$(pwd)"'), {
      cwd: "/",
      env: { ...process.env, MARK: "m1" },
      onData: c.onData,
    });
    expect(c.text()).toContain("m1:/");
  });

  test("reports spawn failure as 127", async () => {
    expect(await runInPty(["/nonexistent/bin"], { onData: () => {} })).toBe(127);
  });

  test("abort signal terminates the child; exit code is 128+signal", async () => {
    const ac = new AbortController();
    const done = runInPty(sh("sleep 30"), { onData: () => {}, signal: ac.signal });
    setTimeout(() => ac.abort(), 200);
    expect(await done).toBe(128 + 15);
  });

  test("a program that prompts and reads from the TTY gets the answer written to it", async () => {
    const c = collect();
    const code = await runInPty(sh('printf "Trust? [y/N] "; read -r a; echo "answer=$a"'), {
      onData: c.onData,
      input: "y\n",
      inputDelayMs: 200,
    });
    expect(code).toBe(0);
    expect(c.text()).toContain("answer=y");
  });
});
