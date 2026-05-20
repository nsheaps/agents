#!/usr/bin/env bun
// @bun
// packages/shared/src/paths.ts
import { join } from "path";
function resolveAgentRepo(env = process.env, cwd = process.cwd()) {
  const v = env.AGENT_REPO;
  if (v && v.length > 0)
    return { path: v, fromEnv: true };
  return { path: cwd, fromEnv: false };
}
function agentSettingsPath(agentRepo) {
  return join(agentRepo, ".claude", "settings.json");
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
// packages/settings-write-guard/src/match.ts
import { resolve, normalize } from "path";
function shouldFire(payload, agentRepo) {
  const canonical = normalize(agentSettingsPath(agentRepo));
  const tool = payload.tool_name;
  if (isFileWriteTool(tool)) {
    const fp = payload.tool_input?.file_path;
    if (typeof fp !== "string")
      return { fire: false };
    const resolved = normalize(resolve(fp));
    if (!isSettingsPath(resolved))
      return { fire: false };
    if (resolved === canonical)
      return { fire: false };
    return { fire: true, targetPath: resolved };
  }
  if (tool === "SlashCommand") {
    const cmd = payload.tool_input?.command ?? "";
    if (typeof cmd === "string" && cmd.trim().startsWith("/plugin")) {
      return { fire: true };
    }
    return { fire: false };
  }
  if (tool === "Bash") {
    const cmd = payload.tool_input?.command;
    if (typeof cmd !== "string")
      return { fire: false };
    if (/(^|[\s;&|`])claude\s+plugin(\s|$)/.test(cmd)) {
      return { fire: true };
    }
    return { fire: false };
  }
  return { fire: false };
}
function isFileWriteTool(tool) {
  return tool === "Edit" || tool === "Write" || tool === "NotebookEdit" || tool === "MultiEdit" || tool === "Update";
}
function isSettingsPath(p) {
  return /\.claude\/(settings\.local\.json|settings\.json)$/.test(p);
}

// packages/settings-write-guard/src/hook.ts
function runHook(payload, opts = {}) {
  const agentRepo = opts.agentRepo ?? resolveAgentRepo().path;
  const log2 = opts.log ?? makeLogger();
  const m = shouldFire(payload, agentRepo);
  if (!m.fire)
    return { fired: false };
  log2.warn(`All settings files except ${agentRepo}/.claude/settings.json are wiped on agent restart. Any settings that need to be preserved must go in that settings file.`);
  log2.warn(`Your $AGENT_REPO is ${agentRepo}`);
  return { fired: true };
}

// packages/settings-write-guard/src/cli.ts
async function readStdin() {
  return await new Promise((resolveP, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveP(data));
    process.stdin.on("error", reject);
  });
}
async function main() {
  let raw = "";
  try {
    raw = await readStdin();
  } catch (e) {
    stderr.error(`failed to read stdin: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
  if (raw.trim() === "") {
    return 0;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    stderr.error(`failed to parse hook payload: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
  runHook(payload);
  return 0;
}

// packages/settings-write-guard/src/bin.ts
main().then((code) => process.exit(code));
