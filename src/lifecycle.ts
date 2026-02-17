/**
 * Agent lifecycle management module.
 * Implements kill, health, cleanup, list, and relaunch from spec §6.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/** A member entry in the Claude Code team config. */
export interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
}

/** Team config structure as managed by Claude Code. */
export interface TeamConfig {
  members: TeamMember[];
}

/** Agent health status. */
export type AgentStatus = "RUNNING" | "DEAD" | "UNKNOWN" | "NOT_SPAWNED";

/** Health check result for a single agent. */
export interface AgentHealth {
  name: string;
  status: AgentStatus;
  agentId?: string;
  detail?: string;
}

/**
 * Get the path to the team config file.
 */
export function teamConfigPath(teamName: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
  return join(home, ".claude", "teams", teamName, "config.json");
}

/**
 * Read the team config, returning null if not found.
 */
export function readTeamConfig(teamName: string): TeamConfig | null {
  const configPath = teamConfigPath(teamName);
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as TeamConfig;
  } catch {
    return null;
  }
}

/**
 * Write the team config back to disk.
 */
export function writeTeamConfig(
  teamName: string,
  config: TeamConfig,
): void {
  const configPath = teamConfigPath(teamName);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Find a member in the team config by name.
 */
export function findMember(
  config: TeamConfig,
  agentName: string,
): TeamMember | undefined {
  return config.members.find((m) => m.name === agentName);
}

/**
 * Remove a member from team config by name.
 * Returns true if the member was found and removed.
 */
export function removeMember(
  teamName: string,
  agentName: string,
): boolean {
  const config = readTeamConfig(teamName);
  if (!config) return false;

  const before = config.members.length;
  config.members = config.members.filter((m) => m.name !== agentName);

  if (config.members.length === before) return false;

  writeTeamConfig(teamName, config);
  return true;
}

/**
 * Check if a tmux pane exists and is alive.
 * Returns true if the pane is running.
 */
export function isTmuxPaneAlive(paneId: string): boolean {
  try {
    const result = Bun.spawnSync([
      "tmux",
      "list-panes",
      "-a",
      "-F",
      "#{pane_id}",
    ]);
    const panes = result.stdout.toString().trim().split("\n");
    return panes.includes(paneId);
  } catch {
    return false;
  }
}

/**
 * Force kill a tmux pane.
 */
export function killTmuxPane(paneId: string): boolean {
  try {
    const result = Bun.spawnSync(["tmux", "kill-pane", "-t", paneId]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Kill an agent: remove from config and optionally kill tmux pane.
 *
 * Flow (spec §6.1):
 * 1. Find agent in team config
 * 2. Force kill tmux pane (if applicable)
 * 3. Remove agent entry from config
 */
export function killAgent(
  teamName: string,
  agentName: string,
): { success: boolean; message: string } {
  const config = readTeamConfig(teamName);
  if (!config) {
    return {
      success: false,
      message: `Team config not found for '${teamName}'`,
    };
  }

  const member = findMember(config, agentName);
  if (!member) {
    return {
      success: false,
      message: `Agent '${agentName}' not found in team config`,
    };
  }

  // Remove from config
  const removed = removeMember(teamName, agentName);
  if (!removed) {
    return {
      success: false,
      message: `Failed to remove '${agentName}' from team config`,
    };
  }

  return {
    success: true,
    message: `Killed agent '${agentName}' and removed from team config`,
  };
}

/**
 * Auto-cleanup: remove stale entries from team config (spec §6.3).
 *
 * Note: Without tmux pane tracking (not yet in the config schema),
 * this currently only identifies entries that could be stale.
 * Full implementation requires tmux pane ID tracking in team config.
 */
export function cleanupStaleEntries(
  teamName: string,
): { removed: string[]; message: string } {
  const config = readTeamConfig(teamName);
  if (!config) {
    return { removed: [], message: `Team config not found for '${teamName}'` };
  }

  // For now, report what's in the config
  // Full cleanup requires tmux pane tracking (not yet in Claude Code's schema)
  return {
    removed: [],
    message: `${config.members.length} member(s) in config. Auto-cleanup requires tmux pane tracking (future).`,
  };
}

/**
 * List all agents with their config and file status (spec §6.4).
 */
export function listAgents(
  teamName: string,
  discoveredNames: string[],
): Array<{ name: string; inFile: boolean; inConfig: boolean; status: AgentStatus }> {
  const config = readTeamConfig(teamName);
  const configNames = new Set(config?.members.map((m) => m.name) ?? []);
  const allNames = new Set([...discoveredNames, ...configNames]);

  return Array.from(allNames)
    .sort()
    .map((name) => {
      const inFile = discoveredNames.includes(name);
      const inConfig = configNames.has(name);
      let status: AgentStatus;
      if (!inConfig) {
        status = "NOT_SPAWNED";
      } else {
        // Without tmux tracking, assume UNKNOWN for config entries
        status = "UNKNOWN";
      }
      return { name, inFile, inConfig, status };
    });
}
