import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildSpec,
  ensureTrusted,
  loadConfig,
  reconcile,
  resolveClaude,
  specHash,
  trustKeyFor,
  VERSION,
  type IpcRequest,
  type IpcResponse,
  type RcConfig,
  type RcPaths,
  type ReconcileResult,
  type ServiceSpec,
  type Supervisor,
} from "@nsheaps/claude-rc-core";
import type { UpgradeResult } from "./upgrade";

export interface DaemonDeps {
  env: Record<string, string | undefined>;
  home: string;
  paths: RcPaths;
  supervisor: Supervisor;
  supervisorReason: string;
  /** Wraps `claude rc` in `<self> pty-run --` so it gets a terminal; omit to run it bare. */
  ptyPrefix?: string[];
  upgrade: (claudeBin: string) => Promise<UpgradeResult>;
  log: (msg: string) => void;
}

type Phase = "starting" | "upgrading" | "ready" | "stopping";

interface PersistedState {
  hashes: Record<string, string>;
  stopped: string[];
}

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

  constructor(private readonly d: DaemonDeps) {
    this.loadState();
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
    } catch {}
  }

  private saveState(): void {
    try {
      mkdirSync(dirname(this.d.paths.statePath), { recursive: true });
      writeFileSync(
        this.d.paths.statePath,
        JSON.stringify(
          { hashes: this.hashes, stopped: [...this.userStopped] } satisfies PersistedState,
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
      if (this.claudeBin) {
        this.phase = "upgrading";
        this.d.log(`running: ${this.claudeBin} upgrade`);
        const r = await this.d.upgrade(this.claudeBin);
        this.upgradeResult = { ...r, at: new Date().toISOString() };
        this.d.log(r.ok ? "claude upgrade ok" : `claude upgrade failed (continuing): ${r.output}`);
        this.resolveClaudeBin(); // upgrade may have installed/moved the binary
      }
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

    const all = loaded.config.repos.map((r) =>
      buildSpec(r, loaded.config, {
        claudeBin: this.claudeBin!,
        baseEnv: this.d.env,
        paths: this.d.paths,
        ptyPrefix: this.d.ptyPrefix,
      }),
    );
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
          await this.d.supervisor.stop(n);
          delete this.hashes[n];
        } else {
          this.userStopped.delete(n);
          const spec = this.rebuild(n);
          await this.d.supervisor.start(spec);
          this.hashes[n] = specHash(spec);
          this.last.set(n, { name: n, action: op === "restart" ? "restarted" : "started" });
        }
      } catch (e) {
        return { ok: false, error: `${n}: ${(e as Error).message}` };
      }
    }
    this.saveState();
    return { ok: true };
  }

  private rebuild(name: string): ServiceSpec {
    const repo = this.config!.repos.find((r) => r.name === name)!;
    return buildSpec(repo, this.config!, {
      claudeBin: this.claudeBin!,
      baseEnv: this.d.env,
      paths: this.d.paths,
      ptyPrefix: this.d.ptyPrefix,
    });
  }

  private async status() {
    const repos = [];
    for (const r of this.config?.repos ?? []) {
      const st = await this.d.supervisor.status(r.name);
      const last = this.last.get(r.name);
      repos.push({
        name: r.name,
        path: r.path,
        spawn: r.spawn ?? this.config!.spawn,
        state: st.state,
        ...(st.pid ? { pid: st.pid } : {}),
        ...(st.restarts !== undefined ? { restarts: st.restarts } : {}),
        ...(this.userStopped.has(r.name) ? { stoppedByUser: true } : {}),
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
