#!/usr/bin/env bun
// @bun

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
// packages/config-merge/src/index.ts
import { writeFileSync } from "fs";
function mergeFiles(targetPath, sourcePath, opts = {}) {
  const target = readJsonFile(targetPath);
  const source = readJsonFile(sourcePath);
  const conflicts = [];
  const promotions = [];
  const merged = deepMergeTargetWins(target, source, {
    onConflict: (c) => conflicts.push(c),
    onPromote: (path, sourceValue) => promotions.push({ path, sourceValue })
  });
  if (opts.inPlace) {
    writeFileSync(targetPath, stringifyJson(merged), "utf8");
  }
  return { merged, conflicts, promotions };
}

// packages/config-merge/src/cli.ts
function parseArgs(argv) {
  const out = {
    inPlace: false,
    quiet: false,
    diffOnly: false,
    help: false
  };
  const positional = [];
  for (const a of argv) {
    if (a === "--in-place")
      out.inPlace = true;
    else if (a === "--quiet")
      out.quiet = true;
    else if (a === "--diff-only")
      out.diffOnly = true;
    else if (a === "--help" || a === "-h")
      out.help = true;
    else
      positional.push(a);
  }
  if (positional[0] !== undefined)
    out.target = positional[0];
  if (positional[1] !== undefined)
    out.source = positional[1];
  return out;
}
var HELP = `Usage: config-merge [options] <target.json> <source.json>

Merges source.json INTO target.json with target as source-of-truth:
  - target's value WINS on every conflict
  - source-only keys are promoted into the result
  - warnings are emitted for every conflict

Options:
  --in-place    write merged result back to <target.json> (default: stdout)
  --quiet       suppress conflict warnings
  --diff-only   exit non-zero if any merge would occur (dry-run gate)
  -h, --help    show this help
`;
async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!args.target || !args.source) {
    process.stderr.write(HELP);
    return 2;
  }
  let result;
  try {
    result = mergeFiles(args.target, args.source, { inPlace: args.inPlace });
  } catch (e) {
    stderr.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  if (!args.quiet) {
    for (const c of result.conflicts) {
      stderr.warn(`${c.path}: target=${JSON.stringify(c.targetValue)} source=${JSON.stringify(c.sourceValue)} \u2014 keeping target`);
    }
    for (const p of result.promotions) {
      stderr.info(`${p.path}: promoted from source (target had no value)`);
    }
  }
  if (args.diffOnly) {
    return result.conflicts.length + result.promotions.length > 0 ? 3 : 0;
  }
  if (!args.inPlace) {
    process.stdout.write(stringifyJson(result.merged));
  }
  return 0;
}

// packages/config-merge/src/bin.ts
main(process.argv.slice(2)).then((code) => process.exit(code));
