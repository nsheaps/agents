export type Observed = { state: string; pid?: number; stoppedByUser?: boolean };
export interface ServiceEvent {
  type: "started" | "exited" | "restarted" | "stopped";
  name: string;
}

/** Turns successive status snapshots into start/exit events. The first sighting of a name only seeds. */
export class StateWatcher {
  private prev = new Map<string, Observed>();
  private seeded = false;

  observe(now: Record<string, Observed>): ServiceEvent[] {
    const events: ServiceEvent[] = [];
    const next = new Map<string, Observed>();
    for (const [name, cur] of Object.entries(now)) {
      next.set(name, cur);
      const before = this.prev.get(name);
      const wasUp = before?.state === "running";
      const isUp = cur.state === "running";
      if (!before && !this.seeded) continue; // initial snapshot
      if (isUp && !wasUp) events.push({ type: "started", name });
      else if (isUp && wasUp && before?.pid !== cur.pid) events.push({ type: "restarted", name });
      else if (!isUp && wasUp)
        events.push({ type: cur.stoppedByUser ? "stopped" : "exited", name });
    }
    this.prev = next;
    this.seeded = true;
    return events;
  }
}
