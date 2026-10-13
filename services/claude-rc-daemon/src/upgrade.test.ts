import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "./upgrade";

const script = (body: string) => {
  const f = join(mkdtempSync(join(tmpdir(), "rc-up-")), "claude");
  writeFileSync(f, `#!/bin/sh\n${body}\n`);
  chmodSync(f, 0o755);
  return f;
};

describe("runUpgrade", () => {
  test("invokes `claude upgrade` and returns output on success", async () => {
    const r = await runUpgrade(script('echo "args:$@"'), 5000);
    expect(r).toEqual({ ok: true, output: "args:upgrade" });
  });
  test("non-zero exit -> ok:false with output", async () => {
    const r = await runUpgrade(script("echo oops >&2; exit 2"), 5000);
    expect(r.ok).toBe(false);
    expect(r.output).toContain("oops");
  });
  test("times out and kills a hung upgrade", async () => {
    const r = await runUpgrade(script("sleep 30"), 200);
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/timed out/);
  });
  test("missing binary -> ok:false", async () => {
    const r = await runUpgrade("/nonexistent/claude", 1000);
    expect(r.ok).toBe(false);
  });
  test("output is truncated to the tail", async () => {
    const r = await runUpgrade(script("yes x | head -c 20000"), 5000);
    expect(r.output.length).toBeLessThanOrEqual(2100);
  });
});
