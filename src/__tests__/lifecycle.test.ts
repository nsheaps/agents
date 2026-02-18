/**
 * Unit tests for src/lifecycle.ts
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import {
  readTeamConfig,
  writeTeamConfig,
  findMember,
  removeMember,
  killAgent,
  listAgents,
  cleanupStaleEntries,
} from "../lifecycle";
import type { TeamConfig } from "../lifecycle";

/**
 * These tests override the team config path by patching HOME env var
 * to a temp directory, so they don't touch real user config.
 */

let tmpHome: string;
let origHome: string | undefined;

function setupTmpHome(teamName: string, config?: TeamConfig): void {
  tmpHome = mkdtempSync(join(tmpdir(), "lifecycle-test-"));
  origHome = process.env.HOME;
  process.env.HOME = tmpHome;

  if (config) {
    const teamDir = join(tmpHome, ".claude", "teams", teamName);
    mkdirSync(teamDir, { recursive: true });
    writeFileSync(
      join(teamDir, "config.json"),
      JSON.stringify(config, null, 2),
    );
  }
}

function teardownTmpHome(): void {
  if (origHome !== undefined) {
    process.env.HOME = origHome;
  }
}

const TEAM_NAME = "test-team";

const SAMPLE_CONFIG: TeamConfig = {
  members: [
    { name: "Bugs B (software-eng)", agentId: "agent-1234", agentType: "general-purpose" },
    { name: "Daffy D (qa)", agentId: "agent-5678", agentType: "general-purpose" },
    { name: "Wile E (ai-agent-eng)", agentId: "agent-9012", agentType: "general-purpose" },
  ],
};

describe("readTeamConfig", () => {
  afterEach(teardownTmpHome);

  test("returns config when file exists", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);
    const config = readTeamConfig(TEAM_NAME);

    expect(config).not.toBeNull();
    expect(config!.members).toHaveLength(3);
    expect(config!.members[0].name).toBe("Bugs B (software-eng)");
  });

  test("returns null when config does not exist", () => {
    setupTmpHome(TEAM_NAME);
    const config = readTeamConfig(TEAM_NAME);

    expect(config).toBeNull();
  });

  test("returns null when config is invalid JSON", () => {
    setupTmpHome(TEAM_NAME);
    const teamDir = join(tmpHome, ".claude", "teams", TEAM_NAME);
    mkdirSync(teamDir, { recursive: true });
    writeFileSync(join(teamDir, "config.json"), "not json{{{");

    const config = readTeamConfig(TEAM_NAME);
    expect(config).toBeNull();
  });
});

describe("writeTeamConfig", () => {
  afterEach(teardownTmpHome);

  test("writes config that can be read back", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const modified: TeamConfig = {
      members: [{ name: "New Agent", agentId: "new-id", agentType: "test" }],
    };
    writeTeamConfig(TEAM_NAME, modified);

    const readBack = readTeamConfig(TEAM_NAME);
    expect(readBack).not.toBeNull();
    expect(readBack!.members).toHaveLength(1);
    expect(readBack!.members[0].name).toBe("New Agent");
  });
});

describe("findMember", () => {
  test("finds member by name", () => {
    const member = findMember(SAMPLE_CONFIG, "Daffy D (qa)");

    expect(member).toBeDefined();
    expect(member!.agentId).toBe("agent-5678");
  });

  test("returns undefined for non-existent name", () => {
    const member = findMember(SAMPLE_CONFIG, "Elmer F (pm)");

    expect(member).toBeUndefined();
  });
});

describe("removeMember", () => {
  afterEach(teardownTmpHome);

  test("removes existing member and writes config", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const result = removeMember(TEAM_NAME, "Daffy D (qa)");

    expect(result).toBe(true);

    const config = readTeamConfig(TEAM_NAME);
    expect(config!.members).toHaveLength(2);
    expect(config!.members.find((m) => m.name === "Daffy D (qa)")).toBeUndefined();
  });

  test("returns false for non-existent member", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const result = removeMember(TEAM_NAME, "Nobody");
    expect(result).toBe(false);
  });

  test("returns false when config does not exist", () => {
    setupTmpHome(TEAM_NAME);

    const result = removeMember(TEAM_NAME, "Bugs B (software-eng)");
    expect(result).toBe(false);
  });
});

describe("killAgent", () => {
  afterEach(teardownTmpHome);

  test("removes agent from config successfully (no pane ID)", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const result = killAgent(TEAM_NAME, "Bugs B (software-eng)");

    expect(result.success).toBe(true);
    expect(result.message).toContain("Killed agent");
    expect(result.message).toContain("no tmux pane ID tracked");

    const config = readTeamConfig(TEAM_NAME);
    expect(config!.members).toHaveLength(2);
  });

  test("attempts tmux pane kill when pane ID is present", () => {
    const configWithPane: TeamConfig = {
      members: [
        { name: "Agent A", agentId: "a-1", agentType: "test", tmuxPaneId: "%999" },
      ],
    };
    setupTmpHome(TEAM_NAME, configWithPane);

    const result = killAgent(TEAM_NAME, "Agent A");

    expect(result.success).toBe(true);
    expect(result.message).toContain("Killed agent");
    // Pane %999 doesn't exist, so kill will fail gracefully
    expect(result.message).toContain("tmux pane kill failed");
  });

  test("fails when team config does not exist", () => {
    setupTmpHome(TEAM_NAME);

    const result = killAgent(TEAM_NAME, "Bugs B (software-eng)");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Team config not found");
  });

  test("fails when agent not in config", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const result = killAgent(TEAM_NAME, "Nobody");

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found in team config");
  });
});

describe("listAgents", () => {
  afterEach(teardownTmpHome);

  test("correlates file agents with config via agentName field", () => {
    const configWithAgentNames: TeamConfig = {
      members: [
        { name: "Bugs B (software-eng)", agentId: "a-1", agentType: "test", agentName: "software-eng" },
        { name: "Daffy D (qa)", agentId: "a-2", agentType: "test", agentName: "quality-assurance" },
      ],
    };
    setupTmpHome(TEAM_NAME, configWithAgentNames);

    const discoveredNames = ["software-eng", "quality-assurance", "ops-eng"];
    const result = listAgents(TEAM_NAME, discoveredNames);

    // software-eng should be correlated with its config entry
    const seEntry = result.find((r) => r.name === "software-eng");
    expect(seEntry).toBeDefined();
    expect(seEntry!.inFile).toBe(true);
    expect(seEntry!.inConfig).toBe(true);
    expect(seEntry!.configName).toBe("Bugs B (software-eng)");

    // ops-eng has no config entry
    const opsEntry = result.find((r) => r.name === "ops-eng");
    expect(opsEntry).toBeDefined();
    expect(opsEntry!.inFile).toBe(true);
    expect(opsEntry!.inConfig).toBe(false);
    expect(opsEntry!.status).toBe("NOT_SPAWNED");
  });

  test("falls back to direct name match when agentName not set", () => {
    // Config without agentName field — old-style entries
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const discoveredNames = ["software-eng", "ops-eng"];
    const result = listAgents(TEAM_NAME, discoveredNames);

    // File agents can't match display names, so they appear as NOT_SPAWNED
    const seEntry = result.find((r) => r.name === "software-eng");
    expect(seEntry!.inConfig).toBe(false);
    expect(seEntry!.status).toBe("NOT_SPAWNED");

    // Config-only entries appear separately
    const bugsEntry = result.find((r) => r.name === "Bugs B (software-eng)");
    expect(bugsEntry).toBeDefined();
    expect(bugsEntry!.inFile).toBe(false);
    expect(bugsEntry!.inConfig).toBe(true);
    expect(bugsEntry!.status).toBe("UNKNOWN");
  });

  test("handles no config gracefully", () => {
    setupTmpHome(TEAM_NAME);

    const discoveredNames = ["software-eng"];
    const result = listAgents(TEAM_NAME, discoveredNames);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("software-eng");
    expect(result[0].status).toBe("NOT_SPAWNED");
  });

  test("shows DEAD status for config entries with dead tmux panes", () => {
    const configWithPanes: TeamConfig = {
      members: [
        { name: "Dead Agent", agentId: "a-1", agentType: "test", agentName: "dead-agent", tmuxPaneId: "%9999" },
      ],
    };
    setupTmpHome(TEAM_NAME, configWithPanes);

    const result = listAgents(TEAM_NAME, ["dead-agent"]);

    const entry = result.find((r) => r.name === "dead-agent");
    expect(entry!.inConfig).toBe(true);
    expect(entry!.status).toBe("DEAD");
  });
});

describe("cleanupStaleEntries", () => {
  afterEach(teardownTmpHome);

  test("skips members without pane IDs", () => {
    setupTmpHome(TEAM_NAME, SAMPLE_CONFIG);

    const result = cleanupStaleEntries(TEAM_NAME);

    expect(result.removed).toHaveLength(0);
    expect(result.message).toContain("0 stale entry(s) removed");
    expect(result.message).toContain("without pane tracking skipped");
  });

  test("removes members with dead pane IDs", () => {
    const configWithPanes: TeamConfig = {
      members: [
        { name: "Alive", agentId: "a-1", agentType: "test" },
        { name: "Dead", agentId: "a-2", agentType: "test", tmuxPaneId: "%9999" },
      ],
    };
    setupTmpHome(TEAM_NAME, configWithPanes);

    const result = cleanupStaleEntries(TEAM_NAME);

    // %9999 doesn't exist, so it's "dead"
    expect(result.removed).toContain("Dead");
    expect(result.removed).toHaveLength(1);

    const config = readTeamConfig(TEAM_NAME);
    expect(config!.members).toHaveLength(1);
    expect(config!.members[0].name).toBe("Alive");
  });

  test("handles missing config", () => {
    setupTmpHome(TEAM_NAME);

    const result = cleanupStaleEntries(TEAM_NAME);

    expect(result.removed).toHaveLength(0);
    expect(result.message).toContain("Team config not found");
  });
});
