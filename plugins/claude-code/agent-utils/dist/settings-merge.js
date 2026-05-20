#!/usr/bin/env bun
// @bun

// packages/settings-merge/src/index.ts
import { existsSync as existsSync2, writeFileSync } from "fs";

// packages/shared/src/json.ts
import { readFileSync } from "fs";

class JsonParseError extends Error {
  path;
  cause;
  constructor(path, cause) {
    super(`Failed to parse JSON at ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.path = path;
    this.cause = cause;
    this.name = "JsonParseError";
  }
}
function readJsonFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new JsonParseError(path, e);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new JsonParseError(path, e);
  }
}
function stringifyJson(value) {
  return JSON.stringify(value, null, 2) + `
`;
}
function isJsonObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function deepMergeTargetWins(target, source, opts = {}, path = "") {
  if (!isJsonObject(target) || !isJsonObject(source)) {
    if (!equalsJson(target, source)) {
      opts.onConflict?.({
        path: path || "<root>",
        targetValue: target,
        sourceValue: source
      });
    }
    return target;
  }
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const childPath = path ? `${path}.${key}` : key;
    const sv = source[key];
    if (key in target) {
      const tv = target[key];
      if (isJsonObject(tv) && isJsonObject(sv)) {
        out[key] = deepMergeTargetWins(tv, sv, opts, childPath);
      } else if (!equalsJson(tv, sv)) {
        opts.onConflict?.({
          path: childPath,
          targetValue: tv,
          sourceValue: sv
        });
        out[key] = tv;
      } else {
        out[key] = tv;
      }
    } else {
      opts.onPromote?.(childPath, sv);
      out[key] = sv;
    }
  }
  return out;
}
function equalsJson(a, b) {
  if (a === b)
    return true;
  if (typeof a !== typeof b)
    return false;
  if (a === null || b === null)
    return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return false;
    return a.every((v, i) => equalsJson(v, b[i]));
  }
  if (isJsonObject(a) && isJsonObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length)
      return false;
    return ak.every((k) => equalsJson(a[k], b[k]));
  }
  return false;
}
// packages/shared/src/paths.ts
import { homedir } from "os";
import { join } from "path";
function resolveAgentRepo(env = process.env, cwd = process.cwd()) {
  const v = env.AGENT_REPO;
  if (v && v.length > 0)
    return { path: v, fromEnv: true };
  return { path: cwd, fromEnv: false };
}
function resolveClaudeConfigDir(env = process.env, home = homedir()) {
  const v = env.CLAUDE_CONFIG_DIR;
  if (v && v.length > 0)
    return { path: v, fromEnv: true };
  return { path: join(home, ".claude"), fromEnv: false };
}
function agentSettingsPath(agentRepo) {
  return join(agentRepo, ".claude", "settings.json");
}
function agentSettingsBackupPath(agentRepo) {
  return join(agentRepo, ".claude", "settings.bak");
}
function userSettingsPath(claudeConfigDir) {
  return join(claudeConfigDir, "settings.json");
}
function userLocalSettingsPath(claudeConfigDir) {
  return join(claudeConfigDir, "settings.local.json");
}
// packages/shared/src/log.ts
function colorize(stream, code, text) {
  if (process.env.NO_COLOR)
    return text;
  if (!stream.isTTY)
    return text;
  return `\x1B[${code}m${text}\x1B[0m`;
}
function makeLogger(stream = process.stderr) {
  return {
    warn(msg) {
      stream.write(`${colorize(stream, "33", "WARN")}: ${msg}
`);
    },
    info(msg) {
      stream.write(`${colorize(stream, "36", "INFO")}: ${msg}
`);
    },
    error(msg) {
      stream.write(`${colorize(stream, "31", "ERROR")}: ${msg}
`);
    },
    raw(msg) {
      stream.write(msg);
    }
  };
}
var stderr = makeLogger();
// packages/settings-merge/src/backup.ts
import { copyFileSync, existsSync } from "fs";
class MissingSettingsError extends Error {
  path;
  constructor(path) {
    super(`Missing settings.json at ${path}`);
    this.path = path;
    this.name = "MissingSettingsError";
  }
}
function backupSettings(agentRepo) {
  const from = agentSettingsPath(agentRepo);
  const to = agentSettingsBackupPath(agentRepo);
  if (!existsSync(from)) {
    throw new MissingSettingsError(from);
  }
  copyFileSync(from, to);
  return { from, to };
}

// packages/settings-merge/src/index.ts
function settingsMerge(opts) {
  const target = agentSettingsPath(opts.agentRepo);
  if (!existsSync2(target)) {
    throw new MissingSettingsError(target);
  }
  const result = {
    target,
    backupPath: undefined,
    passes: [],
    finalMerged: undefined
  };
  if (!opts.noBackup && !opts.dryRun) {
    const { to } = backupSettings(opts.agentRepo);
    result.backupPath = to;
  }
  let current = readJsonFile(target);
  const sources = [
    userLocalSettingsPath(opts.claudeConfigDir),
    userSettingsPath(opts.claudeConfigDir)
  ];
  for (const sourcePath of sources) {
    if (!existsSync2(sourcePath)) {
      result.passes.push({
        sourcePath,
        skipped: true,
        conflicts: [],
        promotions: []
      });
      continue;
    }
    const source = readJsonFile(sourcePath);
    const conflicts = [];
    const promotions = [];
    current = deepMergeTargetWins(current, source, {
      onConflict: (c) => conflicts.push(c),
      onPromote: (path, sourceValue) => promotions.push({ path, sourceValue })
    });
    result.passes.push({ sourcePath, skipped: false, conflicts, promotions });
  }
  result.finalMerged = current;
  if (!opts.dryRun) {
    writeFileSync(target, stringifyJson(current), "utf8");
  }
  return result;
}

// packages/settings-merge/src/cli.ts
import { basename } from "path";
function parseArgs(argv) {
  const out = { dryRun: false, noBackup: false, help: false };
  for (const a of argv) {
    if (a === "--dry-run")
      out.dryRun = true;
    else if (a === "--no-backup")
      out.noBackup = true;
    else if (a === "--help" || a === "-h")
      out.help = true;
  }
  return out;
}
var HELP = `Usage: settings-merge [options]

Merges $CLAUDE_CONFIG_DIR/.claude/settings.local.json and
$CLAUDE_CONFIG_DIR/.claude/settings.json INTO
$AGENT_REPO/.claude/settings.json, with target as source-of-truth.

Env:
  AGENT_REPO           required (falls back to cwd with a warning)
  CLAUDE_CONFIG_DIR    falls back to ~/.claude

Options:
  --dry-run     show what would change; skip the write + backup
  --no-backup   skip writing settings.bak (testing aid)
  -h, --help    show this help
`;
async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const ar = resolveAgentRepo();
  if (!ar.fromEnv) {
    stderr.warn(`AGENT_REPO not set \u2014 falling back to cwd: ${ar.path}`);
  }
  const ccd = resolveClaudeConfigDir();
  if (!ccd.fromEnv) {
    stderr.warn(`CLAUDE_CONFIG_DIR not set \u2014 falling back to: ${ccd.path}`);
  }
  let result;
  try {
    result = settingsMerge({
      agentRepo: ar.path,
      claudeConfigDir: ccd.path,
      dryRun: args.dryRun,
      noBackup: args.noBackup
    });
  } catch (e) {
    stderr.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  for (const p of result.passes) {
    const tag = basename(p.sourcePath);
    if (p.skipped) {
      stderr.info(`${tag}: skipped (file does not exist)`);
      continue;
    }
    for (const c of p.conflicts) {
      stderr.warn(`${tag}: ${c.path}: target=${JSON.stringify(c.targetValue)} source=${JSON.stringify(c.sourceValue)} \u2014 keeping target`);
    }
    for (const promo of p.promotions) {
      stderr.info(`${tag}: promoted ${promo.path}`);
    }
  }
  const totalPromos = result.passes.reduce((n, p) => n + p.promotions.length, 0);
  const totalConflicts = result.passes.reduce((n, p) => n + p.conflicts.length, 0);
  stderr.info(`${args.dryRun ? "[dry-run] " : ""}target=${result.target} backup=${result.backupPath ?? "(none)"} promotions=${totalPromos} conflicts=${totalConflicts}`);
  return 0;
}

// packages/settings-merge/src/bin.ts
main(process.argv.slice(2)).then((code) => process.exit(code));
