import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Exec,
  ServiceSpec,
  ServiceState,
  ServiceStatus,
  Supervisor,
} from "./supervisor-types";

export const LABEL_PREFIX = "dev.nsheaps.claude-rc.";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderPlist(label: string, spec: ServiceSpec): string {
  const args = spec.argv.map((a) => `    <string>${esc(a)}</string>`).join("\n");
  const env = Object.entries(spec.env)
    .map(([k, v]) => `    <key>${esc(k)}</key><string>${esc(v)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${esc(label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key><string>${esc(spec.cwd)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${env}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${esc(spec.logFile)}</string>
  <key>StandardErrorPath</key><string>${esc(spec.logFile)}</string>
</dict>
</plist>
`;
}

/**
 * macOS: each repo is a launchd job with KeepAlive, bootstrapped into gui/<uid> from a
 * plist kept in a runtime dir *outside* ~/Library/LaunchAgents. launchd only auto-loads
 * plists from the LaunchAgents dirs at login, so these do not return after a reboot —
 * the daemon recreates them.
 */
export class LaunchdSupervisor implements Supervisor {
  readonly kind = "launchd" as const;
  constructor(
    private readonly exec: Exec,
    private readonly plistDir: string,
    private readonly uid: number,
    private readonly pollMs = 100,
  ) {}

  private label = (n: string) => `${LABEL_PREFIX}${n}`;
  private target = (n: string) => `gui/${this.uid}/${this.label(n)}`;
  private plistPath = (n: string) => join(this.plistDir, `${this.label(n)}.plist`);

  async start(spec: ServiceSpec): Promise<void> {
    await this.exec(["launchctl", "bootout", this.target(spec.name)]);
    await this.waitUnloaded(spec.name);
    mkdirSync(this.plistDir, { recursive: true });
    const path = this.plistPath(spec.name);
    writeFileSync(path, renderPlist(this.label(spec.name), spec), { mode: 0o600 });
    // bootout can return before the job is gone (a keeper tears its tmux server down on SIGTERM), and
    // bootstrapping over a job that is still unloading fails with an I/O error; retry briefly.
    let r = await this.exec(["launchctl", "bootstrap", `gui/${this.uid}`, path]);
    for (let i = 0; r.code !== 0 && i < 20; i++) {
      await new Promise((res) => setTimeout(res, this.pollMs * 2.5));
      r = await this.exec(["launchctl", "bootstrap", `gui/${this.uid}`, path]);
    }
    if (r.code !== 0)
      throw new Error(
        `launchctl bootstrap failed for "${spec.name}": ${r.stderr.trim() || `exit ${r.code}`}`,
      );
  }

  /** Wait (bounded) until launchd no longer knows the job. */
  private async waitUnloaded(name: string): Promise<void> {
    for (let i = 0; i < 100; i++) {
      if ((await this.exec(["launchctl", "print", this.target(name)])).code !== 0) return;
      await new Promise((res) => setTimeout(res, this.pollMs));
    }
  }

  async stop(name: string): Promise<void> {
    await this.exec(["launchctl", "bootout", this.target(name)]);
    rmSync(this.plistPath(name), { force: true });
  }

  async status(name: string): Promise<ServiceStatus> {
    const r = await this.exec(["launchctl", "print", this.target(name)]);
    if (r.code !== 0) return { name, state: "stopped", supervisor: "launchd" };
    const field = (k: string) => new RegExp(`^\\s*${k} = (.+)$`, "m").exec(r.stdout)?.[1]?.trim();
    const st = field("state");
    const state: ServiceState =
      st === "running"
        ? "running"
        : st === "waiting" || st === "spawn scheduled"
          ? "starting"
          : "failed";
    const pid = Number(field("pid"));
    const runs = Number(field("runs"));
    return {
      name,
      state,
      ...(pid > 0 ? { pid } : {}),
      ...(runs > 0 ? { restarts: runs - 1 } : {}),
      supervisor: "launchd",
    };
  }

  async list(): Promise<string[]> {
    const r = await this.exec(["launchctl", "list"]);
    return r.stdout
      .split("\n")
      .map((l) => l.split(/\s+/).pop() ?? "")
      .filter((l) => l.startsWith(LABEL_PREFIX))
      .map((l) => l.slice(LABEL_PREFIX.length));
  }

  async dispose(): Promise<void> {}
}
