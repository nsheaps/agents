import { specHash } from "./spec";
import type { ServiceSpec, Supervisor } from "./supervisor-types";

export type Action = "started" | "restarted" | "kept" | "stopped" | "error";
export interface ReconcileResult {
  name: string;
  action: Action;
  error?: string;
}

/**
 * Make `sup` match `desired`. `known` maps name -> spec hash from the previous run (persisted
 * by the daemon) so a daemon restart can adopt still-running services without bouncing them.
 */
export async function reconcile(
  sup: Supervisor,
  desired: ServiceSpec[],
  known: Record<string, string>,
  pathExists: (p: string) => boolean,
): Promise<{ results: ReconcileResult[]; hashes: Record<string, string> }> {
  const results: ReconcileResult[] = [];
  const hashes: Record<string, string> = {};
  const want = new Set(desired.map((d) => d.name));

  for (const spec of desired) {
    if (!pathExists(spec.cwd)) {
      results.push({
        name: spec.name,
        action: "error",
        error: `repo path does not exist: ${spec.cwd}`,
      });
      await sup.stop(spec.name).catch(() => {});
      continue;
    }
    const hash = specHash(spec);
    try {
      const st = await sup.status(spec.name);
      const alive = st.state === "running" || st.state === "starting";
      if (alive && known[spec.name] === hash) {
        results.push({ name: spec.name, action: "kept" });
      } else {
        await sup.start(spec);
        results.push({ name: spec.name, action: alive ? "restarted" : "started" });
      }
      hashes[spec.name] = hash;
    } catch (e) {
      results.push({ name: spec.name, action: "error", error: (e as Error).message });
    }
  }

  const existing = new Set([...(await sup.list()), ...Object.keys(known)]);
  for (const name of existing) {
    if (want.has(name)) continue;
    try {
      await sup.stop(name);
      results.push({ name, action: "stopped" });
    } catch (e) {
      results.push({ name, action: "error", error: (e as Error).message });
    }
  }
  return { results, hashes };
}
