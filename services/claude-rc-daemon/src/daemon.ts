import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  attachArgv,
  attachCommandLine,
  availableUpdates,
  buildSpec,
  checkForUpdates,
  computeHealth,
  CrashLoopTracker,
  isIdle,
  probeSession,
  realExec,
  StateWatcher,
  tmuxRunPrefix,
  tmuxSocketFor,
  ensureTrusted,
  loadConfig,
  reconcile,
  resolveClaude,
  specHash,
  trustKeyFor,
  VERSION,
  type Exec,
  type FetchLike,
  type Health,
  type IpcRequest,
  type IpcResponse,
  type RcConfig,
  type Notice,
  type Notifier,
  type RcPaths,
  type ReconcileResult,
  type ServiceSpec,
  type Supervisor,
  type UpdateState,
} from "@nsheaps/claude-rc-core";
import type { Observed, ServiceEvent } from "@nsheaps/claude-rc-core";
import type { UpgradeResult } from "./upgrade";

export interface DaemonDeps {
  env: Record<string, string | undefined>;
  home: string;
  paths: RcPaths;
  supervisor: Supervisor;
  supervisorReason: string;
  /** Wraps `claude rc` in `<self> pty-run --` so it gets a terminal; omit to run it bare. */
  ptyPrefix?: string[];
  /** Present when tmux is installed: `selfCmd` re-invokes this binary (for `tmux-run`). */
  tmux?: { bin: string; selfCmd: string[] };
  /** Runs tmux queries (injectable for tests). */
  exec?: Exec;
  upgrade: (claudeBin: string) => Promise<UpgradeResult>;
  /** Desktop notifications; omit to disable. */
  notifier?: Notifier;
  /** Network access for the daily update check (injectable for tests). */
  fetch?: FetchLike;
  now?: () => number;
  /** Installed `claude --version`, parsed; undefined when unknown. */
  claudeVersion?: (claudeBin: string) => Promise<string | undefined>;
  log: (msg: string) => void;
}

type Phase = "starting" | "upgrading" | "ready" | "stopping";

interface PersistedState {
  hashes: Record<string, string>;
  stopped: string[];
  update?: UpdateState;
  /** Repos waiting to be restarted (when idle) to pick up an update. */
  pendingRestart?: string[];
}

type Terminal = "tmux" | "pty";

const STARTUP_GRACE_MS = 10_000;
const HEALTH_MAX_AGE_MS = 2000;

export class Daemon {
  private phase: Phase = "starting";
  private readonly startedAt = new Date().toISOString();
  private config: RcConfig | undefined;
  private configMissing = false;
  private configError: string | undefined;
  private claudeBin: string | undefined;
  private claudeError: string | undefined;
  private upgradeResult: (UpgradeResult & { at: string }) | undefined;
  private last = new Map<string, ReconcileResult>();
  private trustErrors = new Map<string, string>();
  private hashes: Record<string, string> = {};
  private userStopped = new Set<string>();
  private specs = new Map<string, ServiceSpec>();
  private queue: Promise<unknown> = Promise.resolve();
  private update: UpdateState = {};
  private readonly watcher = new StateWatcher();
  private readonly crashes = new CrashLoopTracker();
  private terminals = new Map<string, Terminal>();
  private health = new Map<string, Health>();
  private healthAt = 0;
  /** When each repo's current process first appeared, so a session still being created isn't "down". */
  private pidSince = new Map<string, { pid?: number; at: number }>();
  private attentionSeen = new Map<string, string>();
  private loopAnnounced = new Set<string>();
  private expectRestart = new Map<string, number>();
  private pendingRestart = new Set<string>();
  private installedClaude: string | undefined;
  private activity = new Map<string, { lastActivity?: number; attached: number }>();
  private lastUpgrade: { ok: boolean; at: string; output: string } | undefined;

  constructor(private readonly d: DaemonDeps) {
    this.loadState();
    this.watcher.observe({}); // so services that appear after this are reported as started
  }

  /** Serialize all state-changing work. */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  private loadState(): void {
    try {
      const s = JSON.parse(readFileSync(this.d.paths.statePath, "utf8")) as Partial<PersistedState>;
      this.hashes = s.hashes ?? {};
      this.userStopped = new Set(s.stopped ?? []);
      this.update = s.update ?? {};
      this.pendingRestart = new Set(s.pendingRestart ?? []);
    } catch {}
  }

  private saveState(): void {
    try {
      mkdirSync(dirname(this.d.paths.statePath), { recursive: true });
      writeFileSync(
        this.d.paths.statePath,
        JSON.stringify(
          {
            hashes: this.hashes,
            stopped: [...this.userStopped],
            update: this.update,
            pendingRestart: [...this.pendingRestart],
          } satisfies PersistedState,
          null,
          2,
        ),
      );
    } catch (e) {
      this.d.log(`could not persist state: ${(e as Error).message}`);
    }
  }

  /** Startup: upgrade claude, then load config and reconcile services. */
  async start(): Promise<void> {
    await this.locked(async () => {
      this.resolveClaudeBin();
      const early = loadConfig(this.d.paths.configPath);
      const autoUpgrade = early.ok ? early.config.updates.autoUpgrade : true;
      if (this.claudeBin && !autoUpgrade)
        this.d.log("claude upgrade skipped (updates.autoUpgrade is off)");
      if (this.claudeBin && autoUpgrade) {
        this.phase = "upgrading";
        this.d.log(`running: ${this.claudeBin} upgrade`);
        const r = await this.d.upgrade(this.claudeBin);
        this.upgradeResult = { ...r, at: new Date().toISOString() };
        this.d.log(r.ok ? "claude upgrade ok" : `claude upgrade failed (continuing): ${r.output}`);
        this.resolveClaudeBin(); // upgrade may have installed/moved the binary
      }
      await this.refreshInstalledClaude();
      await this.apply();
      this.phase = "ready";
    });
  }

  private resolveClaudeBin(): void {
    this.claudeBin = resolveClaude(this.d.env, this.d.home);
    this.claudeError = this.claudeBin
      ? undefined
      : "claude not found on PATH or in ~/.local/bin, ~/.claude/local, /opt/homebrew/bin, /usr/local/bin (set CLAUDE_RC_CLAUDE_BIN)";
  }

  /** Re-read config and make services match. Returns an error string if nothing was applied. */
  private async apply(): Promise<string | undefined> {
    const loaded = loadConfig(this.d.paths.configPath);
    if (!loaded.ok) {
      this.configError = loaded.errors.join("; ");
      this.d.log(`config error (keeping current services): ${this.configError}`);
      return this.configError;
    }
    this.configError = undefined;
    this.configMissing = loaded.missing;
    this.config = loaded.config;
    this.resolveClaudeBin();
    if (!this.claudeBin) {
      this.d.log(this.claudeError!);
      return this.claudeError;
    }

    const want = loaded.config.terminal;
    if (want === "tmux" && !this.d.tmux) {
      const msg =
        'terminal is "tmux" but tmux was not found (install it, or set terminal to "auto" or "pty")';
      this.configError = msg;
      this.d.log(`config error (keeping current services): ${msg}`);
      return msg;
    }
    const mode: Terminal = want === "pty" || (want === "auto" && !this.d.tmux) ? "pty" : "tmux";
    this.terminals = new Map(loaded.config.repos.map((r) => [r.name, mode]));

    this.trustErrors.clear();
    if (loaded.config.autoTrust) {
      for (const repo of loaded.config.repos) {
        try {
          if (existsSync(repo.path)) {
            const res = ensureTrusted(this.d.paths.claudeJson, trustKeyFor(repo.path));
            if (res === "added") this.d.log(`trusted workspace for ${repo.name}`);
          }
        } catch (e) {
          this.trustErrors.set(repo.name, (e as Error).message);
          this.d.log(`trust failed for ${repo.name}: ${(e as Error).message}`);
        }
      }
    }

    const all = loaded.config.repos.map((r) => this.specFor(r.name, loaded.config));
    this.specs = new Map(all.map((s) => [s.name, s]));
    for (const n of [...this.userStopped]) if (!this.specs.has(n)) this.userStopped.delete(n);
    const desired = all.filter((s) => !this.userStopped.has(s.name));

    const { results, hashes } = await reconcile(
      this.d.supervisor,
      desired,
      this.hashes,
      existsSync,
    );
    this.hashes = hashes;
    this.last = new Map(results.filter((r) => r.action !== "stopped").map((r) => [r.name, r]));
    for (const r of results) this.d.log(`${r.name}: ${r.action}${r.error ? ` (${r.error})` : ""}`);
    this.saveState();
    return undefined;
  }

  async handle(req: IpcRequest): Promise<IpcResponse> {
    switch (req.cmd) {
      case "ping":
        return { ok: true, data: "pong" };
      case "status":
        return { ok: true, data: await this.status() };
      case "reload":
        return this.locked(async () => {
          const err = await this.apply();
          return err ? { ok: false, error: err } : { ok: true, data: [...this.last.values()] };
        });
      case "restart":
        return this.locked(() => this.control(req.name, "restart"));
      case "stop":
        return this.locked(() => this.control(req.name, "stop"));
      case "start":
        return this.locked(() => this.control(req.name, "start"));
      case "update":
        return this.locked(() => this.updateNow(req.restart !== false));
      default:
        return { ok: false, error: `unknown command "${req.cmd}"` };
    }
  }

  private async control(
    name: string | undefined,
    op: "restart" | "stop" | "start",
  ): Promise<IpcResponse> {
    if (!this.config) return { ok: false, error: this.configError ?? "no configuration loaded" };
    const names = name ? [name] : [...this.specs.keys()];
    if (name && !this.specs.has(name))
      return {
        ok: false,
        error: `unknown repo "${name}" (configured: ${[...this.specs.keys()].join(", ") || "none"})`,
      };
    if (op !== "stop") this.resolveClaudeBin();
    if (op !== "stop" && !this.claudeBin) return { ok: false, error: this.claudeError };
    for (const n of names) {
      try {
        if (op === "stop") {
          this.userStopped.add(n);
          this.pendingRestart.delete(n);
          await this.d.supervisor.stop(n);
          delete this.hashes[n];
        } else {
          this.userStopped.delete(n);
          this.expectRestart.set(n, this.now()); // the pid change is ours, not a crash
          const spec = this.rebuild(n);
          await this.d.supervisor.start(spec);
          this.hashes[n] = specHash(spec);
          this.last.set(n, { name: n, action: op === "restart" ? "restarted" : "started" });
        }
      } catch (e) {
        return { ok: false, error: `${n}: ${(e as Error).message}` };
      }
    }
    this.healthAt = 0;
    this.saveState();
    return { ok: true };
  }

  /** argv that attaches a pty to the repo's tmux session (for the browser terminal), if there is one. */
  attachArgvFor(name: string): string[] | undefined {
    if (this.terminals.get(name) !== "tmux" || !this.d.tmux || !this.specs.has(name))
      return undefined;
    return attachArgv(this.d.tmux.bin, this.socketFor(name));
  }

  private rebuild(name: string): ServiceSpec {
    return this.specFor(name, this.config!);
  }

  private socketFor(name: string): string {
    return tmuxSocketFor(this.d.paths, this.d.env, name);
  }

  private specFor(name: string, cfg: RcConfig): ServiceSpec {
    const repo = cfg.repos.find((r) => r.name === name)!;
    const tmux = this.terminals.get(name) === "tmux" ? this.d.tmux : undefined;
    return buildSpec(repo, cfg, {
      claudeBin: this.claudeBin!,
      baseEnv: this.d.env,
      paths: this.d.paths,
      ptyPrefix: this.d.ptyPrefix,
      ...(tmux
        ? {
            tmuxPrefix: tmuxRunPrefix(
              tmux.selfCmd,
              tmux.bin,
              this.socketFor(name),
              name,
              `${this.d.paths.logDir}/${name}.log`,
            ),
          }
        : {}),
    });
  }

  private now(): number {
    return (this.d.now ?? Date.now)();
  }

  private async send(n: Notice): Promise<void> {
    try {
      await this.d.notifier?.notify(n);
    } catch (e) {
      this.d.log(`notification failed: ${(e as Error).message}`);
    }
  }

  /** Compare service states with the last poll; notify about starts, exits and problems; act on queued restarts. */
  async pollOnce(): Promise<ServiceEvent[]> {
    const now = this.now();
    const snap: Record<string, Observed> = {};
    for (const r of this.config?.repos ?? []) {
      const st = await this.d.supervisor.status(r.name);
      snap[r.name] = {
        state: st.state,
        ...(st.pid ? { pid: st.pid } : {}),
        ...(this.userStopped.has(r.name) ? { stoppedByUser: true } : {}),
      };
    }
    const events = this.watcher.observe(snap).filter((e) => {
      const t = this.expectRestart.get(e.name);
      if (t === undefined) return true;
      if (now - t > 60_000) return this.expectRestart.delete(e.name) || true;
      if (e.type === "restarted") return !this.expectRestart.delete(e.name); // ours: not news
      if (e.type === "started") this.expectRestart.delete(e.name);
      return true;
    });
    const n = this.config?.notifications;
    const loud = n?.enabled === true;

    for (const e of events) {
      const log = `${this.d.paths.logDir}/${e.name}.log`;
      if (e.type === "exited" || e.type === "restarted") {
        if (this.crashes.record(e.name, now) && !this.loopAnnounced.has(e.name)) {
          this.loopAnnounced.add(e.name);
          if (loud && n!.onExit)
            await this.send({
              title: `${e.name} keeps crashing`,
              body: `It has exited 3 times in 10 minutes. See ${log}`,
            });
        }
      }
      if (!loud) continue;
      if (e.type === "started" && n!.onStart)
        await this.send({ title: `${e.name} started`, body: "claude rc is running" });
      else if (e.type === "exited" && n!.onExit)
        await this.send({ title: `${e.name} exited`, body: `See ${log}` });
      else if (e.type === "restarted" && n!.onExit)
        await this.send({
          title: `${e.name} restarted`,
          body: `It exited and was restarted. See ${log}`,
        });
    }
    for (const name of [...this.loopAnnounced])
      if (!this.crashes.looping(name, now)) this.loopAnnounced.delete(name);

    await this.refreshHealth(true);
    for (const [name, h] of this.health) {
      if (h.state !== "attention") {
        this.attentionSeen.delete(name);
        continue;
      }
      if (this.attentionSeen.get(name) === h.detail) continue;
      this.attentionSeen.set(name, h.detail ?? "");
      if (loud && n!.onExit)
        await this.send({
          title: `${name} needs attention`,
          body: `${h.detail ?? "claude rc is waiting for input"} — attach with: claude-rc attach ${name}`,
        });
    }

    await this.processPending();
    return events;
  }

  /** Probe every repo's terminal and derive its health; cached briefly so status polling stays cheap. */
  private async refreshHealth(force = false): Promise<void> {
    const now = this.now();
    if (!force && now - this.healthAt < HEALTH_MAX_AGE_MS) return;
    this.healthAt = now;
    const health = new Map<string, Health>();
    const activity = new Map<string, { lastActivity?: number; attached: number }>();
    for (const r of this.config?.repos ?? []) {
      const st = await this.d.supervisor.status(r.name);
      const running = st.state === "running";
      const terminal = this.terminals.get(r.name) ?? "pty";
      const probe =
        terminal === "tmux" && running && this.d.tmux
          ? await probeSession(this.d.exec ?? realExec, this.d.tmux.bin, this.socketFor(r.name))
          : null;
      const seen = this.pidSince.get(r.name);
      if (!seen || seen.pid !== st.pid) this.pidSince.set(r.name, { pid: st.pid, at: now });
      const starting =
        terminal === "tmux" &&
        running &&
        !probe &&
        now - (this.pidSince.get(r.name)?.at ?? now) < STARTUP_GRACE_MS;
      health.set(
        r.name,
        starting
          ? { state: "unknown", detail: "starting", tail: [] }
          : computeHealth({
              terminal,
              running,
              probe,
              crashLoop: this.crashes.looping(r.name, now),
            }),
      );
      if (running) {
        if (terminal === "tmux")
          activity.set(r.name, probe ? probe : { lastActivity: 0, attached: 0 });
        else {
          let mtime = 0; // no log yet = no output yet
          try {
            mtime = statSync(`${this.d.paths.logDir}/${r.name}.log`).mtimeMs;
          } catch {}
          activity.set(r.name, { lastActivity: mtime, attached: 0 });
        }
      }
    }
    this.health = health;
    this.activity = activity;
  }

  /** Restart repos queued by "update now" as soon as each one is idle. */
  private async processPending(): Promise<void> {
    if (this.pendingRestart.size === 0 || !this.config) return;
    const idleMs = this.config.updates.idleSeconds * 1000;
    let changed = false;
    for (const name of [...this.pendingRestart]) {
      const a = this.activity.get(name);
      if (!this.specs.has(name) || this.userStopped.has(name) || !a) {
        this.pendingRestart.delete(name); // gone, stopped, or not running (the supervisor is restarting it anyway)
        changed = true;
        continue;
      }
      if (!isIdle(a, this.now(), idleMs)) continue;
      const r = await this.locked(() => this.control(name, "restart"));
      this.pendingRestart.delete(name);
      changed = true;
      if (!r.ok) {
        this.d.log(`restart after update failed for ${name}: ${r.error}`);
        continue;
      }
      this.d.log(`${name}: restarted after update (idle)`);
      if (this.config.notifications.enabled)
        await this.send({
          title: `${name} restarted`,
          body: "Restarted to pick up the Claude Code update (it was idle).",
        });
    }
    if (changed) this.saveState();
  }

  private async refreshInstalledClaude(): Promise<void> {
    if (this.claudeBin && this.d.claudeVersion)
      this.installedClaude = await this.d.claudeVersion(this.claudeBin).catch(() => undefined);
  }

  /** "Update now": `claude upgrade`, then queue running repos to restart once idle. */
  private async updateNow(restart: boolean): Promise<IpcResponse> {
    this.resolveClaudeBin();
    if (!this.claudeBin) return { ok: false, error: this.claudeError };
    this.d.log(`running: ${this.claudeBin} upgrade (update now)`);
    const r = await this.d.upgrade(this.claudeBin);
    this.upgradeResult = { ...r, at: new Date().toISOString() };
    this.lastUpgrade = { ...r, at: this.upgradeResult.at };
    if (!r.ok) return { ok: false, error: `claude upgrade failed: ${r.output}` };
    this.resolveClaudeBin();
    await this.refreshInstalledClaude();
    if (restart) {
      for (const name of this.specs.keys()) {
        if (this.userStopped.has(name)) continue;
        if ((await this.d.supervisor.status(name)).state === "running")
          this.pendingRestart.add(name);
      }
    }
    this.healthAt = 0;
    this.saveState();
    return { ok: true, data: { upgrade: r.output, pending: [...this.pendingRestart] } };
  }

  /** Once-a-day check for newer claude-rc / Claude Code; a no-op when checked recently. */
  async checkUpdates(): Promise<void> {
    if (!this.config) return;
    this.resolveClaudeBin();
    await this.refreshInstalledClaude();
    const r = await checkForUpdates({
      fetch: this.d.fetch ?? ((u, i) => fetch(u, i)),
      now: this.now(),
      versions: { claudeRc: VERSION, claude: this.installedClaude },
      enabled: this.config.updates,
      state: this.update,
    });
    for (const e of r.errors) this.d.log(`update check: ${e}`);
    if (r.state !== this.update) {
      this.update = r.state;
      this.saveState();
    }
    if (this.config.notifications.enabled)
      for (const n of r.notices)
        await this.send({
          ...n,
          broadcast: n.broadcast === true && this.config.notifications.allUsers,
        });
  }

  private async status() {
    await this.refreshHealth();
    const repos = [];
    for (const r of this.config?.repos ?? []) {
      const st = await this.d.supervisor.status(r.name);
      const last = this.last.get(r.name);
      const terminal = this.terminals.get(r.name) ?? "pty";
      const socket = this.socketFor(r.name);
      repos.push({
        name: r.name,
        path: r.path,
        spawn: r.spawn ?? this.config!.spawn,
        state: st.state,
        ...(st.pid ? { pid: st.pid } : {}),
        ...(st.restarts !== undefined ? { restarts: st.restarts } : {}),
        ...(this.userStopped.has(r.name) ? { stoppedByUser: true } : {}),
        terminal,
        ...(terminal === "tmux" && this.d.tmux
          ? { attach: { socket, command: attachCommandLine(socket) } }
          : {}),
        ...(this.health.get(r.name) ? { health: this.health.get(r.name) } : {}),
        ...(this.pendingRestart.has(r.name) ? { restartPending: true } : {}),
        ...(last ? { action: last.action } : {}),
        ...(last?.error ? { error: last.error } : {}),
        ...(this.trustErrors.has(r.name) ? { trustError: this.trustErrors.get(r.name) } : {}),
        logFile: `${this.d.paths.logDir}/${r.name}.log`,
      });
    }
    return {
      pid: process.pid,
      version: VERSION,
      startedAt: this.startedAt,
      phase: this.phase,
      supervisor: { kind: this.d.supervisor.kind, reason: this.d.supervisorReason },
      configPath: this.d.paths.configPath,
      ...(this.configMissing ? { configMissing: true } : {}),
      ...(this.configError ? { configError: this.configError } : {}),
      ...(this.claudeBin ? { claudeBin: this.claudeBin } : {}),
      ...(this.claudeError ? { claudeError: this.claudeError } : {}),
      ...(this.upgradeResult ? { upgrade: this.upgradeResult } : {}),
      updates: {
        ...(this.update.latest ? { latest: this.update.latest } : {}),
        ...(this.update.lastCheck ? { lastCheck: this.update.lastCheck } : {}),
        installed: {
          claudeRc: VERSION,
          ...(this.installedClaude ? { claude: this.installedClaude } : {}),
        },
        available: availableUpdates(this.update.latest, {
          claudeRc: VERSION,
          claude: this.installedClaude,
        }),
        autoUpgrade: this.config?.updates.autoUpgrade ?? true,
        pendingRestart: [...this.pendingRestart],
        ...(this.lastUpgrade ? { lastUpgrade: this.lastUpgrade } : {}),
      },
      repos,
    };
  }

  /** Stop all children (they belong to this daemon's lifetime), then release the supervisor. */
  async shutdown(): Promise<void> {
    await this.locked(async () => {
      this.phase = "stopping";
      for (const n of this.specs.keys())
        await this.d.supervisor
          .stop(n)
          .catch((e) => this.d.log(`stop ${n}: ${(e as Error).message}`));
      await this.d.supervisor.dispose();
    });
  }
}
