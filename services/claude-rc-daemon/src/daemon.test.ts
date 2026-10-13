import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getPaths,
  type FetchLike,
  type Notice,
  type ServiceSpec,
  type ServiceStatus,
  type Supervisor,
} from "@nsheaps/claude-rc-core";
import { Daemon } from "./daemon";

function fakeSup(initial: Record<string, ServiceStatus["state"]> = {}) {
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

function setup(
  opts: {
    config?: unknown;
    claude?: boolean;
    upgrade?: () => Promise<{ ok: boolean; output: string }>;
    sup?: ReturnType<typeof fakeSup>;
    ptyPrefix?: string[];
    fetch?: FetchLike;
    claudeVersion?: string;
    now?: () => number;
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
    upgrade:
      opts.upgrade ??
      (async (bin) => {
        calls.push(`upgrade:${bin}`);
        s.log.push("upgrade");
        return { ok: true, output: "up to date" };
      }),
    log: (m) => lines.push(m),
  });
  return { d, ...s, home, paths, repo, calls, lines, notices, writeConfig, bin };
}
const cfg = (repo: string, extra: object = {}) => ({
  repos: [{ name: "a", path: repo }],
  ...extra,
});

describe("Daemon startup", () => {
  test("runs claude upgrade BEFORE starting any service", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    expect(t.log[0]).toBe("upgrade");
    expect(t.log).toContain("start:a");
    expect(t.log.indexOf("upgrade")).toBeLessThan(t.log.indexOf("start:a"));
    expect(t.calls[0]).toBe(`upgrade:${join(t.bin, "claude")}`);
  });
  test("starts `claude rc --spawn worktree --verbose` in the repo with config env", async () => {
    const t = setup({ config: (r: string) => cfg(r, { env: { FOO: "bar" } }) });
    await t.d.start();
    const s = t.specs.a!;
    expect(s.argv.slice(1)).toEqual(["rc", "--spawn", "worktree", "--verbose"]);
    expect(s.cwd).toBe(t.repo);
    expect(s.env.FOO).toBe("bar");
  });
  test("with a pty prefix, claude runs inside `<self> pty-run --` (start and restart)", async () => {
    const t = setup({ config: (r: string) => cfg(r), ptyPrefix: ["/x/rcd", "pty-run", "--"] });
    await t.d.start();
    expect(t.specs.a!.argv.slice(0, 3)).toEqual(["/x/rcd", "pty-run", "--"]);
    expect(t.specs.a!.argv.slice(4)).toEqual(["rc", "--spawn", "worktree", "--verbose"]);
    await t.d.handle({ cmd: "restart", name: "a" });
    expect(t.specs.a!.argv.slice(0, 3)).toEqual(["/x/rcd", "pty-run", "--"]);
  });
  test("upgrade failure is non-fatal and reported in status", async () => {
    const t = setup({
      config: (r: string) => cfg(r),
      upgrade: async () => ({ ok: false, output: "network down" }),
    });
    await t.d.start();
    expect(t.log).toContain("start:a");
    const st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.upgrade.ok).toBe(false);
    expect(st.upgrade.output).toContain("network down");
  });
  test("missing config file -> no services, no error", async () => {
    const t = setup();
    await t.d.start();
    const st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.repos).toEqual([]);
    expect(st.configError).toBeUndefined();
    expect(st.configMissing).toBe(true);
  });
  test("invalid config -> stays up degraded, nothing started; fixing it + reload recovers", async () => {
    const t = setup({ config: "{bad" });
    await t.d.start();
    let st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.configError).toContain("rc.json");
    expect(t.log).not.toContain("start:a");
    t.writeConfig(cfg(t.repo));
    expect((await t.d.handle({ cmd: "reload" })).ok).toBe(true);
    st = (await t.d.handle({ cmd: "status" })).data;
    expect(st.configError).toBeUndefined();
    expect(t.log).toContain("start:a");
  });
  test("invalid config on reload keeps the last good services running", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    t.writeConfig("{bad");
    const r = await t.d.handle({ cmd: "reload" });
    expect(r.ok).toBe(false);
    expect(t.log).not.toContain("stop:a");
  });
  test("claude not installed -> reported, services not started, no crash", async () => {
    const t = setup({ config: (r: string) => cfg(r), claude: false });
    await t.d.start();
    const st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.claudeError).toMatch(/claude.*not found/i);
    expect(t.log).toEqual([]);
  });
});

describe("Daemon trust", () => {
  test("autoTrust (default) marks each repo trusted in ~/.claude.json", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    const j = JSON.parse(readFileSync(t.paths.claudeJson, "utf8"));
    expect(Object.values(j.projects).some((p: any) => p.hasTrustDialogAccepted === true)).toBe(
      true,
    );
    expect(Object.keys(j.projects)[0]).toContain("repo");
  });
  test("autoTrust:false leaves ~/.claude.json alone", async () => {
    const t = setup({ config: (r: string) => cfg(r, { autoTrust: false }) });
    await t.d.start();
    expect(Bun.file(t.paths.claudeJson).size).toBe(0);
  });
  test("trust failure on one repo is reported, service still attempted", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    writeFileSync(t.paths.claudeJson, "{corrupt");
    await t.d.start();
    const st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.repos[0].trustError).toContain("not valid JSON");
    expect(readFileSync(t.paths.claudeJson, "utf8")).toBe("{corrupt");
  });
});

describe("Daemon control", () => {
  test("reload with a repo removed stops its service", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    t.writeConfig({ repos: [] });
    await t.d.handle({ cmd: "reload" });
    expect(t.log).toContain("stop:a");
  });
  test("restart <name> restarts only that service; unknown name errors", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    t.log.length = 0;
    expect((await t.d.handle({ cmd: "restart", name: "a" })).ok).toBe(true);
    expect(t.log).toEqual(["start:a"]);
    const bad = await t.d.handle({ cmd: "restart", name: "zzz" });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("zzz");
  });
  test("stop <name> stops and status reports stopped; start brings it back", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    await t.d.handle({ cmd: "stop", name: "a" });
    let st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.repos[0].state).toBe("stopped");
    await t.d.handle({ cmd: "start", name: "a" });
    st = (await t.d.handle({ cmd: "status" })).data;
    expect(st.repos[0].state).toBe("running");
  });
  test("a manually stopped service stays stopped across reload", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    await t.d.handle({ cmd: "stop", name: "a" });
    t.log.length = 0;
    await t.d.handle({ cmd: "reload" });
    expect(t.log).not.toContain("start:a");
  });
  test("shutdown stops children then disposes the supervisor", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    t.log.length = 0;
    await t.d.shutdown();
    expect(t.log).toEqual(["stop:a", "dispose"]);
  });
  test("status lists repos with supervisor state", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    const st: any = (await t.d.handle({ cmd: "status" })).data;
    expect(st.supervisor).toEqual({ kind: "inproc", reason: "test" });
    expect(st.repos[0]).toMatchObject({
      name: "a",
      path: t.repo,
      state: "running",
      spawn: "worktree",
    });
    expect(st.pid).toBe(process.pid);
    expect(st.phase).toBe("ready");
  });
  test("unknown command -> error", async () => {
    const t = setup();
    const r = await t.d.handle({ cmd: "wat" });
    expect(r.ok).toBe(false);
  });
});

describe("Daemon restart adoption", () => {
  test("a new daemon adopts still-running unchanged services without bouncing them", async () => {
    const shared = fakeSup();
    const t1 = setup({ config: (r: string) => cfg(r), sup: shared });
    await t1.d.start(); // persists state.json
    // simulate daemon crash: children keep running in the (shared) supervisor
    shared.log.length = 0;
    const d2 = new Daemon({
      env: { PATH: t1.bin, HOME: t1.home },
      home: t1.home,
      paths: t1.paths,
      supervisor: shared.sup,
      supervisorReason: "test",
      upgrade: async () => ({ ok: true, output: "" }),
      log: () => {},
    });
    await d2.start();
    expect(shared.log).not.toContain("start:a");
    const st: any = (await d2.handle({ cmd: "status" })).data;
    expect(st.repos[0].action).toBe("kept");
  });
});

describe("Daemon notifications", () => {
  test("notifies when a service starts, once", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    await t.d.pollOnce();
    expect(t.notices.map((n) => n.title)).toEqual(["a started"]);
    await t.d.pollOnce();
    expect(t.notices.length).toBe(1);
  });

  test("notifies with the log path when a service exits on its own", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    await t.d.pollOnce();
    t.state.a = "failed";
    await t.d.pollOnce();
    expect(t.notices.at(-1)!.title).toBe("a exited");
    expect(t.notices.at(-1)!.body).toContain(`${t.paths.logDir}/a.log`);
  });

  test("a user stop is not reported as an exit", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    await t.d.start();
    await t.d.pollOnce();
    await t.d.handle({ cmd: "stop", name: "a" });
    await t.d.pollOnce();
    expect(t.notices.map((n) => n.title)).toEqual(["a started"]);
  });

  test("onStart:false and onExit:false suppress just those", async () => {
    const t = setup({
      config: (r: string) => cfg(r, { notifications: { onStart: false } }),
    });
    await t.d.start();
    await t.d.pollOnce();
    expect(t.notices).toEqual([]);
    t.state.a = "failed";
    await t.d.pollOnce();
    expect(t.notices.map((n) => n.title)).toEqual(["a exited"]);
  });

  test("notifications.enabled:false silences everything", async () => {
    const t = setup({
      config: (r: string) => cfg(r, { notifications: { enabled: false } }),
    });
    await t.d.start();
    await t.d.pollOnce();
    t.state.a = "failed";
    await t.d.pollOnce();
    expect(t.notices).toEqual([]);
  });

  test("a throwing notifier never breaks polling", async () => {
    const t = setup({ config: (r: string) => cfg(r) });
    (t.d as any).d.notifier = {
      kind: "none",
      notify: async () => {
        throw new Error("boom");
      },
    };
    await t.d.start();
    await expect(t.d.pollOnce()).resolves.toBeDefined();
  });
});

describe("Daemon update check", () => {
  const net: FetchLike = async (url) =>
    url.includes("github")
      ? new Response(JSON.stringify([{ tag_name: "claude-rc-v1.4.0" }]))
      : new Response(JSON.stringify({ version: "2.5.0" }));

  test("notifies for both, persists, and does not repeat within a day", async () => {
    let now = 1_000_000_000_000;
    const calls: string[] = [];
    const t = setup({
      config: (r: string) => cfg(r),
      claudeVersion: "2.4.0",
      now: () => now,
      fetch: async (u, i) => (calls.push(u), net(u, i)),
    });
    await t.d.start();
    await t.d.checkUpdates();
    expect(t.notices.map((n) => n.title).sort()).toEqual([
      "Claude Code 2.5.0 available",
      "claude-rc 1.4.0 available",
    ]);
    expect(JSON.parse(readFileSync(t.paths.statePath, "utf8")).update.lastCheck).toBe(now);
    const n = calls.length;
    now += 60_000;
    await t.d.checkUpdates();
    expect(calls.length).toBe(n);
    const st = (await t.d.handle({ cmd: "status" })) as any;
    expect(st.data.updates.latest).toEqual({ claudeRc: "1.4.0", claude: "2.5.0" });
  });

  test("a fresh daemon reads lastCheck from state.json (survives restart)", async () => {
    const now = 1_000_000_000_000;
    const t = setup({
      config: (r: string) => cfg(r),
      claudeVersion: "2.4.0",
      now: () => now,
      fetch: net,
    });
    await t.d.start();
    await t.d.checkUpdates();
    let called = false;
    const t2 = setup({
      config: (r: string) => cfg(r),
      now: () => now,
      fetch: async (u, i) => ((called = true), net(u, i)),
    });
    writeFileSync(t2.paths.statePath, readFileSync(t.paths.statePath));
    const d2 = new Daemon((t2.d as any).d);
    await d2.checkUpdates();
    expect(called).toBe(false);
  });

  test("updates.* switches are honoured", async () => {
    const t = setup({
      config: (r: string) => cfg(r, { updates: { claudeRc: false, claude: false } }),
      claudeVersion: "2.4.0",
      fetch: async () => {
        throw new Error("must not be called");
      },
    });
    await t.d.start();
    await t.d.checkUpdates();
    expect(t.notices).toEqual([]);
  });
});
