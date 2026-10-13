export type SupervisorKind = "systemd" | "launchd" | "inproc";

export interface ServiceSpec {
  /** Repo name; unique per service. */
  name: string;
  cwd: string;
  argv: string[];
  env: Record<string, string>;
  logFile: string;
}

export type ServiceState = "running" | "starting" | "failed" | "stopped";

export interface ServiceStatus {
  name: string;
  state: ServiceState;
  pid?: number;
  /** Times the supervisor has restarted it (best effort per backend). */
  restarts?: number;
  supervisor: SupervisorKind;
}

export interface Supervisor {
  readonly kind: SupervisorKind;
  /** Ensure the service runs with exactly this spec (replacing a running one). */
  start(spec: ServiceSpec): Promise<void>;
  stop(name: string): Promise<void>;
  status(name: string): Promise<ServiceStatus>;
  /** Names of services this backend currently knows about (running or failed). */
  list(): Promise<string[]>;
  /** Called on daemon shutdown; native backends may leave services to be stopped explicitly. */
  dispose(): Promise<void>;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}
export type Exec = (argv: string[]) => Promise<ExecResult>;

/** A helper that never returns (e.g. a tmux client stuck on a dying server) must not wedge the daemon. */
const EXEC_TIMEOUT_MS = 30_000;

export const realExec: Exec = async (argv) => {
  try {
    const p = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    const timer = setTimeout(() => p.kill("SIGKILL"), EXEC_TIMEOUT_MS);
    try {
      const [stdout, stderr, code] = await Promise.all([
        new Response(p.stdout).text(),
        new Response(p.stderr).text(),
        p.exited,
      ]);
      return { code, stdout, stderr };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { code: 127, stdout: "", stderr: (e as Error).message };
  }
};
