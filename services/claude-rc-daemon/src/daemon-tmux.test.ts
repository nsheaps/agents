import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import type { Exec } from "@nsheaps/claude-rc-core";
import { Daemon } from "./daemon";
import { cfg, setup } from "./test-helpers";

const TMUX = { bin: "/usr/bin/tmux", selfCmd: ["/x/rcd"] };

interface Pane {
  dead?: boolean;
  status?: number;
  activity?: number; // epoch seconds
  attached?: number;
  tail?: string[];
  missing?: boolean;
}

/** Fake tmux: answers list-panes / capture-pane per repo socket (…/tmux/<name>.sock). */
function fakeTmux(initial: Record<string, Pane> = {}) {
  const panes: Record<string, Pane> = { ...initial };
  const exec: Exec = async (argv) => {
    const name = /\/tmux\/([^/]+)\.sock$/.exec(argv[2] ?? "")?.[1];
    const p = name ? panes[name] : undefined;
    if (!p || p.missing) return { code: 1, stdout: "", stderr: "no server" };
    if (argv.includes("list-panes"))
      return {
        code: 0,
        stdout: `${p.dead ? 1 : 0}|${p.status ?? ""}||77|${p.activity ?? 0}|${p.attached ?? 0}\n`,
        stderr: "",
      };
    if (argv.includes("capture-pane"))
      return { code: 0, stdout: (p.tail ?? []).join("\n") + "\n", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  return { panes, exec };
}

const repoStatus = async (d: Daemon, name = "a") => {
  const r = await d.handle({ cmd: "status" });
  return (r.data as any).repos.find((x: any) => x.name === name);
};

describe("terminal selection", () => {
  test("auto + tmux installed wraps claude in the keeper for that repo", async () => {
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: fakeTmux().exec });
    await t.d.start();
    const argv = t.specs.a!.argv;
    expect(argv.slice(0, 2)).toEqual(["/x/rcd", "tmux-run"]);
    expect(argv).toContain("--name");
    expect(argv[argv.indexOf("--name") + 1]).toBe("a");
    expect(argv[argv.indexOf("--tmux") + 1]).toBe("/usr/bin/tmux");
    expect(argv[argv.indexOf("--socket") + 1]).toBe(`${t.paths.runDir}/tmux/a.sock`);
    expect(argv.slice(argv.indexOf("--") + 1, argv.indexOf("--") + 3)).toEqual([
      `${t.bin}/claude`,
      "rc",
    ]);
  });

  test("auto without tmux falls back to pty-run", async () => {
    const t = setup({ config: (r: string) => cfg(r), ptyPrefix: ["/x/rcd", "pty-run", "--"] });
    await t.d.start();
    expect(t.specs.a!.argv.slice(0, 2)).toEqual(["/x/rcd", "pty-run"]);
  });

  test('terminal:"pty" ignores an installed tmux', async () => {
    const t = setup({
      config: (r: string) => cfg(r, { terminal: "pty" }),
      tmux: TMUX,
      ptyPrefix: ["/x/rcd", "pty-run", "--"],
    });
    await t.d.start();
    expect(t.specs.a!.argv[1]).toBe("pty-run");
  });

  test('terminal:"tmux" without tmux is a reported config problem, not a silent downgrade', async () => {
    const t = setup({
      config: (r: string) => cfg(r, { terminal: "tmux" }),
      ptyPrefix: ["/x/rcd", "pty-run", "--"],
    });
    await t.d.start();
    const r = await t.d.handle({ cmd: "reload" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("tmux");
    expect(t.specs.a).toBeUndefined();
  });

  test("status tells a human how to connect", async () => {
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: fakeTmux().exec });
    await t.d.start();
    const s = await repoStatus(t.d);
    expect(s.terminal).toBe("tmux");
    expect(s.attach.socket).toBe(`${t.paths.runDir}/tmux/a.sock`);
    expect(s.attach.command).toBe(`tmux -S ${t.paths.runDir}/tmux/a.sock attach -t rc`);
  });

  test("pty repos have no attach info", async () => {
    const t = setup({ config: (r: string) => cfg(r), ptyPrefix: ["/x/rcd", "pty-run", "--"] });
    await t.d.start();
    const s = await repoStatus(t.d);
    expect(s.terminal).toBe("pty");
    expect(s.attach).toBeUndefined();
  });
});

describe("health monitoring", () => {
  test("a live session with ordinary output is ok and shows its tail", async () => {
    const ft = fakeTmux({ a: { activity: 100, tail: ["Remote Control active"] } });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec });
    await t.d.start();
    await t.d.pollOnce();
    const h = (await repoStatus(t.d)).health;
    expect(h).toMatchObject({ state: "ok", tail: ["Remote Control active"], attached: 0 });
  });

  test("a blocking prompt is flagged and notified once per distinct line", async () => {
    const ft = fakeTmux({ a: { tail: ["Do you trust this folder?"] } });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec });
    await t.d.start();
    await t.d.pollOnce();
    const att = () => t.notices.filter((n) => n.title.includes("needs attention"));
    expect((await repoStatus(t.d)).health).toMatchObject({
      state: "attention",
      detail: "Do you trust this folder?",
    });
    expect(att().length).toBe(1);
    expect(att()[0]!.body).toContain("Do you trust this folder?");
    await t.d.pollOnce();
    expect(att().length).toBe(1);
    ft.panes.a!.tail = ["not logged in"];
    await t.d.pollOnce();
    expect(att().length).toBe(2);
    ft.panes.a!.tail = ["fine now"];
    await t.d.pollOnce();
    ft.panes.a!.tail = ["not logged in"]; // same problem again after recovering: tell again
    await t.d.pollOnce();
    expect(att().length).toBe(3);
  });

  test("onExit:false also silences attention notices; the state is still reported", async () => {
    const ft = fakeTmux({ a: { tail: ["not logged in"] } });
    const t = setup({
      config: (r: string) => cfg(r, { notifications: { onExit: false } }),
      tmux: TMUX,
      exec: ft.exec,
    });
    await t.d.start();
    await t.d.pollOnce();
    expect(t.notices.some((n) => n.title.includes("attention"))).toBe(false);
    expect((await repoStatus(t.d)).health.state).toBe("attention");
  });

  test("a service that runs but has lost its tmux session is down once the startup grace passes", async () => {
    const ft = fakeTmux({ a: { missing: true } });
    let clock = 1_000_000;
    const t = setup({
      config: (r: string) => cfg(r),
      tmux: TMUX,
      exec: ft.exec,
      now: () => clock,
    });
    await t.d.start();
    await t.d.pollOnce();
    // Just (re)started: the session may still be being created, so not "down" yet.
    expect((await repoStatus(t.d)).health).toMatchObject({ state: "unknown", detail: "starting" });
    clock += 11_000;
    await t.d.pollOnce();
    expect((await repoStatus(t.d)).health).toMatchObject({ state: "down" });
  });

  test("a dead pane is down with its exit status", async () => {
    const ft = fakeTmux({ a: { dead: true, status: 3, tail: ["boom"] } });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec });
    await t.d.start();
    await t.d.pollOnce();
    const h = (await repoStatus(t.d)).health;
    expect(h.state).toBe("down");
    expect(h.detail).toContain("3");
    expect(h.tail).toEqual(["boom"]);
  });

  test("three exits in ten minutes is a crash loop, announced once", async () => {
    let now = 1_000_000;
    const ft = fakeTmux({ a: { tail: ["x"] } });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec, now: () => now });
    await t.d.start();
    await t.d.pollOnce();
    for (let i = 0; i < 4; i++) {
      now += 20_000;
      t.state.a = "failed";
      await t.d.pollOnce();
      t.state.a = "running";
      await t.d.pollOnce();
    }
    const loops = t.notices.filter((n) => n.title.includes("crashing"));
    expect(loops.length).toBe(1);
    expect((await repoStatus(t.d)).health.state).toBe("crash-loop");
  });

  test("pty mode only knows liveness", async () => {
    const t = setup({ config: (r: string) => cfg(r), ptyPrefix: ["/x/rcd", "pty-run", "--"] });
    await t.d.start();
    await t.d.pollOnce();
    expect((await repoStatus(t.d)).health.state).toBe("unknown");
  });

  test("a stopped service is down", async () => {
    const ft = fakeTmux({ a: {} });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec });
    await t.d.start();
    await t.d.handle({ cmd: "stop", name: "a" });
    expect((await repoStatus(t.d)).health.state).toBe("down");
  });
});

describe("restarts the user asked for are not reported as crashes", () => {
  test("restart via IPC produces no 'exited and was restarted' notice", async () => {
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: fakeTmux({ a: {} }).exec });
    await t.d.start();
    await t.d.pollOnce();
    const before = t.notices.length;
    await t.d.handle({ cmd: "restart", name: "a" });
    (t.d as any).d.supervisor.status = async (n: string) => ({
      name: n,
      state: "running",
      pid: 2,
      supervisor: "inproc",
    });
    await t.d.pollOnce();
    expect(t.notices.slice(before).map((n) => n.title)).toEqual([]);
  });
});

describe("update controls", () => {
  const FETCH = async (url: string) =>
    url.includes("github")
      ? new Response(JSON.stringify([{ tag_name: "claude-rc-v99.0.0" }]))
      : new Response(JSON.stringify({ version: "9.9.9" }));

  test("autoUpgrade:false skips `claude upgrade` at startup; default runs it", async () => {
    const off = setup({ config: (r: string) => cfg(r, { updates: { autoUpgrade: false } }) });
    await off.d.start();
    expect(off.calls).toEqual([]);
    const on = setup({ config: (r: string) => cfg(r) });
    await on.d.start();
    expect(on.calls.length).toBe(1);
  });

  test("autoUpgrade:false with a broken config still falls back to upgrading", async () => {
    const t = setup({ config: "{bad" });
    await t.d.start();
    expect(t.calls.length).toBe(1);
  });

  test("status reports installed, latest and what is available", async () => {
    const t = setup({
      config: (r: string) => cfg(r),
      fetch: FETCH as any,
      claudeVersion: "2.0.0",
      now: () => 5_000_000_000,
    });
    await t.d.start();
    await t.d.checkUpdates();
    const u = ((await t.d.handle({ cmd: "status" })).data as any).updates;
    expect(u.installed.claude).toBe("2.0.0");
    expect(u.latest).toEqual({ claudeRc: "99.0.0", claude: "9.9.9" });
    expect(u.available).toEqual({ claudeRc: "99.0.0", claude: "9.9.9" });
    expect(u.autoUpgrade).toBe(true);
  });

  test("update notices fan out to all users unless notifications.allUsers is off", async () => {
    const mk = async (extra: object) => {
      const t = setup({
        config: (r: string) => cfg(r, extra),
        fetch: FETCH as any,
        claudeVersion: "2.0.0",
        now: () => 5_000_000_000,
      });
      await t.d.start();
      await t.d.checkUpdates();
      return t.notices.filter((n) => n.title.includes("available"));
    };
    expect((await mk({})).every((n) => n.broadcast === true)).toBe(true);
    const off = await mk({ notifications: { allUsers: false } });
    expect(off.length).toBe(2);
    expect(off.every((n) => !n.broadcast)).toBe(true);
  });

  test("update now upgrades, then restarts a repo only once it is idle", async () => {
    let now = 10_000_000;
    const ft = fakeTmux({ a: { activity: now / 1000, attached: 0, tail: ["x"] } });
    const t = setup({
      config: (r: string) => cfg(r, { updates: { idleSeconds: 60 } }),
      tmux: TMUX,
      exec: ft.exec,
      now: () => now,
    });
    await t.d.start();
    await t.d.pollOnce();
    const starts = () => t.log.filter((l) => l === "start:a").length;
    const base = starts();

    const r = await t.d.handle({ cmd: "update" });
    expect(r.ok).toBe(true);
    expect(t.calls.length).toBe(2); // startup + update now
    expect((await repoStatus(t.d)).restartPending).toBe(true);

    await t.d.pollOnce(); // active a moment ago: not idle
    expect(starts()).toBe(base);

    now += 30_000;
    await t.d.pollOnce(); // 30 s quiet < 60 s
    expect(starts()).toBe(base);

    ft.panes.a!.attached = 1; // someone connects: never idle while attached
    now += 120_000;
    await t.d.pollOnce();
    expect(starts()).toBe(base);

    ft.panes.a!.attached = 0;
    await t.d.pollOnce();
    expect(starts()).toBe(base + 1);
    expect((await repoStatus(t.d)).restartPending).toBeUndefined();
    expect(t.notices.some((n) => n.title.includes("restarted") && n.body.includes("update"))).toBe(
      true,
    );
  });

  test("update now with restart:false upgrades but queues nothing", async () => {
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: fakeTmux({ a: {} }).exec });
    await t.d.start();
    const r = await t.d.handle({ cmd: "update", restart: false });
    expect(r.ok).toBe(true);
    expect((await repoStatus(t.d)).restartPending).toBeUndefined();
  });

  test("a failed upgrade is reported and nothing is queued", async () => {
    let n = 0;
    const t = setup({
      config: (r: string) => cfg(r),
      tmux: TMUX,
      exec: fakeTmux({ a: {} }).exec,
      upgrade: async () =>
        ++n === 1 ? { ok: true, output: "" } : { ok: false, output: "no network" },
    });
    await t.d.start();
    const r = await t.d.handle({ cmd: "update" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("no network");
    expect((await repoStatus(t.d)).restartPending).toBeUndefined();
  });

  test("stopped repos are not queued; a repo the user stops meanwhile is dropped", async () => {
    const ft = fakeTmux({ a: { activity: 0 } });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec, now: () => 1e9 });
    await t.d.start();
    await t.d.handle({ cmd: "update" });
    await t.d.handle({ cmd: "stop", name: "a" });
    const base = t.log.filter((l) => l === "start:a").length;
    await t.d.pollOnce();
    expect(t.log.filter((l) => l === "start:a").length).toBe(base); // not resurrected
    expect((await repoStatus(t.d)).restartPending).toBeUndefined();
  });

  test("the pending list survives a daemon restart", async () => {
    const ft = fakeTmux({ a: { activity: 1e9 / 1000, attached: 1 } });
    const t = setup({ config: (r: string) => cfg(r), tmux: TMUX, exec: ft.exec, now: () => 1e9 });
    await t.d.start();
    await t.d.handle({ cmd: "update" });
    const state = JSON.parse(readFileSync(t.paths.statePath, "utf8"));
    expect(state.pendingRestart).toEqual(["a"]);
    expect(existsSync(t.paths.statePath)).toBe(true);
  });

  test("pty repos are idle by log inactivity", async () => {
    const t = setup({
      config: (r: string) => cfg(r, { updates: { idleSeconds: 0 } }),
      ptyPrefix: ["/x/rcd", "pty-run", "--"],
    });
    await t.d.start();
    await t.d.handle({ cmd: "update" });
    const base = t.log.filter((l) => l === "start:a").length;
    await t.d.pollOnce();
    expect(t.log.filter((l) => l === "start:a").length).toBe(base + 1);
  });
});
