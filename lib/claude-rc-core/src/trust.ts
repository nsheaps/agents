import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

function git(cwd: string, args: string[]): string | undefined {
  const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "ignore" });
  return r.exitCode === 0 ? r.stdout.toString().trim() : undefined;
}

/**
 * The `projects` key Claude Code stores workspace trust under:
 * the git root (the main checkout for worktrees), else the directory itself.
 * Trust is never persisted for the home directory.
 */
export function trustKeyFor(dir: string): string {
  const abs = resolve(dir);
  if (abs === resolve(homedir())) {
    throw new Error(
      "Claude Code never saves trust for your home directory; use a project directory",
    );
  }
  const common = git(abs, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (common) {
    // bare/odd layouts: fall back to the toplevel
    if (common.endsWith("/.git")) return dirname(common);
    return git(abs, ["rev-parse", "--show-toplevel"]) ?? abs;
  }
  return abs;
}

const MAX_ATTEMPTS = 5;

/**
 * Set projects[key].hasTrustDialogAccepted = true in ~/.claude.json (atomic rename, mode-preserving).
 * Claude Code rewrites this file too, so the read-modify-write uses optimistic concurrency: if the
 * file changed (mtime/size) between our read and the rename, re-read and redo, up to a few times.
 * A write landing between that final check and the rename can still be lost (no cross-process lock
 * is possible with a file Claude owns); the window is a few microseconds.
 * `beforeCommit` is a test seam called just before the final check.
 */
export function ensureTrusted(
  claudeJsonPath: string,
  key: string,
  beforeCommit?: () => void,
): "added" | "unchanged" {
  for (let attempt = 1; ; attempt++) {
    let data: Record<string, any> = {};
    let mode = 0o600;
    let before: { mtimeMs: number; size: number } | undefined;
    if (existsSync(claudeJsonPath)) {
      const st = statSync(claudeJsonPath);
      mode = st.mode & 0o777;
      before = { mtimeMs: st.mtimeMs, size: st.size };
      try {
        data = JSON.parse(readFileSync(claudeJsonPath, "utf8"));
      } catch {
        throw new Error(`${claudeJsonPath} is not valid JSON; refusing to modify it`);
      }
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error(`${claudeJsonPath} is not a JSON object; refusing to modify it`);
      }
    }
    const projects = (data.projects ??= {});
    const entry = (projects[key] ??= {});
    if (entry.hasTrustDialogAccepted === true) return "unchanged";
    entry.hasTrustDialogAccepted = true;
    const tmp = `${claudeJsonPath}.claude-rc.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode });
    chmodSync(tmp, mode);
    beforeCommit?.();
    const now = existsSync(claudeJsonPath) ? statSync(claudeJsonPath) : undefined;
    const changed = before
      ? !now || now.mtimeMs !== before.mtimeMs || now.size !== before.size
      : now !== undefined;
    if (changed && attempt < MAX_ATTEMPTS) {
      unlinkSync(tmp);
      continue;
    }
    if (changed) {
      unlinkSync(tmp);
      throw new Error(`${claudeJsonPath} keeps changing; try again`);
    }
    renameSync(tmp, claudeJsonPath);
    return "added";
  }
}
