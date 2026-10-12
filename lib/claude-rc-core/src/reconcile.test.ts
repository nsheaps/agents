import { describe, expect, test } from "bun:test";
import { reconcile } from "./reconcile";
import { specHash } from "./spec";
import type { ServiceSpec, ServiceStatus, Supervisor } from "./supervisor-types";

function fakeSup(initial: Record<string, ServiceStatus["state"]> = {}) {
  const state = { ...initial };
  const log: string[] = [];
  const sup: Supervisor = {
    kind: "inproc",
    async start(s) {
      log.push(`start:${s.name}`);
      state[s.name] = "running";
    },
    async stop(n) {
      log.push(`stop:${n}`);
      delete state[n];
    },
    async status(n) {
      return { name: n, state: state[n] ?? "stopped", supervisor: "inproc" };
    },
    async list() {
      return Object.keys(state);
    },
    async dispose() {},
  };
  return { sup, log, state };
}
const spec = (name: string, extra: Partial<ServiceSpec> = {}): ServiceSpec => ({
  name,
  cwd: "/tmp",
  argv: ["c"],
  env: {},
  logFile: "/l",
  ...extra,
});

describe("reconcile", () => {
  test("starts missing services", async () => {
    const { sup, log } = fakeSup();
    const r = await reconcile(sup, [spec("a"), spec("b")], {}, () => true);
    expect(log.sort()).toEqual(["start:a", "start:b"]);
    expect(r.results.map((x) => x.action).sort()).toEqual(["started", "started"]);
    expect(r.hashes.a).toBe(specHash(spec("a")));
  });
  test("keeps services that run with an unchanged spec (adoption after daemon restart)", async () => {
    const { sup, log } = fakeSup({ a: "running" });
    const r = await reconcile(sup, [spec("a")], { a: specHash(spec("a")) }, () => true);
    expect(log).toEqual([]);
    expect(r.results[0]!.action).toBe("kept");
  });
  test("restarts when the spec changed", async () => {
    const { sup, log } = fakeSup({ a: "running" });
    const r = await reconcile(
      sup,
      [spec("a", { argv: ["c", "new"] })],
      { a: specHash(spec("a")) },
      () => true,
    );
    expect(log).toEqual(["start:a"]);
    expect(r.results[0]!.action).toBe("restarted");
  });
  test("restarts when running but the previous hash is unknown (cannot prove it is current)", async () => {
    const { sup, log } = fakeSup({ a: "running" });
    await reconcile(sup, [spec("a")], {}, () => true);
    expect(log).toEqual(["start:a"]);
  });
  test("(re)starts services in failed state", async () => {
    const { sup, log } = fakeSup({ a: "failed" });
    await reconcile(sup, [spec("a")], { a: specHash(spec("a")) }, () => true);
    expect(log).toEqual(["start:a"]);
  });
  test("stops services no longer in config", async () => {
    const { sup, log } = fakeSup({ gone: "running" });
    const r = await reconcile(sup, [], { gone: "h" }, () => true);
    expect(log).toEqual(["stop:gone"]);
    expect(r.results[0]).toMatchObject({ name: "gone", action: "stopped" });
    expect(r.hashes.gone).toBeUndefined();
  });
  test("missing repo path -> error result, any running service is stopped (would crash-loop), others unaffected", async () => {
    const { sup, log } = fakeSup();
    const r = await reconcile(
      sup,
      [spec("a", { cwd: "/nope" }), spec("b")],
      {},
      (p) => p !== "/nope",
    );
    expect(log).toEqual(["stop:a", "start:b"]);
    expect(r.results.find((x) => x.name === "a")).toMatchObject({ action: "error" });
    expect(r.results.find((x) => x.name === "a")!.error).toContain("/nope");
  });
  test("a start failure is reported and does not abort the rest", async () => {
    const { sup } = fakeSup();
    const orig = sup.start.bind(sup);
    sup.start = async (s) => {
      if (s.name === "a") throw new Error("boom");
      return orig(s);
    };
    const r = await reconcile(sup, [spec("a"), spec("b")], {}, () => true);
    expect(r.results.find((x) => x.name === "a")).toMatchObject({ action: "error", error: "boom" });
    expect(r.results.find((x) => x.name === "b")!.action).toBe("started");
    expect(r.hashes.a).toBeUndefined();
  });
});
