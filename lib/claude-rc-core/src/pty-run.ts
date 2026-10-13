import { constants } from "node:os";

export interface PtyRunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  cols?: number;
  rows?: number;
  /** Receives everything the child writes to its terminal. */
  onData: (chunk: string) => void;
  /** Aborting sends SIGTERM to the child. */
  signal?: AbortSignal;
  /** Optional text typed into the terminal after `inputDelayMs` (tests, scripted prompts). */
  input?: string;
  inputDelayMs?: number;
}

/**
 * Run `argv` attached to a pseudo-terminal and resolve with its exit code
 * (128+N when killed by signal N, 127 when it cannot be spawned). `claude rc`
 * insists on a TTY; a supervisor-launched daemon has none, so the child gets one here.
 */
export async function runInPty(argv: string[], opts: PtyRunOptions): Promise<number> {
  const decoder = new TextDecoder();
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(argv, {
      cwd: opts.cwd,
      env: opts.env as Record<string, string> | undefined,
      terminal: {
        cols: opts.cols ?? 120,
        rows: opts.rows ?? 40,
        data(_terminal, chunk) {
          opts.onData(decoder.decode(chunk, { stream: true }));
        },
      },
    });
  } catch (e) {
    opts.onData(`pty-run: cannot start ${argv[0]}: ${(e as Error).message}\n`);
    return 127;
  }

  const onAbort = () => proc.kill("SIGTERM");
  if (opts.signal?.aborted) onAbort();
  else opts.signal?.addEventListener("abort", onAbort, { once: true });

  let typed: ReturnType<typeof setTimeout> | undefined;
  if (opts.input !== undefined) {
    typed = setTimeout(() => proc.terminal?.write(opts.input!), opts.inputDelayMs ?? 100);
  }

  const code = await proc.exited;
  clearTimeout(typed);
  opts.signal?.removeEventListener("abort", onAbort);
  proc.terminal?.close();
  if (proc.signalCode) {
    const n = constants.signals[proc.signalCode as keyof typeof constants.signals];
    return 128 + (n ?? 0);
  }
  return code;
}
