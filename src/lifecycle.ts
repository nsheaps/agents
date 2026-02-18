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
  /** Tmux pane ID, set at spawn time. Used for kill/health/cleanup. */
  tmuxPaneId?: string;
  /** Agent file name (e.g. "software-eng"), set at spawn time. Used for file/config correlation. */
  agentName?: string;
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

  // Kill tmux pane if we have a pane ID (spec §6.1 step 2)
  let paneKilled = false;
  if (member.tmuxPaneId) {
    paneKilled = killTmuxPane(member.tmuxPaneId);
  }

  // Remove from config
  const removed = removeMember(teamName, agentName);
  if (!removed) {
    return {
      success: false,
      message: `Failed to remove '${agentName}' from team config`,
    };
  }

  const paneMsg = member.tmuxPaneId
    ? paneKilled
      ? ", tmux pane killed"
      : ", tmux pane kill failed (may already be dead)"
    : ", no tmux pane ID tracked";
  return {
    success: true,
    message: `Killed agent '${agentName}' and removed from team config${paneMsg}`,
  };
}

/**
 * Auto-cleanup: remove stale entries from team config (spec §6.3).
 *
 * Checks each member with a tmuxPaneId — if the pane is dead, removes
 * the member from config. Members without a pane ID are left untouched.
 */
export function cleanupStaleEntries(
  teamName: string,
): { removed: string[]; message: string } {
  const config = readTeamConfig(teamName);
  if (!config) {
    return { removed: [], message: `Team config not found for '${teamName}'` };
  }

  const removed: string[] = [];
  const kept: TeamMember[] = [];

  for (const member of config.members) {
    if (member.tmuxPaneId && !isTmuxPaneAlive(member.tmuxPaneId)) {
      removed.push(member.name);
    } else {
      kept.push(member);
    }
  }

  if (removed.length > 0) {
    config.members = kept;
    writeTeamConfig(teamName, config);
  }

  const trackedCount = config.members.filter((m) => m.tmuxPaneId).length + removed.length;
  const untrackedCount = config.members.filter((m) => !m.tmuxPaneId).length;
  const parts = [`${removed.length} stale entry(s) removed`];
  if (untrackedCount > 0) {
    parts.push(`${untrackedCount} member(s) without pane tracking skipped`);
  }

  return { removed, message: parts.join(". ") + "." };
}

/**
 * List all agents with their config and file status (spec §6.4).
 *
 * Correlates discovered agent file names with config entries using:
 * 1. The `agentName` field on the config member (set at spawn time)
 * 2. Falls back to direct name comparison if agentName is not set
 *
 * Returns one entry per unique agent, merging file and config info.
 */
export function listAgents(
  teamName: string,
  discoveredNames: string[],
): Array<{ name: string; inFile: boolean; inConfig: boolean; status: AgentStatus; configName?: string }> {
  const config = readTeamConfig(teamName);
  const members = config?.members ?? [];

  // Build a map from agent file name → config member (using agentName field)
  const agentNameToMember = new Map<string, TeamMember>();
  // Also track config members by their display name for fallback
  const displayNameToMember = new Map<string, TeamMember>();
  for (const member of members) {
    if (member.agentName) {
      agentNameToMember.set(member.agentName, member);
    }
    displayNameToMember.set(member.name, member);
  }

  // Track which config members have been matched to file-discovered agents
  const matchedConfigNames = new Set<string>();

  type AgentListEntry = { name: string; inFile: boolean; inConfig: boolean; status: AgentStatus; configName?: string };
  const results: AgentListEntry[] = [];

  // Process discovered agents first
  for (const agentName of discoveredNames) {
    // Try to find matching config member via agentName field, then direct name match
    const member = agentNameToMember.get(agentName) ?? displayNameToMember.get(agentName);
    const inConfig = !!member;

    let status: AgentStatus;
    if (!member) {
      status = "NOT_SPAWNED";
    } else if (member.tmuxPaneId) {
      status = isTmuxPaneAlive(member.tmuxPaneId) ? "RUNNING" : "DEAD";
    } else {
      status = "UNKNOWN";
    }

    if (member) {
      matchedConfigNames.add(member.name);
    }

    results.push({
      name: agentName,
      inFile: true,
      inConfig,
      status,
      configName: member?.name !== agentName ? member?.name : undefined,
    });
  }

  // Add unmatched config members (not correlated to any discovered agent)
  for (const member of members) {
    if (!matchedConfigNames.has(member.name)) {
      let status: AgentStatus;
      if (member.tmuxPaneId) {
        status = isTmuxPaneAlive(member.tmuxPaneId) ? "RUNNING" : "DEAD";
      } else {
        status = "UNKNOWN";
      }

      results.push({
        name: member.name,
        inFile: false,
        inConfig: true,
        status,
      });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
