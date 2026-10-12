import { chmodSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
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

/** Set projects[key].hasTrustDialogAccepted = true in ~/.claude.json (atomic, mode-preserving). */
export function ensureTrusted(claudeJsonPath: string, key: string): "added" | "unchanged" {
  let data: Record<string, any> = {};
  let mode = 0o600;
  if (existsSync(claudeJsonPath)) {
    mode = statSync(claudeJsonPath).mode & 0o777;
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
  renameSync(tmp, claudeJsonPath);
  return "added";
}
