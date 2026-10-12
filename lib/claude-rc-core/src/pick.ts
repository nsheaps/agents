import { InProcSupervisor } from "./inproc";
import { LaunchdSupervisor } from "./launchd";
import { SystemdSupervisor } from "./systemd";
import type { Exec, Supervisor, SupervisorKind } from "./supervisor-types";

export interface PickOpts {
  prefer?: SupervisorKind | "auto";
  platform: string;
  exec: Exec;
  uid: number;
  /** Directory for launchd plists (outside ~/Library/LaunchAgents). */
  runDir: string;
}

/** OS-native supervisor when available, in-process otherwise. An explicit native request never degrades silently. */
export async function pickSupervisor(
  o: PickOpts,
): Promise<{ supervisor: Supervisor; reason: string }> {
  const prefer = o.prefer ?? "auto";
  if (prefer === "inproc")
    return { supervisor: new InProcSupervisor(), reason: "in-process supervisor requested" };

  const wantSystemd = prefer === "systemd" || (prefer === "auto" && o.platform === "linux");
  const wantLaunchd = prefer === "launchd" || (prefer === "auto" && o.platform === "darwin");

  if (wantSystemd) {
    const ok =
      (await o.exec(["systemd-run", "--version"])).code === 0 &&
      (await o.exec(["systemctl", "--user", "show-environment"])).code === 0;
    if (ok)
      return {
        supervisor: new SystemdSupervisor(o.exec),
        reason: "systemd user manager available",
      };
    const why =
      "systemd user manager unavailable (need systemd-run and a running `systemctl --user`)";
    if (prefer === "systemd")
      throw new Error(`${why}; use --supervisor inproc or fix the user session`);
    return { supervisor: new InProcSupervisor(), reason: `${why}; using in-process supervisor` };
  }
  if (wantLaunchd) {
    const ok = (await o.exec(["launchctl", "print", `gui/${o.uid}`])).code === 0;
    if (ok)
      return {
        supervisor: new LaunchdSupervisor(o.exec, `${o.runDir}/launchd`, o.uid),
        reason: `launchd gui/${o.uid} domain available`,
      };
    const why = `launchd gui/${o.uid} domain unavailable (no GUI login session, e.g. over ssh)`;
    if (prefer === "launchd") throw new Error(`${why}; use --supervisor inproc`);
    return { supervisor: new InProcSupervisor(), reason: `${why}; using in-process supervisor` };
  }
  return {
    supervisor: new InProcSupervisor(),
    reason: `no native supervisor for platform ${o.platform}`,
  };
}
