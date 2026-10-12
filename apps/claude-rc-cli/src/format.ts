const c = (on: boolean, code: number) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);

export interface StatusData {
  pid: number;
  version: string;
  phase: string;
  startedAt: string;
  supervisor: { kind: string; reason: string };
  configPath: string;
  configMissing?: boolean;
  configError?: string;
  claudeBin?: string;
  claudeError?: string;
  upgrade?: { ok: boolean; output: string; at: string };
  repos: Array<{
    name: string;
    path: string;
    spawn: string;
    state: string;
    pid?: number;
    restarts?: number;
    stoppedByUser?: boolean;
    action?: string;
    error?: string;
    trustError?: string;
    logFile?: string;
  }>;
}

export function formatStatus(s: StatusData, color: boolean): string {
  const bold = c(color, 1);
  const dim = c(color, 2);
  const red = c(color, 31);
  const green = c(color, 32);
  const yellow = c(color, 33);

  const out: string[] = [];
  out.push(
    `${bold(`claude-rc-daemon ${s.version}`)}  pid ${s.pid}  ${s.phase}  supervisor: ${s.supervisor.kind}`,
  );
  out.push(dim(`config: ${s.configPath}${s.configMissing ? " (not created yet)" : ""}`));
  if (s.configError) out.push(red(`config error: ${s.configError}`));
  if (s.claudeError) out.push(red(s.claudeError));
  if (s.upgrade && !s.upgrade.ok) out.push(yellow(`claude upgrade failed: ${s.upgrade.output}`));
  out.push("");

  if (s.repos.length === 0) {
    out.push(dim("no repos configured — add one with: claude-rc add <path>"));
    return out.join("\n");
  }

  const rows = s.repos.map((r) => ({
    name: r.name,
    state: r.stoppedByUser ? "stopped (manual)" : r.state,
    raw: r.state,
    pid: r.pid ? String(r.pid) : "-",
    restarts: r.restarts !== undefined ? String(r.restarts) : "-",
    spawn: r.spawn,
    path: r.path,
  }));
  const head = {
    name: "NAME",
    state: "STATE",
    pid: "PID",
    restarts: "RESTARTS",
    spawn: "SPAWN",
    path: "PATH",
  };
  const w = (k: keyof typeof head) => Math.max(head[k].length, ...rows.map((r) => r[k].length));
  const widths = {
    name: w("name"),
    state: w("state"),
    pid: w("pid"),
    restarts: w("restarts"),
    spawn: w("spawn"),
  };
  const line = (r: Record<string, string>, paint: (s: string) => string = (x) => x) =>
    `${r.name!.padEnd(widths.name)}  ${paint(r.state!.padEnd(widths.state))}  ${r.pid!.padEnd(widths.pid)}  ${r.restarts!.padEnd(widths.restarts)}  ${r.spawn!.padEnd(widths.spawn)}  ${r.path}`;
  out.push(dim(line(head)));
  for (const r of rows)
    out.push(line(r, r.raw === "running" ? green : r.raw === "failed" ? red : yellow));

  const problems = s.repos.flatMap(
    (r) =>
      [
        r.error && `${r.name}: ${r.error}`,
        r.trustError && `${r.name}: trust: ${r.trustError}`,
      ].filter(Boolean) as string[],
  );
  if (problems.length) {
    out.push("");
    for (const p of problems) out.push(red(p));
  }
  return out.join("\n");
}
