/**
 * Unit tests for src/discover.ts
 */

import { describe, expect, test } from "bun:test";
import { join } from "path";
import { discoverAgents, resolveProjectRoot } from "../discover";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");
const PROJECT_ROOT = join(import.meta.dir, "../..");

describe("resolveProjectRoot", () => {
  test("returns override when provided", () => {
    const result = resolveProjectRoot("/some/path");
    expect(result).toBe("/some/path");
  });

  test("returns git root when no override (this repo)", () => {
    const result = resolveProjectRoot();
    expect(result).toBe(PROJECT_ROOT);
  });
});

describe("discoverAgents", () => {
  test("discovers agents from fixtures directory", async () => {
    // Create a temp directory structure that mimics .claude/agents/
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-test-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });

    // Copy valid fixtures
    cpSync(join(FIXTURES_DIR, "valid-agent.md"), join(agentsDir, "valid-agent.md"));
    cpSync(join(FIXTURES_DIR, "minimal-agent.md"), join(agentsDir, "minimal-agent.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.agents).toHaveLength(2);

    const names = result.agents.map((a) => a.name).sort();
    expect(names).toEqual(["minimal", "test-agent"]);
  });

  test("returns error when agents directory does not exist", async () => {
    const { mkdtempSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-nodir-"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("No agents directory found");
  });

  test("warns when agents directory is empty", async () => {
    const { mkdtempSync, mkdirSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-empty-"));
    mkdirSync(join(tmpDir, ".claude", "agents"), { recursive: true });

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("No agent files found");
  });

  test("warns on missing required field (name)", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-noname-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "missing-name.md"), join(agentsDir, "missing-name.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("Missing required field 'name'");
  });

  test("warns on missing required field (description)", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-nodesc-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "missing-description.md"), join(agentsDir, "missing-description.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("Missing required field 'description'");
  });

  test("warns on invalid enum value", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-badenum-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "bad-enum.md"), join(agentsDir, "bad-enum.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("Invalid prompt_mode");
  });

  test("warns on file with no frontmatter", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-nofm-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "no-frontmatter.md"), join(agentsDir, "no-frontmatter.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("Missing required field 'name'");
  });

  test("errors on duplicate agent names", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-dup-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "minimal-agent.md"), join(agentsDir, "a-minimal.md"));
    cpSync(join(FIXTURES_DIR, "minimal-agent.md"), join(agentsDir, "b-minimal.md"));

    const result = await discoverAgents(tmpDir);

    // First file parsed keeps the name, second gets an error
    expect(result.agents).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Duplicate agent name");
    expect(result.errors[0].message).toContain("conflicts with already-loaded");
  });

  test("applies correct defaults for minimal agent", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-defaults-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "minimal-agent.md"), join(agentsDir, "minimal-agent.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0];

    expect(agent.name).toBe("minimal");
    expect(agent.description).toBe("Minimal agent with only required fields");
    expect(agent.promptMode).toBe("extend");
    expect(agent.basePrompt).toBe("_builtin");
    expect(agent.framework).toBe("claude-code");
    expect(agent.model).toBeNull();
    expect(agent.permissionMode).toBe("delegate");
    expect(agent.dangerouslySkipPermissions).toBe(false);
    expect(agent.displayName).toBe("minimal");
    expect(agent.teammateMode).toBeNull();
    expect(agent.continueSession).toBe(false);
    expect(agent.color).toBeNull();
    expect(agent.tools).toBeNull();
    expect(agent.disallowedTools).toBeNull();
    expect(agent.markdownBody).toBe("Minimal prompt body.");
  });

  test("parses all optional fields correctly", async () => {
    const { mkdtempSync, mkdirSync, cpSync } = await import("fs");
    const { tmpdir } = await import("os");
    const tmpDir = mkdtempSync(join(tmpdir(), "discover-allopt-"));
    const agentsDir = join(tmpDir, ".claude", "agents");
    mkdirSync(agentsDir, { recursive: true });
    cpSync(join(FIXTURES_DIR, "all-options.md"), join(agentsDir, "all-options.md"));

    const result = await discoverAgents(tmpDir);

    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0];

    expect(agent.name).toBe("all-options");
    expect(agent.color).toBe("red");
    expect(agent.promptMode).toBe("extend");
    expect(agent.basePrompt).toBe("_builtin");
    expect(agent.framework).toBe("claude-code");
    expect(agent.model).toBe("claude-opus-4-6");
    expect(agent.permissionMode).toBe("bypassPermissions");
    expect(agent.dangerouslySkipPermissions).toBe(true);
    expect(agent.displayName).toBe("All O (test)");
    expect(agent.teammateMode).toBe("tmux");
    expect(agent.continueSession).toBe(true);
    expect(agent.tools).toEqual(["Read", "Edit", "Grep"]);
    expect(agent.disallowedTools).toEqual(["WebSearch"]);
  });

  test("discovers agents from real project agents directory", async () => {
    const result = await discoverAgents(PROJECT_ROOT);

    expect(result.errors).toHaveLength(0);
    expect(result.agents.length).toBeGreaterThanOrEqual(1);

    // All agents should have required fields
    for (const agent of result.agents) {
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.markdownBody.length).toBeGreaterThan(0);
    }
  });
});
