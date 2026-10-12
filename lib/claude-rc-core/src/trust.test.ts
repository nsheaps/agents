import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTrusted, trustKeyFor } from "./trust";

const sh = (cmd: string, cwd: string) =>
  Bun.spawnSync(["bash", "-c", cmd], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
  });

function repo() {
  const d = mkdtempSync(join(tmpdir(), "rc-trust-"));
  sh(
    "git init -q -b main . && git -c user.email=a@b -c user.name=n commit -q --allow-empty -m i",
    d,
  );
  return Bun.spawnSync(["realpath", d]).stdout.toString().trim();
}

describe("trustKeyFor", () => {
  test("git repo root for a repo (even from a subdir)", () => {
    const r = repo();
    mkdirSync(join(r, "sub"));
    expect(trustKeyFor(join(r, "sub"))).toBe(r);
  });
  test("main checkout root for a worktree", () => {
    const r = repo();
    sh(`git worktree add -q ../wt-${Date.now()} -b wt`, r);
    const wt = sh("git worktree list --porcelain", r)
      .stdout.toString()
      .split("\n")
      .filter((l) => l.startsWith("worktree "))[1]!
      .slice(9);
    expect(trustKeyFor(wt)).toBe(r);
  });
  test("plain directory outside a repo keys on itself", () => {
    const d = Bun.spawnSync(["realpath", mkdtempSync(join(tmpdir(), "rc-plain-"))])
      .stdout.toString()
      .trim();
    expect(trustKeyFor(d)).toBe(d);
  });
  test("refuses the home directory", () => {
    expect(() => trustKeyFor(homedir())).toThrow(/home directory/);
  });
});

describe("ensureTrusted", () => {
  const file = () => join(mkdtempSync(join(tmpdir(), "rc-cj-")), ".claude.json");

  test("creates the file when absent", () => {
    const f = file();
    expect(ensureTrusted(f, "/p")).toBe("added");
    expect(JSON.parse(readFileSync(f, "utf8")).projects["/p"].hasTrustDialogAccepted).toBe(true);
  });
  test("preserves unrelated keys and sibling project fields", () => {
    const f = file();
    writeFileSync(
      f,
      JSON.stringify({
        userID: "u",
        projects: { "/p": { allowedTools: ["x"] }, "/q": { hasTrustDialogAccepted: true } },
      }),
    );
    expect(ensureTrusted(f, "/p")).toBe("added");
    const j = JSON.parse(readFileSync(f, "utf8"));
    expect(j.userID).toBe("u");
    expect(j.projects["/p"]).toEqual({ allowedTools: ["x"], hasTrustDialogAccepted: true });
    expect(j.projects["/q"].hasTrustDialogAccepted).toBe(true);
  });
  test("idempotent: already trusted -> unchanged, file not rewritten", () => {
    const f = file();
    writeFileSync(f, JSON.stringify({ projects: { "/p": { hasTrustDialogAccepted: true } } }));
    const before = Bun.file(f).lastModified;
    expect(ensureTrusted(f, "/p")).toBe("unchanged");
    expect(Bun.file(f).lastModified).toBe(before);
  });
  test("refuses to touch a corrupt file", () => {
    const f = file();
    writeFileSync(f, "{not json");
    expect(() => ensureTrusted(f, "/p")).toThrow(/not valid JSON/);
    expect(readFileSync(f, "utf8")).toBe("{not json");
  });
  test("keeps file mode (0600) when rewriting", () => {
    const f = file();
    writeFileSync(f, "{}", { mode: 0o600 });
    ensureTrusted(f, "/p");
    expect(Bun.spawnSync(["stat", "-c", "%a", f]).stdout.toString().trim()).toBe("600");
  });
});
