import type { SessionProbe } from "./tmux";

export type HealthState = "ok" | "attention" | "down" | "crash-loop" | "unknown";

export interface Health {
  state: HealthState;
  detail?: string;
  /** Epoch ms of the last pane output. */
  lastActivity?: number;
  attached?: number;
  tail: string[];
}

/** Prompts that leave `claude rc` waiting for a human. Best effort; matched case-insensitively. */
const ATTENTION: RegExp[] = [
  /do you trust|trust (this|the) (folder|workspace|files)/i,
  /not logged in|claude auth login|please (run )?\/?login|authentication (failed|required)|oauth token has expired|invalid api key/i,
  /press enter to continue/i,
];

const TAIL_WINDOW = 30;
const DETAIL_MAX = 200;

export function assessTail(tail: string[]): { attention?: string } {
  const lines = tail.slice(-TAIL_WINDOW);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line && ATTENTION.some((re) => re.test(line))) {
      return { attention: line.slice(0, DETAIL_MAX) };
    }
  }
  return {};
}

/** Repeated exits in a short span: the service is restarting but never getting anywhere. */
export class CrashLoopTracker {
  private readonly times = new Map<string, number[]>();

  constructor(
    private readonly limit = 3,
    private readonly windowMs = 10 * 60_000,
  ) {}

  private prune(name: string, now: number): number[] {
    const kept = (this.times.get(name) ?? []).filter((t) => now - t < this.windowMs);
    this.times.set(name, kept);
    return kept;
  }

  record(name: string, now: number): boolean {
    this.prune(name, now).push(now);
    return this.looping(name, now);
  }

  looping(name: string, now: number): boolean {
    return this.prune(name, now).length >= this.limit;
  }

  reset(name: string): void {
    this.times.delete(name);
  }
}

/** Nobody attached and no output for `idleMs`. Unknown activity is never idle. */
export function isIdle(
  p: { lastActivity?: number; attached: number },
  now: number,
  idleMs: number,
): boolean {
  if (p.attached > 0 || p.lastActivity === undefined) return false;
  return now - p.lastActivity >= idleMs;
}

export function computeHealth(input: {
  terminal: "tmux" | "pty";
  running: boolean;
  probe: SessionProbe | null;
  crashLoop: boolean;
}): Health {
  const { probe } = input;
  if (!input.running) return { state: "down", detail: "service is not running", tail: [] };
  if (input.terminal === "pty") return { state: "unknown", tail: [] };
  if (!probe) return { state: "down", detail: "tmux session is missing", tail: [] };
  const common = {
    ...(probe.lastActivity !== undefined ? { lastActivity: probe.lastActivity } : {}),
    attached: probe.attached,
    tail: probe.tail,
  };
  if (probe.dead)
    return {
      state: "down",
      detail: `pane exited with status ${probe.exitStatus ?? "unknown"}`,
      ...common,
    };
  if (input.crashLoop)
    return { state: "crash-loop", detail: "restarting repeatedly; see the log", ...common };
  const { attention } = assessTail(probe.tail);
  if (attention) return { state: "attention", detail: attention, ...common };
  return { state: "ok", ...common };
}
