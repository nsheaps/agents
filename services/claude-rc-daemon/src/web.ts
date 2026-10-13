import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import {
  addRepo,
  deriveRepoName,
  loadConfig,
  removeRepo,
  updateSettings,
  type IpcRequest,
  type IpcResponse,
  type RcPaths,
} from "@nsheaps/claude-rc-core";
import { ASSETS } from "./assets";
import { PAGE_HTML } from "./web-page";

export interface WebUiOptions {
  paths: RcPaths;
  /** Preferred port; 0 picks a free one. If taken, falls back to a free one. */
  port: number;
  /** The daemon's command handler (status/reload/start/stop/restart). */
  handle: (req: IpcRequest) => Promise<IpcResponse>;
  log: (msg: string) => void;
  /** argv that attaches to a repo's tmux session, or undefined when it has none (browser terminal). */
  attach?: (name: string) => string[] | undefined;
}

interface TermData {
  name: string;
  authed: boolean;
  proc?: ReturnType<typeof Bun.spawn>;
  timer?: ReturnType<typeof setTimeout>;
}

export interface WebUi {
  url: string;
  token: string;
  stop(): Promise<void>;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const fail = (status: number, error: string) => json(status, { error });

function tokenOk(given: string | null, token: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Local settings/monitoring UI. Loopback only; every request needs the per-run token, a loopback
 * Host (DNS rebinding) and, if present, a same-origin Origin (CSRF). Mutations must be JSON.
 */
export async function startWebUi(opts: WebUiOptions): Promise<WebUi> {
  const token = randomBytes(32).toString("hex");
  let allowed = new Set<string>();

  const route = async (
    req: Request,
    srv: { upgrade: (r: Request, o: { data: TermData }) => boolean },
  ) => {
    const url = new URL(req.url);
    if (!allowed.has(req.headers.get("host") ?? "")) return fail(403, "bad Host header");
    const origin = req.headers.get("origin");
    if (origin && ![...allowed].some((h) => origin === `http://${h}`))
      return fail(403, "cross-origin request refused");

    // Static xterm.js assets: public library code, so no token (a <script src> can't send one).
    const asset = req.method === "GET" ? ASSETS[url.pathname] : undefined;
    if (asset)
      return new Response(asset.body, {
        headers: { "content-type": asset.type, "cache-control": "no-store" },
      });

    // Browser terminal: a WebSocket bridged to `tmux attach`. An Origin is mandatory (browsers
    // always send one; its absence means a non-browser client) and the token travels in the first
    // message rather than the URL.
    const tm = /^\/ws\/term\/([^/]+)$/.exec(url.pathname);
    if (tm) {
      if (!origin) return fail(403, "Origin header required");
      const c = loadConfig(opts.paths.configPath);
      if (c.ok && !c.config.ui.terminal)
        return fail(403, "browser terminal is disabled (ui.terminal)");
      const name = decodeURIComponent(tm[1]!);
      if (!opts.attach?.(name)) return fail(404, `no tmux session for "${name}"`);
      const data: TermData = { name, authed: false };
      return srv.upgrade(req, { data })
        ? (undefined as never)
        : fail(400, "websocket upgrade failed");
    }

    const isPage = url.pathname === "/" && req.method === "GET";
    const given = isPage ? url.searchParams.get("token") : req.headers.get("x-claude-rc-token");
    if (!tokenOk(given, token)) return fail(401, "missing or invalid token (use `claude-rc ui`)");

    if (isPage)
      return new Response(PAGE_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "content-security-policy":
            "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; base-uri 'none'; form-action 'none'",
        },
      });

    const mutating = req.method !== "GET";
    if (mutating && !(req.headers.get("content-type") ?? "").includes("application/json"))
      return fail(415, "mutating requests must send content-type: application/json");

    let body: any = {};
    if (mutating) {
      const text = await req.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return fail(400, "malformed JSON body");
        }
      }
    }

    const ipc = async (r: IpcRequest) => {
      const res = await opts.handle(r);
      return res.ok ? json(200, res.data ?? { ok: true }) : fail(409, res.error ?? "failed");
    };
    // Edit rc.json, then have the daemon pick the change up now (it also watches the file).
    const edit = async (fn: () => void) => {
      try {
        fn();
      } catch (e) {
        return fail(400, (e as Error).message);
      }
      return ipc({ cmd: "reload" });
    };

    const p = url.pathname;
    if (req.method === "GET" && p === "/api/status") return ipc({ cmd: "status" });
    if (req.method === "GET" && p === "/api/config") {
      const c = loadConfig(opts.paths.configPath);
      return c.ok ? json(200, c.config) : fail(500, c.errors.join("; "));
    }
    if (req.method === "POST" && p === "/api/reload") return ipc({ cmd: "reload" });
    if (req.method === "POST" && p === "/api/update")
      return ipc({ cmd: "update", restart: body?.restart !== false });
    if (req.method === "PUT" && p === "/api/settings")
      return edit(() => updateSettings(opts.paths.configPath, body));
    if (req.method === "POST" && p === "/api/repos") {
      return edit(() => {
        const path = body?.path;
        if (typeof path !== "string" || !path) throw new Error("path is required");
        if (!isAbsolute(path)) throw new Error(`path must be absolute (got "${path}")`);
        if (!existsSync(path) || !statSync(path).isDirectory())
          throw new Error(`path does not exist or is not a directory: ${path}`);
        addRepo(opts.paths.configPath, {
          name: typeof body.name === "string" && body.name ? body.name : deriveRepoName(path),
          path,
          ...(typeof body.spawn === "string" ? { spawn: body.spawn as never } : {}),
        });
      });
    }
    const m = /^\/api\/repos\/([^/]+)(?:\/(restart|start|stop))?$/.exec(p);
    if (m) {
      const name = decodeURIComponent(m[1]!);
      if (req.method === "DELETE" && !m[2])
        return edit(() => removeRepo(opts.paths.configPath, name));
      if (req.method === "POST" && m[2]) return ipc({ cmd: m[2], name });
    }
    return fail(404, "not found");
  };

  const bind = (port: number) =>
    Bun.serve({
      hostname: "127.0.0.1",
      port,
      fetch: route,
      websocket: {
        open(ws: { data: TermData; close: (c?: number, r?: string) => void }) {
          ws.data.timer = setTimeout(() => ws.close(4401, "auth timeout"), 5000);
        },
        message(ws: any, msg: string | Buffer) {
          const d = ws.data as TermData;
          const text = typeof msg === "string" ? msg : msg.toString("utf8");
          if (!d.authed) {
            let first: any;
            try {
              first = JSON.parse(text);
            } catch {}
            if (!first || !tokenOk(first.token ?? null, token))
              return ws.close(4401, "unauthorized");
            const argv = opts.attach?.(d.name);
            if (!argv) return ws.close(4404, "no session");
            clearTimeout(d.timer);
            d.authed = true;
            const size = (n: unknown, def: number, max: number) =>
              Number.isInteger(n) && (n as number) > 0 ? Math.min(n as number, max) : def;
            const dec = new TextDecoder();
            try {
              d.proc = Bun.spawn(argv, {
                env: { ...process.env, TERM: "xterm-256color" },
                terminal: {
                  cols: size(first.cols, 120, 500),
                  rows: size(first.rows, 40, 200),
                  data(_t, chunk) {
                    ws.send(dec.decode(chunk, { stream: true }));
                  },
                },
              });
            } catch (e) {
              ws.send(`\r\n[cannot attach: ${(e as Error).message}]\r\n`);
              return ws.close(1011, "spawn failed");
            }
            d.proc.exited.then(() => {
              try {
                ws.send("\r\n[detached]\r\n");
                ws.close(1000, "detached");
              } catch {}
            });
            return;
          }
          // After auth: JSON control frames are always consumed (applied or dropped), never typed.
          if (text.startsWith("{")) {
            try {
              const c = JSON.parse(text);
              if (c && typeof c === "object") {
                if (c.type === "resize" && Number.isInteger(c.cols) && Number.isInteger(c.rows))
                  d.proc?.terminal?.resize(
                    Math.min(Math.max(c.cols, 1), 500),
                    Math.min(Math.max(c.rows, 1), 200),
                  );
                return;
              }
            } catch {}
          }
          d.proc?.terminal?.write(text);
        },
        close(ws: any) {
          const d = ws.data as TermData;
          clearTimeout(d.timer);
          // Closing the pty detaches the tmux client; the session keeps running.
          d.proc?.terminal?.close();
          d.proc?.kill();
        },
      },
      error: () => fail(500, "internal error"),
    });
  let server: ReturnType<typeof bind>;
  try {
    server = bind(opts.port);
  } catch (e) {
    if (opts.port === 0) throw e;
    opts.log(`web UI: port ${opts.port} unavailable (${(e as Error).message}); using a free port`);
    server = bind(0);
  }
  const port = server.port as number;
  allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const url = `http://127.0.0.1:${port}`;

  mkdirSync(dirname(opts.paths.uiPath), { recursive: true });
  writeFileSync(
    opts.paths.uiPath,
    JSON.stringify({ url, port, token, pid: process.pid }, null, 2),
    {
      mode: 0o600,
    },
  );
  chmodSync(opts.paths.uiPath, 0o600); // writeFileSync's mode only applies to new files
  opts.log(`web UI listening on ${url} (open with: claude-rc ui)`);

  return {
    url,
    token,
    async stop() {
      await server.stop(true);
      try {
        unlinkSync(opts.paths.uiPath);
      } catch {}
    },
  };
}
