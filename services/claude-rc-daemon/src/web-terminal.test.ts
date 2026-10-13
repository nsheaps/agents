import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attachArgv,
  getPaths,
  tmuxConf,
  type IpcRequest,
  type IpcResponse,
} from "@nsheaps/claude-rc-core";
import { PAGE_HTML } from "./web-page";
import { startWebUi, type WebUi } from "./web";

const TMUX = Bun.which("tmux");
const open: WebUi[] = [];
const cleanups: Array<() => void> = [];
afterEach(async () => {
  while (open.length) await open.pop()!.stop();
  while (cleanups.length) cleanups.pop()!();
});

async function setup(attach?: (n: string) => string[] | undefined, cfg?: object) {
  const home = mkdtempSync(join(tmpdir(), "rc-wt-"));
  const paths = getPaths({}, home);
  mkdirSync(paths.runDir, { recursive: true });
  if (cfg) writeFileSync(paths.configPath, JSON.stringify({ repos: [], ...cfg }));
  const reqs: IpcRequest[] = [];
  const handle = async (r: IpcRequest): Promise<IpcResponse> => {
    reqs.push(r);
    return { ok: true };
  };
  const ui = await startWebUi({ paths, port: 0, handle, attach, log: () => {} });
  open.push(ui);
  return { ui, reqs, home };
}

const wsUrl = (ui: WebUi, name: string) => ui.url.replace("http", "ws") + `/ws/term/${name}`;

/** Open a socket and collect close info + text, with the Origin a browser would send. */
function connect(ui: WebUi, name: string, origin: string | null = ui.url) {
  const ws = new WebSocket(wsUrl(ui, name), {
    headers: origin ? { origin } : {},
  } as never);
  const out = { text: "", closed: undefined as undefined | { code: number; reason: string } };
  ws.onmessage = (e) => (out.text += String(e.data));
  ws.onclose = (e) => (out.closed = { code: e.code, reason: e.reason });
  const opened = new Promise<boolean>((res) => {
    ws.onopen = () => res(true);
    ws.onerror = () => res(false);
  });
  return { ws, out, opened };
}
const until = async (f: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!f() && Date.now() < end) await Bun.sleep(25);
  return f();
};

describe("web page", () => {
  test("its inline script is syntactically valid JavaScript", () => {
    const m = /<script>([\s\S]*?)<\/script>/.exec(PAGE_HTML);
    expect(m).not.toBeNull();
    expect(() => new Function(m![1]!)).not.toThrow();
  });
  test("shows the update controls and loads xterm from itself", () => {
    expect(PAGE_HTML).toContain("/api/update");
    expect(PAGE_HTML).toContain('id="u_autoUpgrade"');
    expect(PAGE_HTML).toContain("Update now");
    expect(PAGE_HTML).toContain('src="/assets/xterm.js"');
    expect(PAGE_HTML).not.toMatch(/https?:\/\/(?!127)/); // nothing fetched from the internet
  });
});

describe("update + assets routes", () => {
  test("POST /api/update asks the daemon to update, restarting when idle by default", async () => {
    const t = await setup();
    const post = (body: unknown) =>
      fetch(`${t.ui.url}/api/update`, {
        method: "POST",
        headers: { "x-claude-rc-token": t.ui.token, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await post({})).status).toBe(200);
    expect((await post({ restart: false })).status).toBe(200);
    expect(t.reqs).toEqual([
      { cmd: "update", restart: true },
      { cmd: "update", restart: false },
    ]);
  });
  test("serves xterm assets without a token but still enforces Host", async () => {
    const t = await setup();
    const js = await fetch(`${t.ui.url}/assets/xterm.js`);
    expect(js.status).toBe(200);
    expect((await js.text()).length).toBeGreaterThan(10_000);
    expect((await fetch(`${t.ui.url}/assets/xterm.css`)).headers.get("content-type")).toContain(
      "text/css",
    );
    expect(
      (await fetch(`${t.ui.url}/assets/xterm.js`, { headers: { host: "evil.example" } })).status,
    ).toBe(403);
  });
});

describe("browser terminal websocket", () => {
  test("refuses sessions that do not exist, missing Origin, foreign Origin and a disabled switch", async () => {
    const t = await setup(() => undefined);
    const plain = (h: Record<string, string>) =>
      fetch(`${t.ui.url}/ws/term/x`, { headers: { upgrade: "websocket", ...h } });
    expect((await plain({ origin: t.ui.url })).status).toBe(404);
    const t2 = await setup(() => ["true"]);
    expect((await fetch(`${t2.ui.url}/ws/term/x`)).status).toBe(403); // no Origin
    expect(
      (await fetch(`${t2.ui.url}/ws/term/x`, { headers: { origin: "http://evil.example" } }))
        .status,
    ).toBe(403);
    const t3 = await setup(() => ["true"], { ui: { terminal: false } });
    expect((await fetch(`${t3.ui.url}/ws/term/x`, { headers: { origin: t3.ui.url } })).status).toBe(
      403,
    );
  });

  test("closes a socket whose first message has a bad token, and one that never authenticates", async () => {
    const t = await setup(() => ["cat"]);
    const c = connect(t.ui, "x");
    expect(await c.opened).toBe(true);
    c.ws.send(JSON.stringify({ token: "wrong" }));
    expect(await until(() => !!c.out.closed)).toBe(true);
    expect(c.out.closed!.code).toBe(4401);
    expect(c.out.text).toBe("");
  });

  test("bridges keyboard input and output to the command's pty", async () => {
    const t = await setup(() => ["cat"]);
    const c = connect(t.ui, "x");
    expect(await c.opened).toBe(true);
    c.ws.send(JSON.stringify({ token: t.ui.token, cols: 80, rows: 24 }));
    c.ws.send("hello-term\n");
    expect(await until(() => c.out.text.includes("hello-term"))).toBe(true);
    c.ws.close();
  });

  test("control frames are never written to the pty as keyboard input", async () => {
    const t = await setup(() => ["cat"]);
    const c = connect(t.ui, "x");
    expect(await c.opened).toBe(true);
    c.ws.send(JSON.stringify({ token: t.ui.token, cols: 80, rows: 24 }));
    c.ws.send('{"type":"resize","cols":"abc","rows":24}');
    c.ws.send('{"type":"paste","text":"leak-me"}');
    c.ws.send("after-frames\n");
    expect(await until(() => c.out.text.includes("after-frames"))).toBe(true);
    expect(c.out.text).not.toContain("leak-me");
    expect(c.out.text).not.toContain("resize");
    c.ws.close();
  });

  test.skipIf(!TMUX)(
    "attaches to a real tmux session, shows its output and leaves it running on close",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "rc-wt-tmux-"));
      const sock = join(dir, "s.sock");
      const conf = join(dir, "tmux.conf");
      writeFileSync(conf, tmuxConf("demo"));
      const run = (...a: string[]) =>
        Bun.spawnSync([TMUX!, "-S", sock, "-f", conf, ...a], { stdout: "pipe", stderr: "pipe" });
      expect(
        run("new-session", "-d", "-s", "rc", "sh", "-c", "echo session-says-hi; exec sleep 60")
          .exitCode,
      ).toBe(0);
      cleanups.push(() => run("kill-server"));

      const t = await setup((n) => (n === "demo" ? attachArgv(TMUX!, sock) : undefined));
      const c = connect(t.ui, "demo");
      expect(await c.opened).toBe(true);
      c.ws.send(JSON.stringify({ token: t.ui.token, cols: 100, rows: 30 }));
      expect(await until(() => c.out.text.includes("session-says-hi"))).toBe(true);
      expect(run("list-clients", "-t", "rc").stdout.toString().trim()).not.toBe("");
      c.ws.send(JSON.stringify({ type: "resize", cols: 90, rows: 20 }));
      c.ws.close();
      // The client detaches but the session lives on.
      expect(
        await until(() => run("list-clients", "-t", "rc").stdout.toString().trim() === "", 5000),
      ).toBe(true);
      expect(run("has-session", "-t", "rc").exitCode).toBe(0);
    },
  );
});
