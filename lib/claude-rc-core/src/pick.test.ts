import { describe, expect, test } from "bun:test";
import { pickSupervisor } from "./pick";
import type { Exec } from "./supervisor-types";

const exec =
  (ok: (argv: string) => boolean): Exec =>
  async (argv) => ({ code: ok(argv.join(" ")) ? 0 : 1, stdout: "", stderr: "x" });
const base = { uid: 501, runDir: "/run" };

describe("pickSupervisor", () => {
  test("linux + working systemd --user -> systemd", async () => {
    const p = await pickSupervisor({ ...base, platform: "linux", exec: exec(() => true) });
    expect(p.supervisor.kind).toBe("systemd");
  });
  test("linux without a user manager -> inproc with a reason", async () => {
    const p = await pickSupervisor({ ...base, platform: "linux", exec: exec(() => false) });
    expect(p.supervisor.kind).toBe("inproc");
    expect(p.reason).toMatch(/systemd/);
  });
  test("linux missing systemd-run binary -> inproc", async () => {
    const p = await pickSupervisor({
      ...base,
      platform: "linux",
      exec: exec((a) => !a.startsWith("systemd-run")),
    });
    expect(p.supervisor.kind).toBe("inproc");
  });
  test("darwin with gui domain -> launchd", async () => {
    const p = await pickSupervisor({
      ...base,
      platform: "darwin",
      exec: exec((a) => a.includes("gui/501")),
    });
    expect(p.supervisor.kind).toBe("launchd");
  });
  test("darwin without gui domain (ssh/headless) -> inproc", async () => {
    const p = await pickSupervisor({ ...base, platform: "darwin", exec: exec(() => false) });
    expect(p.supervisor.kind).toBe("inproc");
  });
  test("prefer=inproc always wins", async () => {
    const p = await pickSupervisor({
      ...base,
      platform: "linux",
      prefer: "inproc",
      exec: exec(() => true),
    });
    expect(p.supervisor.kind).toBe("inproc");
    expect(p.reason).toMatch(/requested/);
  });
  test("prefer=native but unavailable -> throws (explicit request must not silently degrade)", async () => {
    await expect(
      pickSupervisor({ ...base, platform: "linux", prefer: "systemd", exec: exec(() => false) }),
    ).rejects.toThrow(/systemd/);
  });
  test("unsupported platform -> inproc", async () => {
    const p = await pickSupervisor({ ...base, platform: "win32", exec: exec(() => true) });
    expect(p.supervisor.kind).toBe("inproc");
  });
});
