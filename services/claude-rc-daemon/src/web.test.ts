import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, statSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPaths, type IpcRequest, type IpcResponse } from "@nsheaps/claude-rc-core";
import { startWebUi, type WebUi } from "./web";

const open: WebUi[] = [];
afterEach(async () => {
  while (open.length) await open.pop()!.stop();
});

async function setup(port = 0) {
  const home = mkdtempSync(join(tmpdir(), "rc-web-"));
  const paths = getPaths({}, home);
  mkdirSync(paths.runDir, { recursive: true });
  const repoDir = join(home, "myrepo");
  mkdirSync(repoDir);
  const reqs: IpcRequest[] = [];
  const handle = async (r: IpcRequest): Promise<IpcResponse> => {
    reqs.push(r);
    return r.cmd === "status" ? { ok: true, data: { repos: [], phase: "ready" } } : { ok: true };
  };
  const ui = await startWebUi({ paths, port, handle, log: () => {} });
  open.push(ui);
  const call = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
    fetch(`${ui.url}${path}`, {
      ...init,
      headers: { "x-claude-rc-token": ui.token, ...(init.headers ?? {}) },
    });
  const json = (method: string, path: string, body?: unknown) =>
    call(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { ui, paths, reqs, repoDir, call, json, home };
}

describe("web UI security", () => {
  test("binds loopback only and records url+token in ui.json (0600)", async () => {
    const t = await setup();
    expect(t.ui.url).toStartWith("http://127.0.0.1:");
    const rec = JSON.parse(readFileSync(t.paths.uiPath, "utf8"));
    expect(rec.url).toBe(t.ui.url);
    expect(rec.token).toBe(t.ui.token);
    expect(statSync(t.paths.uiPath).mode & 0o777).toBe(0o600);
    expect(t.ui.token.length).toBeGreaterThanOrEqual(32);
  });

  test("api requires the token", async () => {
    const t = await setup();
    const none = await fetch(`${t.ui.url}/api/status`);
    expect(none.status).toBe(401);
    const bad = await fetch(`${t.ui.url}/api/status`, { headers: { "x-claude-rc-token": "nope" } });
    expect(bad.status).toBe(401);
    expect((await t.call("/api/status")).status).toBe(200);
  });

  test("a foreign Host header is refused (DNS rebinding)", async () => {
    const t = await setup();
    const r = await t.call("/api/status", { headers: { host: "evil.example" } });
    expect(r.status).toBe(403);
  });

  test("a foreign Origin is refused (CSRF)", async () => {
    const t = await setup();
    const r = await t.call("/api/status", { headers: { origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });

  test("mutating requests must be JSON", async () => {
    const t = await setup();
    const r = await t.call("/api/reload", {
      method: "POST",
      headers: { "content-type": "text/plain" },
    });
    expect(r.status).toBe(415);
  });

  test("the page needs ?token= and does not leak the token without it", async () => {
    const t = await setup();
    const no = await fetch(`${t.ui.url}/`);
    expect(no.status).toBe(401);
    expect(await no.text()).not.toContain(t.ui.token);
    const ok = await fetch(`${t.ui.url}/?token=${t.ui.token}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("text/html");
    expect(ok.headers.get("cache-control")).toContain("no-store");
    const body = await ok.text();
    expect(body).toContain("claude-rc");
    expect(body).not.toContain(t.ui.token); // page reads the token from the URL, never embeds it
  });

  test("stop() removes ui.json", async () => {
    const t = await setup();
    await t.ui.stop();
    open.pop();
    expect(existsSync(t.paths.uiPath)).toBe(false);
  });

  test("falls back to an ephemeral port when the preferred one is taken", async () => {
    const blocker = createServer();
    await new Promise<void>((r) => blocker.listen(0, "127.0.0.1", r));
    const busy = (blocker.address() as { port: number }).port;
    try {
      const t = await setup(busy);
      expect(t.ui.url).not.toContain(`:${busy}`);
      expect((await t.call("/api/status")).status).toBe(200);
    } finally {
      blocker.close();
    }
  });
});

describe("web UI api", () => {
  test("status is proxied from the daemon", async () => {
    const t = await setup();
    const r = (await (await t.call("/api/status")).json()) as any;
    expect(r.phase).toBe("ready");
    expect(t.reqs[0]).toEqual({ cmd: "status" });
  });

  test("config returns repos and settings with defaults", async () => {
    const t = await setup();
    const c = (await (await t.call("/api/config")).json()) as any;
    expect(c.repos).toEqual([]);
    expect(c.notifications.enabled).toBe(true);
    expect(c.updates).toEqual({ claudeRc: true, claude: true });
    expect(c.ui.port).toBe(47474);
  });

  test("add repo writes rc.json and reloads; name defaults to the directory name", async () => {
    const t = await setup();
    const r = await t.json("POST", "/api/repos", { path: t.repoDir });
    expect(r.status).toBe(200);
    const cfg = JSON.parse(readFileSync(t.paths.configPath, "utf8"));
    expect(cfg.repos).toEqual([{ name: "myrepo", path: t.repoDir }]);
    expect(t.reqs.at(-1)).toEqual({ cmd: "reload" });
  });

  test("a directory name that is not a valid repo name is sanitized", async () => {
    const t = await setup();
    const dir = join(t.home, "My Project");
    mkdirSync(dir);
    expect((await t.json("POST", "/api/repos", { path: dir })).status).toBe(200);
    expect(JSON.parse(readFileSync(t.paths.configPath, "utf8")).repos[0].name).toBe("My-Project");
  });

  test.each([
    [{ path: "relative/dir" }, "absolute"],
    [{ path: "/definitely/not/here" }, "exist"],
    [{}, "path"],
    [{ path: "/tmp", name: "bad name" }, "name"],
  ])("add repo rejects %j with a message mentioning %s", async (body, needle) => {
    const t = await setup();
    const r = await t.json("POST", "/api/repos", body);
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).error).toContain(needle);
  });

  test("add repo rejects a duplicate name", async () => {
    const t = await setup();
    await t.json("POST", "/api/repos", { path: t.repoDir });
    const r = await t.json("POST", "/api/repos", { path: t.repoDir });
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).error).toContain("duplicate");
  });

  test("remove repo", async () => {
    const t = await setup();
    await t.json("POST", "/api/repos", { path: t.repoDir });
    const r = await t.json("DELETE", "/api/repos/myrepo");
    expect(r.status).toBe(200);
    expect(JSON.parse(readFileSync(t.paths.configPath, "utf8")).repos).toEqual([]);
    expect((await t.json("DELETE", "/api/repos/myrepo")).status).toBe(400);
  });

  test.each(["restart", "start", "stop"])("%s goes to the daemon", async (op) => {
    const t = await setup();
    const r = await t.json("POST", `/api/repos/myrepo/${op}`);
    expect(r.status).toBe(200);
    expect(t.reqs.at(-1)).toEqual({ cmd: op, name: "myrepo" });
  });

  test("daemon errors surface as 409 with the message", async () => {
    const t = await setup();
    const home = t.home;
    const paths = getPaths({}, home);
    const ui = await startWebUi({
      paths,
      port: 0,
      handle: async () => ({ ok: false, error: 'unknown repo "zzz"' }),
      log: () => {},
    });
    open.push(ui);
    const r = await fetch(`${ui.url}/api/repos/zzz/restart`, {
      method: "POST",
      headers: { "x-claude-rc-token": ui.token, "content-type": "application/json" },
    });
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toContain("zzz");
  });

  test("settings update merges, validates and reloads", async () => {
    const t = await setup();
    const r = await t.json("PUT", "/api/settings", {
      spawn: "session",
      notifications: { onExit: false },
      env: { A: "b" },
    });
    expect(r.status).toBe(200);
    const cfg = JSON.parse(readFileSync(t.paths.configPath, "utf8"));
    expect(cfg.spawn).toBe("session");
    expect(cfg.notifications).toEqual({ onExit: false });
    expect(cfg.env).toEqual({ A: "b" });
    expect(t.reqs.at(-1)).toEqual({ cmd: "reload" });
  });

  test("settings update rejects bad input with 400 and does not reload", async () => {
    const t = await setup();
    const r = await t.json("PUT", "/api/settings", { spawn: "nope" });
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).error).toContain("spawn");
    expect(t.reqs.filter((x) => x.cmd === "reload")).toEqual([]);
    const r2 = await t.json("PUT", "/api/settings", { repos: [] });
    expect(r2.status).toBe(400);
  });

  test("malformed JSON is a 400, unknown routes 404", async () => {
    const t = await setup();
    const bad = await t.call("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{oops",
    });
    expect(bad.status).toBe(400);
    expect((await t.call("/api/nope")).status).toBe(404);
  });
});
