import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ipcRequest, serveIpc } from "./ipc";

const sock = () => join(mkdtempSync(join(tmpdir(), "rc-ipc-")), "s.sock");
let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

describe("ipc", () => {
  test("request/response round trip", async () => {
    const path = sock();
    close = await serveIpc(path, async (req) => ({ ok: true, data: { echo: req } }));
    const r = await ipcRequest(path, { cmd: "status", name: "x" });
    expect(r).toEqual({ ok: true, data: { echo: { cmd: "status", name: "x" } } });
  });
  test("handler errors become {ok:false,error}", async () => {
    const path = sock();
    close = await serveIpc(path, async () => {
      throw new Error("nope");
    });
    expect(await ipcRequest(path, { cmd: "ping" })).toEqual({ ok: false, error: "nope" });
  });
  test("malformed request does not crash the server", async () => {
    const path = sock();
    close = await serveIpc(path, async () => ({ ok: true }));
    const raw = await new Promise<string>((res) => {
      const { createConnection } = require("node:net");
      const c = createConnection(path, () => c.write("not json\n"));
      c.on("data", (d: Buffer) => res(d.toString()));
    });
    expect(JSON.parse(raw).ok).toBe(false);
    expect((await ipcRequest(path, { cmd: "ping" })).ok).toBe(true);
  });
  test("socket is owner-only (0600)", async () => {
    const path = sock();
    close = await serveIpc(path, async () => ({ ok: true }));
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
  test("replaces a stale socket file left by a crashed daemon", async () => {
    const path = sock();
    const c1 = await serveIpc(path, async () => ({ ok: true }));
    // simulate crash: leave the file but stop listening without unlinking
    (c1 as any).__skipUnlink?.();
    await c1();
    close = await serveIpc(path, async () => ({ ok: true, data: 2 }));
    expect((await ipcRequest(path, { cmd: "ping" })).data).toBe(2);
  });
  test("refuses to start if a live daemon already owns the socket", async () => {
    const path = sock();
    close = await serveIpc(path, async () => ({ ok: true }));
    await expect(serveIpc(path, async () => ({ ok: true }))).rejects.toThrow(/already running/);
  });
  test("client: no daemon -> error with code ENOENT/ECONNREFUSED", async () => {
    await expect(ipcRequest(sock(), { cmd: "ping" })).rejects.toThrow(/not running/);
  });
  test("client times out against a server that never answers", async () => {
    const path = sock();
    close = await serveIpc(path, () => new Promise(() => {}));
    await expect(ipcRequest(path, { cmd: "ping" }, 150)).rejects.toThrow(/timed out/);
  });
});
