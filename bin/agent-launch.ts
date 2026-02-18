#!/usr/bin/env bun
/**
 * agent-launch — Discover and display agent definitions from .claude/agents/*.md
 *
 * Phase 1A: discovery + YAML frontmatter parsing.
 * Phase 1A+: prompt assembly (extend/replace modes).
 * Phase 1B: agent spawning (dry-run mode available).
 * Phase 1C: lifecycle management (kill, list, health, cleanup).
 */

import { discoverAgents, resolveProjectRoot } from "../src/discover";
import { assemblePrompt } from "../src/prompt";
import { buildSpawnArgs } from "../src/spawn";
import {
  killAgent,
  listAgents,
  cleanupStaleEntries,
  readTeamConfig,
} from "../src/lifecycle";

// --- CLI args ---
import { parseArgs } from "node:util";

const SUBCOMMANDS = ["list", "kill", "cleanup", "health", "relaunch", "launch"] as const;

const { values: flags, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    prompt: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "team-name": { type: "string" },
  },
  allowPositionals: true,
  strict: false,
});

const showPrompt = flags.prompt ?? false;
const dryRun = flags["dry-run"] ?? false;
const teamName = flags["team-name"] ?? process.env.AGENT_TEAM_NAME;

// First positional that matches a subcommand is the subcommand; the rest are agent names.
// If the first positional is NOT a subcommand, there is no subcommand (default: discover mode).
const subcommand = SUBCOMMANDS.includes(positionals[0] as typeof SUBCOMMANDS[number])
  ? (positionals[0] as typeof SUBCOMMANDS[number])
  : undefined;

// Everything after the subcommand (or all positionals if no subcommand) is the agent filter.
const agentFilter = subcommand ? positionals[1] : positionals[0];

// --- Main ---

const projectRoot = resolveProjectRoot();

// Handle subcommands that need team name
if (
  subcommand &&
  ["list", "kill", "cleanup", "health", "relaunch", "launch"].includes(
    subcommand,
  )
) {
  if (!teamName) {
    console.error(
      "ERROR: Team name required. Use --team-name or set AGENT_TEAM_NAME.",
    );
    process.exit(1);
  }
}

if (subcommand === "kill") {
  if (!agentFilter) {
    console.error("ERROR: Agent name required for kill command.");
    process.exit(1);
  }
  const result = killAgent(teamName!, agentFilter);
  console.log(result.message);
  process.exit(result.success ? 0 : 1);
}

if (subcommand === "cleanup") {
  const result = cleanupStaleEntries(teamName!);
  console.log(result.message);
  if (result.removed.length > 0) {
    console.log(`Removed: ${result.removed.join(", ")}`);
  }
  process.exit(0);
}

if (subcommand === "health") {
  const config = readTeamConfig(teamName!);
  if (!config) {
    console.error(`Team config not found for '${teamName}'`);
    process.exit(1);
  }

  const COL1 = 38;
  const COL2 = 10;
  const header = ["Agent".padEnd(COL1), "Status".padEnd(COL2), "Agent ID"].join(
    "  ",
  );
  console.log(header);
  console.log("-".repeat(header.length));

  for (const member of config.members) {
    // Without tmux pane tracking in config, status is UNKNOWN
    // Future: cross-reference with tmux list-panes
    const row = [
      member.name.padEnd(COL1),
      "UNKNOWN".padEnd(COL2),
      member.agentId.slice(0, 12) + "...",
    ].join("  ");
    console.log(row);
  }

  console.log(
    `\nNote: Health check limited — tmux pane tracking not yet in team config schema.`,
  );
  process.exit(0);
}

// Discover agents (needed for list, launch, relaunch, and default mode)
const discoverResult = await discoverAgents(projectRoot);

// Print errors
for (const err of discoverResult.errors) {
  console.error(`ERROR [${err.filename}]: ${err.message}`);
}

// Print warnings
for (const warn of discoverResult.warnings) {
  console.warn(`WARN  [${warn.filename}]: ${warn.message}`);
}

if (discoverResult.errors.length > 0) {
  process.exit(1);
}

// --- Launch subcommand ---
if (subcommand === "launch") {
  if (!agentFilter) {
    console.error("ERROR: Agent name required for launch command.");
    process.exit(1);
  }
  const agent = discoverResult.agents.find((a) => a.name === agentFilter);
  if (!agent) {
    console.error(`ERROR: Agent '${agentFilter}' not found in agent files.`);
    process.exit(1);
  }
  const spawn = buildSpawnArgs(agent, teamName!, projectRoot);
  for (const w of spawn.warnings) {
    console.warn(`WARN: ${w}`);
  }
  console.log(`Launching agent '${agent.name}'...`);
  console.log(`  claude ${spawn.args.map((a) => (a.includes(" ") || a.includes("\n") || a.includes('"') ? `'${a.replace(/'/g, "'\\''")}'` : a)).join(" \\\n    ")}`);
  // Note: Actual spawning is delegated to the orchestrator's Task tool, not this CLI.
  // This CLI builds the args; the orchestrator session uses them.
  console.log(
    `\nNote: Direct spawning not yet implemented. Use --dry-run to see the command, or spawn from the orchestrator session.`,
  );
  process.exit(0);
}

// --- Relaunch subcommand (spec §6.5) ---
if (subcommand === "relaunch") {
  if (!agentFilter) {
    console.error("ERROR: Agent name required for relaunch command.");
    process.exit(1);
  }

  // Step 1: Kill existing agent
  const killResult = killAgent(teamName!, agentFilter);
  if (killResult.success) {
    console.log(`Killed: ${killResult.message}`);
  } else {
    console.warn(`Kill skipped: ${killResult.message}`);
  }

  // Step 2: Re-discover agent (file may have changed)
  const agent = discoverResult.agents.find((a) => a.name === agentFilter);
  if (!agent) {
    console.error(
      `ERROR: Agent '${agentFilter}' not found in agent files after kill.`,
    );
    process.exit(1);
  }

  // Step 3: Build launch args
  const spawn = buildSpawnArgs(agent, teamName!, projectRoot);
  for (const w of spawn.warnings) {
    console.warn(`WARN: ${w}`);
  }
  console.log(`Relaunching agent '${agent.name}'...`);
  console.log(
    `\nNote: Direct spawning not yet implemented. Use --dry-run to see the command, or spawn from the orchestrator session.`,
  );
  process.exit(0);
}

if (subcommand === "list") {
  const agents = listAgents(
    teamName!,
    discoverResult.agents.map((a) => a.name),
  );

  const COL1 = 30;
  const COL2 = 8;
  const COL3 = 8;
  const header = [
    "Agent".padEnd(COL1),
    "File".padEnd(COL2),
    "Config".padEnd(COL3),
    "Status",
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const a of agents) {
    const row = [
      a.name.padEnd(COL1),
      (a.inFile ? "yes" : "no").padEnd(COL2),
      (a.inConfig ? "yes" : "no").padEnd(COL3),
      a.status,
    ].join("  ");
    console.log(row);
  }
  process.exit(0);
}

// Default: discover mode
console.log(
  `\nFound ${discoverResult.agents.length} agent(s) in ${projectRoot}/.claude/agents/\n`,
);

const COL1 = 24;
const COL2 = 10;
const COL3 = 10;
const COL4 = 12;

const header = [
  "Name".padEnd(COL1),
  "Model".padEnd(COL2),
  "Mode".padEnd(COL3),
  "Permission".padEnd(COL4),
  "Prompt",
].join("  ");

console.log(header);
console.log("-".repeat(header.length));

for (const agent of discoverResult.agents) {
  if (agentFilter && agent.name !== agentFilter) continue;

  const row = [
    agent.name.padEnd(COL1),
    (agent.model ?? "default").padEnd(COL2),
    agent.promptMode.padEnd(COL3),
    agent.permissionMode.padEnd(COL4),
    `${agent.markdownBody.length} chars`,
  ].join("  ");
  console.log(row);

  if (showPrompt) {
    const assembled = assemblePrompt(agent, projectRoot);
    for (const w of assembled.warnings) {
      console.warn(`  WARN: ${w}`);
    }
    if (assembled.flags.systemPrompt) {
      console.log(
        `  --system-prompt: ${assembled.flags.systemPrompt.length} chars`,
      );
    }
    if (assembled.flags.appendSystemPrompt) {
      console.log(
        `  --append-system-prompt: ${assembled.flags.appendSystemPrompt.length} chars`,
      );
    }
  }

  if (dryRun) {
    if (!teamName) {
      console.error(
        "\nERROR: Team name required for --dry-run. Use --team-name or set AGENT_TEAM_NAME.",
      );
      process.exit(1);
    }
    const spawn = buildSpawnArgs(agent, teamName, projectRoot);
    for (const w of spawn.warnings) {
      console.warn(`  WARN: ${w}`);
    }
    const cmd = ["claude", ...spawn.args]
      .map((a) => (a.includes(" ") || a.includes("\n") || a.includes('"') ? `'${a.replace(/'/g, "'\\''")}'` : a))
      .join(" \\\n    ");
    console.log(`  Command:\n    ${cmd}`);
    console.log(
      `  Env: ${Object.entries(spawn.env)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`,
    );
  }
}
