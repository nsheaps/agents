import { chmodSync, existsSync, unlinkSync } from "node:fs";
import { createConnection, createServer } from "node:net";

export interface IpcRequest {
  cmd: string;
  name?: string;
  [k: string]: unknown;
}
export interface IpcResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}
export type IpcHandler = (req: IpcRequest) => Promise<IpcResponse>;

function alive(path: string): Promise<boolean> {
  return new Promise((res) => {
    const c = createConnection(path);
    c.once("connect", () => {
      c.destroy();
      res(true);
    });
    c.once("error", () => res(false));
  });
}

/** Newline-delimited JSON over a unix socket (0600). Returns an async close(). */
export async function serveIpc(path: string, handler: IpcHandler): Promise<() => Promise<void>> {
  if (existsSync(path)) {
    if (await alive(path))
      throw new Error(`a claude-rc daemon is already running (socket ${path})`);
    unlinkSync(path);
  }
  const conns = new Set<import("node:net").Socket>();
  const server = createServer((sock) => {
    conns.add(sock);
    sock.on("close", () => conns.delete(sock));
    sock.on("error", () => {});
    let buf = "";
    sock.on("data", (d) => {
      buf += d.toString();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        void (async () => {
          let res: IpcResponse;
          try {
            res = await handler(JSON.parse(line) as IpcRequest);
          } catch (e) {
            res = {
              ok: false,
              error:
                e instanceof SyntaxError ? `malformed request: ${e.message}` : (e as Error).message,
            };
          }
          if (!sock.destroyed) sock.write(JSON.stringify(res) + "\n");
        })();
      }
    });
  });
  // bind with a restrictive umask so the socket is never briefly world-connectable
  const prevUmask = process.umask(0o077);
  try {
    await new Promise<void>((res, rej) => {
      server.once("error", rej);
      server.listen(path, () => res());
    });
  } finally {
    process.umask(prevUmask);
  }
  chmodSync(path, 0o600);
  return () =>
    new Promise<void>((res) => {
      for (const c of conns) c.destroy();
      server.close(() => {
        try {
          unlinkSync(path);
        } catch {}
        res();
      });
    });
}

export function ipcRequest(
  path: string,
  req: IpcRequest,
  timeoutMs = 30_000,
): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    const c = createConnection(path);
    const timer = setTimeout(() => {
      c.destroy();
      reject(new Error(`request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let buf = "";
    c.once("connect", () => c.write(JSON.stringify(req) + "\n"));
    c.on("data", (d) => {
      buf += d.toString();
      const i = buf.indexOf("\n");
      if (i >= 0) {
        clearTimeout(timer);
        c.destroy();
        try {
          resolve(JSON.parse(buf.slice(0, i)) as IpcResponse);
        } catch (e) {
          reject(e);
        }
      }
    });
    c.once("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        e.code === "ENOENT" || e.code === "ECONNREFUSED"
          ? new Error(`claude-rc daemon is not running (no listener at ${path})`)
          : e,
      );
    });
  });
}
