/**
 * End-to-end: real `claude-rc-daemon` + real `claude-rc` CLI processes against a fake `claude`.
 * Supervisor defaults to inproc (works everywhere). CI runs it again with
 * CLAUDE_RC_E2E_SUPERVISOR=systemd (Linux runner) / launchd (macOS runner).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SUP = process.env.CLAUDE_RC_E2E_SUPERVISOR ?? "inproc";
const NATIVE = SUP !== "inproc";
const ROOT = resolve(import.meta.dir, "../../..");
const DAEMON = join(ROOT, "services/claude-rc-daemon/src/main.ts");
const CLI = join(ROOT, "apps/claude-rc-cli/src/main.ts");
const T = NATIVE ? 60_000 : 25_000;

const home = Bun.spawnSync(["realpath", mkdtempSync(join(tmpdir(), "rc-e2e-"))])
  .stdout.toString()
  .trim();
const bin = join(home, "bin");
const fakeLog = join(home, "fake.log");
const notifyLog = join(home, "notify.log");
const repo = join(home, "proj");
const env = {
  ...process.env,
  HOME: home,
  PATH: `${bin}:${process.env.PATH}`,
  XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? "",
  CLAUDE_RC_POLL_MS: "300",
} as Record<string, string>;
delete env.CLAUDE_RC_HOME;
delete env.CLAUDE_CONFIG_DIR;
delete env.CLAUDE_RC_SUPERVISOR;
const rcJson = join(home, ".claude/daemon/rc.json");
let daemon: ReturnType<typeof Bun.spawn> | undefined;

async function cli(...args: string[]) {
  const p = Bun.spawn(["bun", "run", CLI, ...args], {
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { stdout, stderr, code };
}
async function until<T>(f: () => Promise<T | false | undefined>, ms = T): Promise<T> {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await f();
    if (v) return v;
    await Bun.sleep(150);
  }
  throw new Error("timed out waiting");
}
const status = async () => JSON.parse((await cli("status", "--json")).stdout);
const repoState = async () => (await status()).repos.find((r: any) => r.name === "proj");
const running = async () => {
  const r = await repoState();
  return r?.state === "running" && r.pid ? r : false;
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

beforeAll(async () => {
  mkdirSync(bin, { recursive: true });
  mkdirSync(repo, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main", repo]);
  writeFileSync(
    join(bin, "claude"),
    `#!/bin/sh
case "$1" in
  upgrade) echo "upgrade called" >> "${fakeLog}"; echo "Claude Code is up to date"; exit 0;;
  rc)
    # Like the real thing, refuse to run without a terminal.
    if [ ! -t 0 ] || [ ! -t 1 ]; then echo "Error: claude rc needs an interactive terminal (no TTY)" >&2; [ -n "$FAKE_PROBE" ] || echo "rc-no-tty" >> "${fakeLog}"; exit 1; fi
    echo "rc $* cwd=$(pwd) FOO=$FOO" >> "${fakeLog}"; echo "fake claude rc running"; exec sleep 600;;
esac
`,
  );
  chmodSync(join(bin, "claude"), 0o755);
  // Linux notifier shells out to notify-send; a fake records what would have been shown.
  writeFileSync(join(bin, "notify-send"), `#!/bin/sh\necho "$*" >> "${notifyLog}"\n`);
  chmodSync(join(bin, "notify-send"), 0o755);
  mkdirSync(join(home, ".claude/daemon"), { recursive: true });
  writeFileSync(rcJson, JSON.stringify({ repos: [], env: { FOO: "bar" }, ui: { port: 0 } }));
  daemon = Bun.spawn(["bun", "run", DAEMON, "--supervisor", SUP], {
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  await until(async () => (await cli("status")).code === 0 && (await status()).phase === "ready");
}, T);

afterAll(async () => {
  await cli("shutdown");
  await Promise.race([daemon?.exited, Bun.sleep(8000)]);
  daemon?.kill("SIGKILL");
});

describe("claude-rc e2e (" + SUP + ")", () => {
  test(
    "daemon is up with the requested supervisor and no repos",
    async () => {
      const r = await cli("status");
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(SUP);
      expect(r.stdout).toContain("no repos configured");
    },
    T,
  );

  test(
    "add: starts `claude upgrade` first, then `claude rc --spawn worktree --verbose` in the repo with env",
    async () => {
      const r = await cli("add", repo, "--name", "proj");
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("proj");
      const st = await until(running);
      expect(st.spawn).toBe("worktree");
      await until(
        async () => existsSync(fakeLog) && readFileSync(fakeLog, "utf8").includes("rc --spawn"),
      );
      const log = readFileSync(fakeLog, "utf8").trim().split("\n");
      expect(log[0]).toBe("upgrade called");
      expect(log.some((l) => l === `rc rc --spawn worktree --verbose cwd=${repo} FOO=bar`)).toBe(
        true,
      );
    },
    T,
  );

  test("the fake claude refuses to run without a TTY (so the passing test above proves the PTY wrapper)", () => {
    const p = Bun.spawnSync([join(bin, "claude"), "rc"], {
      stdin: "ignore",
      env: { ...env, FAKE_PROBE: "1" },
    });
    expect(p.exitCode).toBe(1);
    expect(p.stderr.toString()).toContain("no TTY");
  });

  test("the supervised service got a terminal: log has no rc-no-tty line", () => {
    expect(readFileSync(fakeLog, "utf8")).not.toContain("rc-no-tty");
  });

  test("workspace trust was written to ~/.claude.json", () => {
    const j = JSON.parse(readFileSync(join(home, ".claude.json"), "utf8"));
    expect(j.projects[repo]?.hasTrustDialogAccepted).toBe(true);
  });

  test(
    "logs shows the child output",
    async () => {
      const r = await until(async () => {
        const x = await cli("logs", "proj", "-n", "20");
        return x.stdout.includes("fake claude rc running") ? x : false;
      });
      expect(r.code).toBe(0);
    },
    T,
  );

  test(
    "child killed -> supervisor restarts it (new pid)",
    async () => {
      const before = await repoState();
      process.kill(before.pid, "SIGKILL");
      const after = await until(async () => {
        const r = await running();
        return r && r.pid !== before.pid ? r : false;
      });
      expect(after.restarts).toBeGreaterThanOrEqual(1);
    },
    T,
  );

  test(
    "restart gives a new pid; stop stops (and sticks); start brings it back",
    async () => {
      const a = await repoState();
      expect((await cli("restart", "proj")).code).toBe(0);
      const b = await until(async () => {
        const r = await running();
        return r && r.pid !== a.pid ? r : false;
      });
      expect((await cli("stop", "proj")).code).toBe(0);
      await until(async () => (await repoState()).state === "stopped");
      expect(alive(b.pid)).toBe(false);
      expect((await cli("reload")).code).toBe(0);
      expect((await repoState()).state).toBe("stopped"); // manual stop survives reload
      expect((await cli("start", "proj")).code).toBe(0);
      await until(running);
    },
    T,
  );

  test(
    "restart of an unknown repo is a clear error",
    async () => {
      const r = await cli("restart", "nope");
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('unknown repo "nope"');
    },
    T,
  );

  test(
    "invalid config: validate fails, reload fails, daemon + child stay up",
    async () => {
      const good = readFileSync(rcJson, "utf8");
      const pid = (await repoState()).pid;
      writeFileSync(rcJson, "{ nope");
      expect((await cli("config", "validate")).code).toBe(1);
      expect((await cli("reload")).code).toBe(1);
      expect((await status()).configError).toContain("rc.json");
      expect((await repoState()).pid).toBe(pid);
      writeFileSync(rcJson, good);
      expect((await cli("reload")).code).toBe(0);
      expect((await status()).configError).toBeUndefined();
    },
    T,
  );

  test(
    "editing rc.json by hand is picked up automatically (file watch)",
    async () => {
      const cfg = JSON.parse(readFileSync(rcJson, "utf8"));
      cfg.repos[0].spawn = "same-dir";
      writeFileSync(rcJson, JSON.stringify(cfg));
      await until(async () => {
        const r = await running();
        return r && r.spawn === "same-dir" ? r : false;
      });
      await until(async () =>
        readFileSync(fakeLog, "utf8").includes("rc --spawn same-dir --verbose"),
      );
    },
    T,
  );

  test.skipIf(process.platform !== "linux")(
    "a desktop notification is sent when a service starts",
    async () => {
      await until(
        async () =>
          existsSync(notifyLog) && readFileSync(notifyLog, "utf8").includes("proj started"),
      );
    },
    T,
  );

  test(
    "web UI: `ui --print` gives a tokened URL; the API shows, edits and controls repos",
    async () => {
      const r = await cli("ui", "--print");
      expect(r.code).toBe(0);
      const link = new URL(r.stdout.trim());
      const token = link.searchParams.get("token")!;
      expect(link.hostname).toBe("127.0.0.1");
      const api = (method: string, path: string, body?: unknown) =>
        fetch(`${link.origin}${path}`, {
          method,
          headers: { "x-claude-rc-token": token, "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      expect((await fetch(`${link.origin}/api/status`)).status).toBe(401);
      const st: any = await (await api("GET", "/api/status")).json();
      expect(st.repos.map((x: any) => x.name)).toContain("proj");
      expect((await fetch(link.href)).status).toBe(200);

      const put = await api("PUT", "/api/settings", { notifications: { onExit: false } });
      expect(put.status).toBe(200);
      expect(JSON.parse(readFileSync(rcJson, "utf8")).notifications.onExit).toBe(false);
      await api("PUT", "/api/settings", { notifications: { onExit: true } });

      const pid = (await repoState()).pid;
      expect((await api("POST", "/api/repos/proj/restart")).status).toBe(200);
      await until(async () => {
        const s = await running();
        return s && s.pid !== pid ? s : false;
      });
    },
    T,
  );

  test(
    "doctor passes in a healthy setup",
    async () => {
      const r = await cli("doctor");
      expect(r.stdout).toContain("claude");
      expect(r.code).toBe(0);
    },
    T,
  );

  test(
    "remove stops the child",
    async () => {
      const pid = (await repoState()).pid;
      expect((await cli("remove", "proj")).code).toBe(0);
      await until(async () => !alive(pid));
      expect((await status()).repos).toEqual([]);
    },
    T,
  );

  test(
    "shutdown stops the daemon; status then says it is not running (exit 3)",
    async () => {
      await cli("add", repo, "--name", "proj");
      const pid = (await until(running)).pid;
      expect((await cli("shutdown")).code).toBe(0);
      await Promise.race([daemon!.exited, Bun.sleep(10_000)]);
      const r = await cli("status");
      expect(r.code).toBe(3);
      expect(r.stderr).toContain("not running");
      await until(async () => !alive(pid));
    },
    T,
  );
});
