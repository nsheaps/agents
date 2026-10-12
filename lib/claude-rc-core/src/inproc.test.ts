import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InProcSupervisor } from "./inproc";

const dir = mkdtempSync(join(tmpdir(), "rc-ip-"));
const mk = (argv: string[], name = "svc") => ({
  name,
  cwd: dir,
  argv,
  env: { MARK: "m1" },
  logFile: join(dir, `${name}.log`),
});
const until = async (f: () => Promise<boolean> | boolean, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await f()) return;
    await Bun.sleep(25);
  }
  throw new Error("timeout");
};
let sup: InProcSupervisor;
afterEach(async () => sup?.dispose());

describe("InProcSupervisor", () => {
  test("runs the command with cwd+env and writes output to the log", async () => {
    sup = new InProcSupervisor({ restartDelayMs: 20 });
    await sup.start(mk(["sh", "-c", 'echo "$MARK:$(pwd)"; sleep 30']));
    await until(async () => (await sup.status("svc")).state === "running");
    await until(() => readFileSync(join(dir, "svc.log"), "utf8").includes("m1:"));
    expect(readFileSync(join(dir, "svc.log"), "utf8")).toContain(`m1:${dir}`);
  });
  test("restarts after the process dies (new pid, restarts counted)", async () => {
    sup = new InProcSupervisor({ restartDelayMs: 20 });
    await sup.start(mk(["sleep", "30"]));
    await until(async () => (await sup.status("svc")).state === "running");
    const first = (await sup.status("svc")).pid!;
    process.kill(first, "SIGKILL");
    await until(async () => {
      const s = await sup.status("svc");
      return s.state === "running" && s.pid !== first;
    });
    expect((await sup.status("svc")).restarts).toBe(1);
  });
  test("keeps restarting a command that exits immediately", async () => {
    sup = new InProcSupervisor({ restartDelayMs: 20, maxDelayMs: 40 });
    await sup.start(mk(["sh", "-c", "exit 3"]));
    await until(async () => ((await sup.status("svc")).restarts ?? 0) >= 2);
  });
  test("stop kills the process and does not restart it", async () => {
    sup = new InProcSupervisor({ restartDelayMs: 20 });
    await sup.start(mk(["sleep", "30"]));
    await until(async () => (await sup.status("svc")).state === "running");
    const pid = (await sup.status("svc")).pid!;
    await sup.stop("svc");
    expect((await sup.status("svc")).state).toBe("stopped");
    await Bun.sleep(150);
    expect((await sup.status("svc")).state).toBe("stopped");
    expect(() => process.kill(pid, 0)).toThrow();
  });
  test("start with the same name replaces the running process", async () => {
    sup = new InProcSupervisor({ restartDelayMs: 20 });
    await sup.start(mk(["sleep", "30"]));
    await until(async () => (await sup.status("svc")).state === "running");
    const a = (await sup.status("svc")).pid!;
    await sup.start(mk(["sleep", "31"]));
    await until(async () => {
      const s = await sup.status("svc");
      return s.state === "running" && s.pid !== a;
    });
    expect(() => process.kill(a, 0)).toThrow();
    expect(await sup.list()).toEqual(["svc"]);
  });
  test("dispose stops everything", async () => {
    sup = new InProcSupervisor({ restartDelayMs: 20 });
    await sup.start(mk(["sleep", "30"], "a"));
    await sup.start(mk(["sleep", "30"], "b"));
    await until(async () => (await sup.status("b")).state === "running");
    const pids = [(await sup.status("a")).pid!, (await sup.status("b")).pid!];
    await sup.dispose();
    for (const p of pids) expect(() => process.kill(p, 0)).toThrow();
    expect(await sup.list()).toEqual([]);
  });
  test("unknown service is stopped", async () => {
    sup = new InProcSupervisor();
    expect((await sup.status("nope")).state).toBe("stopped");
  });
});
