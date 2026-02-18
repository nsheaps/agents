/**
 * Unit tests for src/prompt.ts
 */

import { describe, expect, test } from "bun:test";
import { join } from "path";
import { assemblePrompt } from "../prompt";
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

describe("assemblePrompt", () => {
  test("extend mode with _builtin base uses appendSystemPrompt only", () => {
    const agent = makeAgent({
      promptMode: "extend",
      basePrompt: "_builtin",
      markdownBody: "Test prompt body",
    });

    const result = assemblePrompt(agent, PROJECT_ROOT);

    expect(result.flags.appendSystemPrompt).toBe("Test prompt body");
    expect(result.flags.systemPrompt).toBeUndefined();
    expect(result.warnings).toHaveLength(0);
  });

  test("extend mode with custom base sets both systemPrompt and appendSystemPrompt", () => {
    const agent = makeAgent({
      promptMode: "extend",
      basePrompt: "src/__tests__/fixtures/base-prompt.txt",
      markdownBody: "Agent extension body",
    });

    const result = assemblePrompt(agent, PROJECT_ROOT);

    expect(result.flags.systemPrompt).toContain("You are a base prompt for testing.");
    expect(result.flags.appendSystemPrompt).toBe("Agent extension body");
    expect(result.warnings).toHaveLength(0);
  });

  test("replace mode with _builtin base sets systemPrompt to body", () => {
    const agent = makeAgent({
      promptMode: "replace",
      basePrompt: "_builtin",
      markdownBody: "Full replacement prompt",
    });

    const result = assemblePrompt(agent, PROJECT_ROOT);

    expect(result.flags.systemPrompt).toBe("Full replacement prompt");
    expect(result.flags.appendSystemPrompt).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("REPLACE mode");
  });

  test("replace mode with custom base combines base and body", () => {
    const agent = makeAgent({
      promptMode: "replace",
      basePrompt: "src/__tests__/fixtures/base-prompt.txt",
      markdownBody: "Agent replacement body",
    });

    const result = assemblePrompt(agent, PROJECT_ROOT);

    expect(result.flags.systemPrompt).toContain("You are a base prompt for testing.");
    expect(result.flags.systemPrompt).toContain("Agent replacement body");
    expect(result.flags.appendSystemPrompt).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("REPLACE mode");
  });

  test("throws when custom base prompt file does not exist", () => {
    const agent = makeAgent({
      basePrompt: "nonexistent/base.txt",
    });

    expect(() => assemblePrompt(agent, PROJECT_ROOT)).toThrow(
      "Base prompt file not found",
    );
  });

  test("warns when assembled prompt exceeds 200KB", () => {
    const largeBody = "x".repeat(201 * 1024);
    const agent = makeAgent({ markdownBody: largeBody });

    const result = assemblePrompt(agent, PROJECT_ROOT);

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes("200KB threshold"))).toBe(true);
  });
});
