import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getPaths,
  type Exec,
  type FetchLike,
  type Notice,
  type ServiceSpec,
  type ServiceStatus,
  type Supervisor,
} from "@nsheaps/claude-rc-core";
import { Daemon } from "./daemon";

export function fakeSup(initial: Record<string, ServiceStatus["state"]> = {}) {
  const state = { ...initial };
  const log: string[] = [];
  const specs: Record<string, ServiceSpec> = {};
  const sup: Supervisor = {
    kind: "inproc",
    async start(s) {
      log.push(`start:${s.name}`);
      specs[s.name] = s;
      state[s.name] = "running";
    },
    async stop(n) {
      log.push(`stop:${n}`);
      delete state[n];
    },
    async status(n) {
      return {
        name: n,
        state: state[n] ?? "stopped",
        supervisor: "inproc",
        ...(state[n] ? { pid: 1 } : {}),
      };
    },
    async list() {
      return Object.keys(state);
    },
    async dispose() {
      log.push("dispose");
    },
  };
  return { sup, log, specs, state };
}

export function setup(
  opts: {
    config?: unknown;
    claude?: boolean;
    upgrade?: () => Promise<{ ok: boolean; output: string }>;
    sup?: ReturnType<typeof fakeSup>;
    ptyPrefix?: string[];
    fetch?: FetchLike;
    claudeVersion?: string;
    now?: () => number;
    /** Present = tmux is installed; the daemon wraps services in the keeper. */
    tmux?: { bin: string; selfCmd: string[] };
    exec?: Exec;
  } = {},
) {
  const home = mkdtempSync(join(tmpdir(), "rc-d-"));
  const paths = getPaths({}, home);
  mkdirSync(paths.daemonDir, { recursive: true });
  const repo = join(home, "repo");
  mkdirSync(repo);
  Bun.spawnSync(["git", "init", "-q", "-b", "main", repo]);
  const bin = join(home, "bin");
  mkdirSync(bin);
  if (opts.claude !== false) {
    writeFileSync(join(bin, "claude"), "#!/bin/sh\n");
    chmodSync(join(bin, "claude"), 0o755);
  }
  const writeConfig = (c: unknown) =>
    writeFileSync(paths.configPath, typeof c === "string" ? c : JSON.stringify(c));
  if (opts.config !== undefined)
    writeConfig(typeof opts.config === "function" ? (opts.config as any)(repo) : opts.config);
  const s = opts.sup ?? fakeSup();
  const calls: string[] = [];
  const lines: string[] = [];
  const notices: Notice[] = [];
  const d = new Daemon({
    notifier: { kind: "none", notify: async (n) => void notices.push(n) },
    fetch: opts.fetch,
    now: opts.now,
    claudeVersion: async () => opts.claudeVersion,
    env: { PATH: bin, HOME: home },
    home,
    paths,
    supervisor: s.sup,
    supervisorReason: "test",
    ptyPrefix: opts.ptyPrefix,
    tmux: opts.tmux,
    exec: opts.exec,
    upgrade:
      opts.upgrade ??
      (async (bin) => {
        calls.push(`upgrade:${bin}`);
        s.log.push("upgrade");
        return { ok: true, output: "up to date" };
      }),
    log: (m) => lines.push(m),
  });
  return { d, ...s, home, now: opts.now, paths, repo, calls, lines, notices, writeConfig, bin };
}
export const cfg = (repo: string, extra: object = {}) => ({
  repos: [{ name: "a", path: repo }],
  ...extra,
});
