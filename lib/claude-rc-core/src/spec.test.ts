import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSpec, resolveClaude, resolveTmux, specHash } from "./spec";

const paths = { logDir: "/logs" } as any;

describe("buildSpec", () => {
  const base = { PATH: "/usr/bin", HOME: "/h", USER: "u", SECRET_TOKEN: "nope", LANG: "C" };
  test("command is `claude rc --spawn <mode> --verbose` in the repo dir", () => {
    const s = buildSpec(
      { name: "a", path: "/r/a" },
      { spawn: "worktree", env: {} },
      { claudeBin: "/bin/claude", baseEnv: base, paths },
    );
    expect(s.argv).toEqual(["/bin/claude", "rc", "--spawn", "worktree", "--verbose"]);
    expect(s.cwd).toBe("/r/a");
    expect(s.logFile).toBe("/logs/a.log");
  });
  test("tmuxPrefix wraps the command and wins over ptyPrefix", () => {
    const s = buildSpec(
      { name: "a", path: "/r/a" },
      { spawn: "session", env: {} },
      {
        claudeBin: "/bin/claude",
        baseEnv: base,
        paths,
        ptyPrefix: ["/bin/rcd", "pty-run", "--"],
        tmuxPrefix: ["/bin/rcd", "tmux-run", "--"],
      },
    );
    expect(s.argv).toEqual([
      "/bin/rcd",
      "tmux-run",
      "--",
      "/bin/claude",
      "rc",
      "--spawn",
      "session",
      "--verbose",
    ]);
  });
  test("ptyPrefix wraps the command so claude gets a terminal", () => {
    const s = buildSpec(
      { name: "a", path: "/r/a" },
      { spawn: "worktree", env: {} },
      { claudeBin: "/bin/claude", baseEnv: base, paths, ptyPrefix: ["/bin/rcd", "pty-run", "--"] },
    );
    expect(s.argv).toEqual([
      "/bin/rcd",
      "pty-run",
      "--",
      "/bin/claude",
      "rc",
      "--spawn",
      "worktree",
      "--verbose",
    ]);
  });
  test("per-repo spawn overrides global", () => {
    const s = buildSpec(
      { name: "a", path: "/r", spawn: "same-dir" },
      { spawn: "worktree", env: {} },
      { claudeBin: "c", baseEnv: base, paths },
    );
    expect(s.argv).toContain("same-dir");
  });
  test("env: allowlisted base + global + repo override; unrelated secrets are not leaked", () => {
    const s = buildSpec(
      { name: "a", path: "/r", env: { K: "repo" } },
      { spawn: "worktree", env: { K: "g", G: "1" } },
      { claudeBin: "c", baseEnv: base, paths },
    );
    expect(s.env.K).toBe("repo");
    expect(s.env.G).toBe("1");
    expect(s.env.HOME).toBe("/h");
    expect(s.env.SECRET_TOKEN).toBeUndefined();
  });
  test("PATH is extended with the usual claude install dirs", () => {
    const s = buildSpec(
      { name: "a", path: "/r" },
      { spawn: "worktree", env: {} },
      { claudeBin: "/h/.local/bin/claude", baseEnv: base, paths },
    );
    expect(s.env.PATH!.split(":")).toContain("/h/.local/bin");
    expect(s.env.PATH!.startsWith("/usr/bin")).toBe(true);
  });
});

describe("specHash", () => {
  const s = { name: "a", cwd: "/r", argv: ["c"], env: { A: "1", B: "2" }, logFile: "/l" };
  test("stable regardless of env key order", () => {
    expect(specHash(s)).toBe(specHash({ ...s, env: { B: "2", A: "1" } }));
  });
  test("changes when anything meaningful changes", () => {
    expect(specHash(s)).not.toBe(specHash({ ...s, argv: ["c", "x"] }));
    expect(specHash(s)).not.toBe(specHash({ ...s, env: { A: "1" } }));
    expect(specHash(s)).not.toBe(specHash({ ...s, cwd: "/q" }));
  });
});

describe("resolveTmux", () => {
  const mk = (dir: string) => {
    mkdirSync(dir, { recursive: true });
    const f = join(dir, "tmux");
    writeFileSync(f, "#!/bin/sh\n");
    chmodSync(f, 0o755);
    return f;
  };
  test("prefers CLAUDE_RC_TMUX_BIN, then PATH, then fallback dirs", () => {
    const d = mkdtempSync(join(tmpdir(), "rc-tm-"));
    const a = mk(join(d, "a"));
    const b = mk(join(d, "b"));
    expect(resolveTmux({ CLAUDE_RC_TMUX_BIN: a, PATH: join(d, "b") }, d)).toBe(a);
    expect(resolveTmux({ PATH: join(d, "b") }, d)).toBe(b);
    const l = mk(join(d, ".local", "bin"));
    expect(resolveTmux({ PATH: "/nonexistent" }, d)).toBe(l);
  });
});

describe("resolveClaude", () => {
  const mkbin = (dir: string) => {
    mkdirSync(dir, { recursive: true });
    const f = join(dir, "claude");
    writeFileSync(f, "#!/bin/sh\n");
    chmodSync(f, 0o755);
    return f;
  };
  test("prefers CLAUDE_RC_CLAUDE_BIN", () => {
    const d = mkdtempSync(join(tmpdir(), "rc-cl-"));
    const f = mkbin(join(d, "x"));
    expect(resolveClaude({ CLAUDE_RC_CLAUDE_BIN: f, PATH: "" }, d)).toBe(f);
  });
  test("finds claude on PATH", () => {
    const d = mkdtempSync(join(tmpdir(), "rc-cl-"));
    const f = mkbin(join(d, "bin"));
    expect(resolveClaude({ PATH: join(d, "bin") }, d)).toBe(f);
  });
  test("falls back to ~/.local/bin when PATH is minimal (service environments)", () => {
    const d = mkdtempSync(join(tmpdir(), "rc-cl-"));
    const f = mkbin(join(d, ".local", "bin"));
    expect(resolveClaude({ PATH: "/usr/bin" }, d)).toBe(f);
  });
  test("undefined when not installed", () => {
    const d = mkdtempSync(join(tmpdir(), "rc-cl-"));
    expect(resolveClaude({ PATH: "/nonexistent" }, d)).toBeUndefined();
  });
});
