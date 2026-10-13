import { describe, expect, test } from "bun:test";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  test("no args -> help", () => expect(parseArgs([]).cmd).toBe("help"));
  test.each([["-h"], ["--help"], ["help"]])("%s -> help", (a) =>
    expect(parseArgs([a]).cmd).toBe("help"),
  );
  test.each([["-v"], ["--version"], ["version"]])("%s -> version", (a) =>
    expect(parseArgs([a]).cmd).toBe("version"),
  );
  test("status --json", () => {
    expect(parseArgs(["status", "--json"])).toMatchObject({ cmd: "status", json: true });
  });
  test("aliases ls->list rm->remove", () => {
    expect(parseArgs(["ls"]).cmd).toBe("list");
    expect(parseArgs(["rm", "a"]).cmd).toBe("remove");
  });
  test("add <path> infers name from basename; --name overrides; --spawn validated", () => {
    expect(parseArgs(["add", "/r/my-repo"])).toMatchObject({
      cmd: "add",
      path: "/r/my-repo",
      name: "my-repo",
    });
    expect(parseArgs(["add", "/r/x", "--name", "y", "--spawn", "same-dir"])).toMatchObject({
      name: "y",
      spawn: "same-dir",
    });
    expect(parseArgs(["add", "/r/x", "--spawn", "bogus"]).cmd).toBe("error");
  });
  test("add with no path is a usage error", () => {
    expect(parseArgs(["add"])).toMatchObject({
      cmd: "error",
      message: expect.stringContaining("add"),
    });
  });
  test("restart/start/stop/logs take names; restart name optional", () => {
    expect(parseArgs(["restart"])).toMatchObject({ cmd: "restart", name: undefined });
    expect(parseArgs(["restart", "a"])).toMatchObject({ name: "a" });
    expect(parseArgs(["stop"]).cmd).toBe("error");
    expect(parseArgs(["logs"]).cmd).toBe("error");
  });
  test("logs -n / -f", () => {
    expect(parseArgs(["logs", "a", "-n", "10", "-f"])).toMatchObject({
      cmd: "logs",
      name: "a",
      lines: 10,
      follow: true,
    });
    expect(parseArgs(["logs", "a", "-n", "x"]).cmd).toBe("error");
    expect(parseArgs(["logs", "a"])).toMatchObject({ lines: 50, follow: false });
  });
  test("config subcommands", () => {
    expect(parseArgs(["config", "path"])).toMatchObject({ cmd: "config", sub: "path" });
    expect(parseArgs(["config"])).toMatchObject({ cmd: "config", sub: "show" });
    expect(parseArgs(["config", "nope"]).cmd).toBe("error");
  });
  test("unknown command / flag", () => {
    expect(parseArgs(["wat"])).toMatchObject({
      cmd: "error",
      message: expect.stringContaining("wat"),
    });
    expect(parseArgs(["status", "--wat"])).toMatchObject({
      cmd: "error",
      message: expect.stringContaining("--wat"),
    });
  });
  test("trust [name], reload, doctor, shutdown", () => {
    expect(parseArgs(["trust", "a"])).toMatchObject({ cmd: "trust", name: "a" });
    for (const c of ["reload", "doctor", "shutdown"]) expect(parseArgs([c]).cmd as string).toBe(c);
  });
  test("ui [--print]", () => {
    expect(parseArgs(["ui"])).toEqual({ cmd: "ui", print: false });
    expect(parseArgs(["ui", "--print"])).toEqual({ cmd: "ui", print: true });
    expect(parseArgs(["ui", "--bogus"]).cmd).toBe("error");
  });
});
