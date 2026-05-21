#!/usr/bin/env bun
// @bun

// src/cli.ts
import { join } from "path";
import { homedir } from "os";
import { spawn } from "child_process";
// ../shared/src/log.ts
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
// src/check.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
async function runCheck(env) {
  if (existsSync(env.throttleFile)) {
    const lastTs = parseInt(readFileSync(env.throttleFile, "utf8").trim(), 10) || 0;
    if (env.now - lastTs < env.throttleSeconds) {
      return { shouldEmit: false };
    }
  }
  mkdirSync(dirname(env.throttleFile), { recursive: true });
  writeFileSync(env.throttleFile, String(env.now));
  const top = await env.runGit(["rev-parse", "--show-toplevel"]);
  if (top.code !== 0)
    return { shouldEmit: false };
  await env.runGit(["fetch", "--quiet"]);
  const cur = await env.runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const currentBranch = cur.stdout.trim();
  if (currentBranch === "HEAD" || currentBranch === "") {
    return { shouldEmit: false };
  }
  const defRef = await env.runGit([
    "symbolic-ref",
    "refs/remotes/origin/HEAD"
  ]);
  const defaultBranch = defRef.code === 0 ? defRef.stdout.trim().replace(/^refs\/remotes\/origin\//, "") : "main";
  const messages = [];
  const behindCur = await env.runGit([
    "rev-list",
    "--count",
    `HEAD..origin/${currentBranch}`
  ]);
  const behindCurrent = behindCur.code === 0 ? parseInt(behindCur.stdout.trim(), 10) || 0 : 0;
  if (behindCurrent > 0) {
    messages.push(`<system-message>Upstream agent repo has ${behindCurrent} new commit${behindCurrent === 1 ? "" : "s"} on \`${currentBranch}\`. Fetch and pull changes in ${env.repoDir} to get the latest.</system-message>`);
  }
  if (defaultBranch !== currentBranch) {
    const verify = await env.runGit(["rev-parse", "--verify", defaultBranch]);
    if (verify.code === 0) {
      const behindDef = await env.runGit([
        "rev-list",
        "--count",
        `${defaultBranch}..origin/${defaultBranch}`
      ]);
      const behindDefault = behindDef.code === 0 ? parseInt(behindDef.stdout.trim(), 10) || 0 : 0;
      if (behindDefault > 0) {
        messages.push(`<system-message>Upstream agent repo has ${behindDefault} new commit${behindDefault === 1 ? "" : "s"} on default branch \`${defaultBranch}\`. Fetch and pull changes in ${env.repoDir} to get the latest.</system-message>`);
      }
    }
  }
  const status = await env.runGit(["status", "--porcelain"]);
  if (status.code === 0 && status.stdout.trim() !== "") {
    messages.push(`<system-message>Agent repo ${env.repoDir} has uncommitted changes. Consider running \`/scm-utils:commit\` to commit them.</system-message>`);
  }
  if (messages.length === 0) {
    return { shouldEmit: false };
  }
  const combined = messages.join(`
`);
  return {
    shouldEmit: true,
    systemMessage: combined,
    additionalContext: combined
  };
}

// src/cli.ts
function resolveRepoDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.env.AGENT_REPO || process.env.AGENT_REPO_DIR || process.cwd();
}
function resolveThrottleFile() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (dataDir)
    return join(dataDir, "upstream-check-last-fetch");
  return join(homedir(), ".cache", "agent-utils-upstream-check-last-fetch");
}
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
  try {
    await readStdin();
  } catch {}
  const repoDir = resolveRepoDir();
  const runGit = async (args) => await new Promise((resolveP) => {
    const proc = spawn("git", ["-C", repoDir, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    let out = "";
    let err = "";
    proc.stdout.on("data", (c) => {
      out += c.toString("utf8");
    });
    proc.stderr.on("data", (c) => {
      err += c.toString("utf8");
    });
    proc.on("error", () => {
      resolveP({ stdout: "", stderr: "spawn failed", code: 127 });
    });
    proc.on("close", (code) => {
      resolveP({ stdout: out, stderr: err, code: code ?? 0 });
    });
  });
  let result;
  try {
    result = await runCheck({
      repoDir,
      throttleFile: resolveThrottleFile(),
      throttleSeconds: 300,
      now: Math.floor(Date.now() / 1000),
      runGit
    });
  } catch (e) {
    stderr.error(`upstream-check failed: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
  if (result.shouldEmit) {
    const payload = {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit"
      }
    };
    if (result.additionalContext) {
      payload.hookSpecificOutput.additionalContext = result.additionalContext;
    }
    if (result.systemMessage) {
      payload.systemMessage = result.systemMessage;
    }
    process.stdout.write(JSON.stringify(payload));
  }
  return 0;
}

// src/bin.ts
main().then((code) => process.exit(code));
