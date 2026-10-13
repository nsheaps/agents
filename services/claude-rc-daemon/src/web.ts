import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute } from "node:path";
import {
  addRepo,
  loadConfig,
  removeRepo,
  updateSettings,
  type IpcRequest,
  type IpcResponse,
  type RcPaths,
} from "@nsheaps/claude-rc-core";
import { PAGE_HTML } from "./web-page";

export interface WebUiOptions {
  paths: RcPaths;
  /** Preferred port; 0 picks a free one. If taken, falls back to a free one. */
  port: number;
  /** The daemon's command handler (status/reload/start/stop/restart). */
  handle: (req: IpcRequest) => Promise<IpcResponse>;
  log: (msg: string) => void;
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

  const route = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    if (!allowed.has(req.headers.get("host") ?? "")) return fail(403, "bad Host header");
    const origin = req.headers.get("origin");
    if (origin && ![...allowed].some((h) => origin === `http://${h}`))
      return fail(403, "cross-origin request refused");

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
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
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
          name: typeof body.name === "string" && body.name ? body.name : basename(path),
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
