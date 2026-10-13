import { describe, expect, test } from "bun:test";
import { StateWatcher } from "./events";

const run = (pid: number) => ({ state: "running" as const, pid });
const down = { state: "failed" as const };

describe("StateWatcher", () => {
  test("first observation seeds silently", () => {
    const w = new StateWatcher();
    expect(w.observe({ a: run(1) })).toEqual([]);
  });
  test("running -> not running is an exit", () => {
    const w = new StateWatcher();
    w.observe({ a: run(1) });
    expect(w.observe({ a: down })).toEqual([{ type: "exited", name: "a" }]);
  });
  test("not running -> running is a start; unchanged is quiet", () => {
    const w = new StateWatcher();
    w.observe({ a: down });
    expect(w.observe({ a: run(2) })).toEqual([{ type: "started", name: "a" }]);
    expect(w.observe({ a: run(2) })).toEqual([]);
  });
  test("pid change while running is a restart (it exited and came back)", () => {
    const w = new StateWatcher();
    w.observe({ a: run(1) });
    expect(w.observe({ a: run(2) })).toEqual([{ type: "restarted", name: "a" }]);
  });
  test("a service that appears later (added) and starts is announced; removed ones are forgotten", () => {
    const w = new StateWatcher();
    w.observe({});
    expect(w.observe({ b: run(5) })).toEqual([{ type: "started", name: "b" }]);
    expect(w.observe({})).toEqual([]);
    expect(w.observe({ b: run(6) })).toEqual([{ type: "started", name: "b" }]);
  });
  test("a user-initiated stop is reported as stopped, not exited", () => {
    const w = new StateWatcher();
    w.observe({ a: run(1) });
    expect(w.observe({ a: { state: "stopped", stoppedByUser: true } })).toEqual([
      { type: "stopped", name: "a" },
    ]);
  });
});
