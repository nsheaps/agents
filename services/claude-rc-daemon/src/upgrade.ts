export interface UpgradeResult {
  ok: boolean;
  output: string;
}

const TAIL = 2000;
const tail = (s: string) => (s.length > TAIL ? s.slice(-TAIL) : s);

/** Run `claude upgrade` with a timeout; never throws. Runs in its own process group so a timeout kills grandchildren too. */
export async function runUpgrade(
  claudeBin: string,
  timeoutMs = 10 * 60_000,
): Promise<UpgradeResult> {
  try {
    const p = Bun.spawn([claudeBin, "upgrade"], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: true,
    });
    const finished = Promise.all([
      new Response(p.stdout).text(),
      new Response(p.stderr).text(),
      p.exited,
    ]).then(([out, err, code]) => ({ out, err, code }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<"timeout">((res) => {
      timer = setTimeout(() => res("timeout"), timeoutMs);
    });
    const r = await Promise.race([finished, timeout]);
    clearTimeout(timer);
    if (r === "timeout") {
      try {
        process.kill(-p.pid, "SIGKILL");
      } catch {
        p.kill("SIGKILL");
      }
      return { ok: false, output: `claude upgrade timed out after ${timeoutMs}ms` };
    }
    return { ok: r.code === 0, output: tail(`${r.out}${r.err}`.trim()) };
  } catch (e) {
    return { ok: false, output: `could not run ${claudeBin}: ${(e as Error).message}` };
  }
}
