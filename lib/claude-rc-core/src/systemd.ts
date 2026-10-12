import type {
  Exec,
  ServiceSpec,
  ServiceState,
  ServiceStatus,
  Supervisor,
} from "./supervisor-types";

const PREFIX = "claude-rc-";
const unit = (name: string) => `${PREFIX}${name}.service`;

/**
 * Linux: each repo becomes a *transient* systemd user unit (`systemd-run --user`).
 * Restart=always gives auto-restart; transient units live under /run, so they are
 * gone after a reboot — the daemon recreates them on boot.
 */
export class SystemdSupervisor implements Supervisor {
  readonly kind = "systemd" as const;
  constructor(private readonly exec: Exec) {}

  async start(spec: ServiceSpec): Promise<void> {
    await this.exec(["systemctl", "--user", "stop", unit(spec.name)]);
    await this.exec(["systemctl", "--user", "reset-failed", unit(spec.name)]);
    const args = [
      "systemd-run",
      "--user",
      `--unit=${PREFIX}${spec.name}`,
      `--description=claude rc (${spec.name})`,
      "--collect",
      "--property=Restart=always",
      "--property=RestartSec=5",
      "--property=StartLimitIntervalSec=0",
      `--property=WorkingDirectory=${spec.cwd}`,
      `--property=StandardOutput=append:${spec.logFile}`,
      `--property=StandardError=append:${spec.logFile}`,
      ...Object.entries(spec.env).map(([k, v]) => `--setenv=${k}=${v}`),
      "--",
      ...spec.argv,
    ];
    const r = await this.exec(args);
    if (r.code !== 0)
      throw new Error(
        `systemd-run failed for "${spec.name}": ${r.stderr.trim() || `exit ${r.code}`}`,
      );
  }

  async stop(name: string): Promise<void> {
    await this.exec(["systemctl", "--user", "stop", unit(name)]);
    await this.exec(["systemctl", "--user", "reset-failed", unit(name)]);
  }

  async status(name: string): Promise<ServiceStatus> {
    const r = await this.exec([
      "systemctl",
      "--user",
      "show",
      unit(name),
      "-p",
      "LoadState",
      "-p",
      "ActiveState",
      "-p",
      "SubState",
      "-p",
      "MainPID",
      "-p",
      "NRestarts",
    ]);
    const kv = Object.fromEntries(
      r.stdout
        .split("\n")
        .filter(Boolean)
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
    if (r.code !== 0 || kv.LoadState === "not-found")
      return { name, state: "stopped", supervisor: "systemd" };
    const state: ServiceState =
      kv.ActiveState === "active"
        ? "running"
        : kv.ActiveState === "activating" || kv.ActiveState === "reloading"
          ? "starting"
          : kv.ActiveState === "failed"
            ? "failed"
            : "stopped";
    const pid = Number(kv.MainPID);
    return {
      name,
      state,
      ...(pid > 0 ? { pid } : {}),
      ...(kv.NRestarts !== undefined ? { restarts: Number(kv.NRestarts) } : {}),
      supervisor: "systemd",
    };
  }

  async list(): Promise<string[]> {
    const r = await this.exec([
      "systemctl",
      "--user",
      "list-units",
      "--all",
      "--plain",
      "--no-legend",
      "--type=service",
      `${PREFIX}*`,
    ]);
    return r.stdout
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0] ?? "")
      .filter((u) => u.startsWith(PREFIX) && u.endsWith(".service"))
      .map((u) => u.slice(PREFIX.length, -".service".length))
      .filter((n) => n !== "daemon");
  }

  async dispose(): Promise<void> {}
}
