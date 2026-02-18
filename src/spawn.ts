/**
 * Agent spawning module.
 * Implements the spawn flow from docs/specs/draft/agent-launcher.md §5.
 *
 * Builds CLI arguments from an AgentDefinition and spawns the claude process.
 */

import { assemblePrompt } from "./prompt";
import type { AgentDefinition } from "./types";

/** Full set of CLI arguments for spawning a claude agent. */
export interface SpawnArgs {
  /** The resolved argument array for the claude binary. */
  args: string[];
  /** Environment variables to set. */
  env: Record<string, string>;
  /** Warnings generated during argument building. */
  warnings: string[];
}

/**
 * Build the claude CLI argument array for spawning an agent.
 *
 * Does NOT actually spawn — returns the args for the caller to execute.
 * This separation makes testing and dry-run mode straightforward.
 */
export function buildSpawnArgs(
  agent: AgentDefinition,
  teamName: string,
  projectRoot: string,
): SpawnArgs {
  const args: string[] = [];
  const warnings: string[] = [];

  // Prompt assembly (spec §4)
  const prompt = assemblePrompt(agent, projectRoot);
  warnings.push(...prompt.warnings);

  if (prompt.flags.systemPrompt) {
    args.push("--system-prompt", prompt.flags.systemPrompt);
  }
  if (prompt.flags.appendSystemPrompt) {
    args.push("--append-system-prompt", prompt.flags.appendSystemPrompt);
  }

  // Model override
  if (agent.model) {
    args.push("--model", agent.model);
  }

  // Permission mode
  args.push("--permission-mode", agent.permissionMode);

  // Dangerous skip permissions
  if (agent.dangerouslySkipPermissions) {
    args.push("--dangerously-skip-permissions");
  }

  // Teammate mode override
  if (agent.teammateMode) {
    args.push("--teammate-mode", agent.teammateMode);
  }

  // Continue session
  if (agent.continueSession) {
    args.push("--continue");
  }

  // Tool whitelist (spec §7)
  if (agent.tools && agent.tools.length > 0) {
    args.push("--tools", agent.tools.join(","));
  }

  // Tool blacklist (spec §7)
  if (agent.disallowedTools && agent.disallowedTools.length > 0) {
    for (const tool of agent.disallowedTools) {
      args.push("--disallowedTools", tool);
    }
  }

  // Environment variables (spec §5)
  const env: Record<string, string> = {
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
  };

  return { args, env, warnings };
}

/**
 * Spawn a claude agent as a subprocess.
 *
 * Returns the Bun subprocess. The caller is responsible for lifecycle management.
 */
export function spawnAgent(
  agent: AgentDefinition,
  teamName: string,
  projectRoot: string,
): { proc: ReturnType<typeof Bun.spawn>; warnings: string[] } {
  const { args, env, warnings } = buildSpawnArgs(agent, teamName, projectRoot);

  const proc = Bun.spawn(["claude", ...args], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: ["inherit", "inherit", "inherit"],
  });

  return { proc, warnings };
}
