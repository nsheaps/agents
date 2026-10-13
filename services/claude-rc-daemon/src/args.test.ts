import { describe, expect, test } from "bun:test";
import { parseDaemonArgs } from "./args";

describe("parseDaemonArgs", () => {
  test("defaults to auto supervisor", () => {
    expect(parseDaemonArgs([], {})).toEqual({ kind: "run", supervisor: "auto" });
  });
  test("--supervisor flag and env (flag wins)", () => {
    expect(
      parseDaemonArgs(["--supervisor", "inproc"], { CLAUDE_RC_SUPERVISOR: "systemd" }),
    ).toEqual({ kind: "run", supervisor: "inproc" });
    expect(parseDaemonArgs(["--supervisor=launchd"], {})).toEqual({
      kind: "run",
      supervisor: "launchd",
    });
    expect(parseDaemonArgs([], { CLAUDE_RC_SUPERVISOR: "systemd" })).toEqual({
      kind: "run",
      supervisor: "systemd",
    });
  });
  test("--version / --help", () => {
    expect(parseDaemonArgs(["--version"], {}).kind).toBe("version");
    expect(parseDaemonArgs(["-v"], {}).kind).toBe("version");
    expect(parseDaemonArgs(["--help"], {}).kind).toBe("help");
  });
  test("errors on bad values and unknown flags", () => {
    expect(parseDaemonArgs(["--supervisor", "nope"], {})).toMatchObject({ kind: "error" });
    expect(parseDaemonArgs(["--supervisor"], {})).toMatchObject({ kind: "error" });
    expect(parseDaemonArgs(["--wat"], {})).toMatchObject({
      kind: "error",
      message: expect.stringContaining("--wat"),
    });
  });
});
