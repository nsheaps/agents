#!/usr/bin/env bun
// Builds standalone claude-rc + claude-rc-daemon binaries for every release
// target and writes <name>-<os>-<arch>.tar.gz plus a .sha256 per target.
//
//   bun run scripts/build-binary.ts --version 1.2.3 [--out dist] [--target linux-x64]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"] as const;
type Target = (typeof TARGETS)[number];

const root = resolve(import.meta.dir, "../../..");
const ENTRIES = {
  "claude-rc": join(root, "apps/claude-rc-cli/src/main.ts"),
  "claude-rc-daemon": join(root, "services/claude-rc-daemon/src/main.ts"),
} as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const version = (arg("version") ?? process.env.CLAUDE_RC_VERSION ?? "0.0.0-dev").replace(
  /^claude-rc-v|^v/,
  "",
);
const out = resolve(arg("out") ?? "dist");
const only = arg("target");
if (only && !(TARGETS as readonly string[]).includes(only)) {
  console.error(`unknown target ${only}; expected one of ${TARGETS.join(", ")}`);
  process.exit(2);
}
const targets: Target[] = only ? [only as Target] : [...TARGETS];

async function run(cmd: string[], cwd?: string): Promise<void> {
  const p = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await p.exited) !== 0) throw new Error(`${cmd.join(" ")} failed`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const target of targets) {
  const stage = join(out, `stage-${target}`);
  mkdirSync(stage, { recursive: true });
  for (const [name, entry] of Object.entries(ENTRIES)) {
    await run([
      "bun",
      "build",
      "--compile",
      `--target=bun-${target}`,
      "--define",
      `__CLAUDE_RC_VERSION__=${JSON.stringify(version)}`,
      entry,
      "--outfile",
      join(stage, name),
    ]);
  }
  const archive = `claude-rc-${version}-${target}.tar.gz`;
  await run(["tar", "-czf", join(out, archive), "-C", stage, ...Object.keys(ENTRIES)]);
  const bytes = await Bun.file(join(out, archive)).arrayBuffer();
  const sha = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  writeFileSync(join(out, `${archive}.sha256`), `${sha}  ${archive}\n`);
  rmSync(stage, { recursive: true, force: true });
  console.log(`built ${archive} (${sha})`);
}
