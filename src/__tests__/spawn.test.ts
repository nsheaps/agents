/**
 * Unit tests for src/spawn.ts
 */

import { describe, expect, test } from "bun:test";
import { join } from "path";
import { buildSpawnArgs } from "../spawn";
import type { AgentDefinition } from "../types";

const PROJECT_ROOT = join(import.meta.dir, "../..");

/** Helper to create a minimal AgentDefinition for testing. */
function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    filename: "test.md",
    name: "test",
    description: "Test agent",
    promptMode: "extend",
    basePrompt: "_builtin",
    framework: "claude-code",
    model: null,
    permissionMode: "delegate",
    dangerouslySkipPermissions: false,
    displayName: "test",
    teammateMode: null,
    continueSession: false,
    color: null,
    tools: null,
    disallowedTools: null,
    markdownBody: "You are a test agent.",
    ...overrides,
  };
}

describe("buildSpawnArgs", () => {
  test("minimal agent produces correct base args", () => {
    const agent = makeAgent();
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).toContain("--append-system-prompt");
    expect(result.args).toContain("--permission-mode");
    expect(result.args).toContain("delegate");
    expect(result.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe("1");
    expect(result.warnings).toHaveLength(0);
  });

  test("includes model flag when model is set", () => {
    const agent = makeAgent({ model: "claude-sonnet-4-6" });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    const modelIdx = result.args.indexOf("--model");
    expect(modelIdx).toBeGreaterThanOrEqual(0);
    expect(result.args[modelIdx + 1]).toBe("claude-sonnet-4-6");
  });

  test("does not include model flag when model is null", () => {
    const agent = makeAgent({ model: null });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).not.toContain("--model");
  });

  test("includes --dangerously-skip-permissions when true", () => {
    const agent = makeAgent({ dangerouslySkipPermissions: true });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).toContain("--dangerously-skip-permissions");
  });

  test("does not include --dangerously-skip-permissions when false", () => {
    const agent = makeAgent({ dangerouslySkipPermissions: false });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).not.toContain("--dangerously-skip-permissions");
  });

  test("includes --teammate-mode when set", () => {
    const agent = makeAgent({ teammateMode: "tmux" });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    const idx = result.args.indexOf("--teammate-mode");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(result.args[idx + 1]).toBe("tmux");
  });

  test("does not include --teammate-mode when null", () => {
    const agent = makeAgent({ teammateMode: null });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).not.toContain("--teammate-mode");
  });

  test("includes --continue when continueSession is true", () => {
    const agent = makeAgent({ continueSession: true });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).toContain("--continue");
  });

  test("does not include --continue when continueSession is false", () => {
    const agent = makeAgent({ continueSession: false });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).not.toContain("--continue");
  });

  test("includes --tools comma-joined when tools are set", () => {
    const agent = makeAgent({ tools: ["Read", "Edit", "Write"] });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    const idx = result.args.indexOf("--tools");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(result.args[idx + 1]).toBe("Read,Edit,Write");
  });

  test("does not include --tools when tools is null", () => {
    const agent = makeAgent({ tools: null });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).not.toContain("--tools");
  });

  test("includes repeated --disallowedTools for each tool", () => {
    const agent = makeAgent({ disallowedTools: ["Bash", "WebSearch"] });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    const indices = result.args.reduce<number[]>((acc, arg, i) => {
      if (arg === "--disallowedTools") acc.push(i);
      return acc;
    }, []);

    expect(indices).toHaveLength(2);
    expect(result.args[indices[0] + 1]).toBe("Bash");
    expect(result.args[indices[1] + 1]).toBe("WebSearch");
  });

  test("does not include --disallowedTools when null", () => {
    const agent = makeAgent({ disallowedTools: null });
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).not.toContain("--disallowedTools");
  });

  test("all-options agent produces correct comprehensive args", () => {
    const agent = makeAgent({
      model: "claude-opus-4-6",
      permissionMode: "bypassPermissions",
      dangerouslySkipPermissions: true,
      teammateMode: "tmux",
      continueSession: true,
      tools: ["Read", "Edit"],
      disallowedTools: ["WebSearch"],
      markdownBody: "Full options test",
    });

    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.args).toContain("--model");
    expect(result.args).toContain("--dangerously-skip-permissions");
    expect(result.args).toContain("--teammate-mode");
    expect(result.args).toContain("--continue");
    expect(result.args).toContain("--tools");
    expect(result.args).toContain("--disallowedTools");
    expect(result.args).toContain("--permission-mode");
  });

  test("sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var", () => {
    const agent = makeAgent();
    const result = buildSpawnArgs(agent, "test-team", PROJECT_ROOT);

    expect(result.env).toHaveProperty("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1");
  });
});
