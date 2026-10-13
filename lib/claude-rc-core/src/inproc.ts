import { appendFileSync, closeSync, mkdirSync, openSync } from "node:fs";
import { dirname } from "node:path";
import type { ServiceSpec, ServiceState, ServiceStatus, Supervisor } from "./supervisor-types";

interface Opts {
  restartDelayMs?: number;
  maxDelayMs?: number;
  /** A run lasting at least this long resets the backoff. */
  stableMs?: number;
}

interface Entry {
  spec: ServiceSpec;
  proc?: ReturnType<typeof Bun.spawn>;
  stopped: boolean;
  restarts: number;
  delay: number;
  timer?: ReturnType<typeof setTimeout>;
  state: ServiceState;
  done: Promise<void>;
}

/** Fallback supervisor: the daemon itself restarts children (with backoff) and owns their lifetime. */
export class InProcSupervisor implements Supervisor {
  readonly kind = "inproc" as const;
  private readonly entries = new Map<string, Entry>();
  private readonly base: number;
  private readonly max: number;
  private readonly stable: number;

  constructor(opts: Opts = {}) {
    this.base = opts.restartDelayMs ?? 1000;
    this.max = opts.maxDelayMs ?? 30_000;
    this.stable = opts.stableMs ?? 60_000;
  }

  async start(spec: ServiceSpec): Promise<void> {
    await this.stop(spec.name);
    const e: Entry = {
      spec,
      stopped: false,
      restarts: -1,
      delay: this.base,
      state: "starting",
      done: Promise.resolve(),
    };
    this.entries.set(spec.name, e);
    this.launch(e);
  }

  private launch(e: Entry): void {
    if (e.stopped) return;
    e.restarts++;
    mkdirSync(dirname(e.spec.logFile), { recursive: true });
    const fd = openSync(e.spec.logFile, "a");
    const startedAt = Date.now();
    try {
      appendFileSync(
        fd,
        `[claude-rc] ${new Date().toISOString()} starting: ${e.spec.argv.join(" ")}\n`,
      );
      e.proc = Bun.spawn(e.spec.argv, {
        cwd: e.spec.cwd,
        env: { ...process.env, ...e.spec.env },
        stdin: "ignore",
        stdout: fd,
        stderr: fd,
      });
      e.state = "running";
    } catch (err) {
      appendFileSync(fd, `[claude-rc] spawn failed: ${(err as Error).message}\n`);
      closeSync(fd);
      e.state = "failed";
      this.schedule(e, startedAt);
      return;
    }
    const proc = e.proc;
    e.done = proc.exited.then((code) => {
      closeSync(fd);
      if (e.stopped || e.proc !== proc) return;
      e.state = "failed";
      appendFileSync(e.spec.logFile, `[claude-rc] exited with code ${code}; restarting\n`);
      this.schedule(e, startedAt);
    });
  }

  private schedule(e: Entry, startedAt: number): void {
    if (Date.now() - startedAt >= this.stable) e.delay = this.base;
    const wait = e.delay;
    e.delay = Math.min(e.delay * 2, this.max);
    e.state = "starting";
    e.timer = setTimeout(() => this.launch(e), wait);
  }

  async stop(name: string): Promise<void> {
    const e = this.entries.get(name);
    if (!e) return;
    e.stopped = true;
    e.state = "stopped";
    clearTimeout(e.timer);
    this.entries.delete(name);
    const p = e.proc;
    if (p && p.exitCode === null) {
      p.kill("SIGTERM");
      const killer = setTimeout(() => p.kill("SIGKILL"), 5000);
      await p.exited;
      clearTimeout(killer);
    }
    await e.done;
  }

  async status(name: string): Promise<ServiceStatus> {
    const e = this.entries.get(name);
    if (!e) return { name, state: "stopped", supervisor: "inproc" };
    const running = e.state === "running" && e.proc && e.proc.exitCode === null;
    return {
      name,
      state: running ? "running" : e.state,
      ...(running ? { pid: e.proc!.pid } : {}),
      restarts: Math.max(e.restarts, 0),
      supervisor: "inproc",
    };
  }

  async list(): Promise<string[]> {
    return [...this.entries.keys()];
  }

  async dispose(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((n) => this.stop(n)));
  }
}
