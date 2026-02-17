/**
 * Prompt assembly module.
 * Implements the algorithm from docs/specs/draft/agent-launcher.md §4.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { AgentDefinition, CLIFlags } from "./types";

/** Threshold in bytes for prompt length warning (200KB per spec §4). */
const PROMPT_SIZE_WARN_BYTES = 200 * 1024;

export interface PromptAssemblyResult {
  flags: CLIFlags;
  warnings: string[];
}

/**
 * Assemble CLI prompt flags for an agent based on its prompt_mode and base_prompt.
 *
 * EXTEND mode (default): --append-system-prompt "<body>"
 * REPLACE mode (experimental): --system-prompt "<body>"
 *
 * When base_prompt is a file path (not "_builtin"), the file is read and used
 * as the base via --system-prompt, with --append-system-prompt for the body in EXTEND mode.
 */
export function assemblePrompt(
  agent: AgentDefinition,
  projectRoot: string,
): PromptAssemblyResult {
  const body = agent.markdownBody;
  const mode = agent.promptMode;
  const base = agent.basePrompt;
  const warnings: string[] = [];

  let flags: CLIFlags;

  if (mode === "extend") {
    if (base === "_builtin") {
      // Let Claude Code use its defaults, just append
      flags = { appendSystemPrompt: body };
    } else {
      // Custom base + agent body appended
      const baseContent = readBasePrompt(base, projectRoot);
      flags = {
        systemPrompt: baseContent,
        appendSystemPrompt: body,
      };
    }
  } else {
    // REPLACE mode
    warnings.push(
      `Agent '${agent.name}' uses REPLACE mode. This is experimental and unreliable in interactive mode (see GitHub #2692).`,
    );

    if (base === "_builtin") {
      // Agent body IS the full prompt
      flags = { systemPrompt: body };
    } else {
      // Custom base + agent body combined
      const baseContent = readBasePrompt(base, projectRoot);
      flags = { systemPrompt: `${baseContent}\n\n${body}` };
    }
  }

  // Check assembled prompt size
  const totalSize =
    (flags.systemPrompt?.length ?? 0) +
    (flags.appendSystemPrompt?.length ?? 0);
  if (totalSize > PROMPT_SIZE_WARN_BYTES) {
    warnings.push(
      `Assembled prompt for '${agent.name}' is ${Math.round(totalSize / 1024)}KB (exceeds 200KB threshold). May hit shell argument limits.`,
    );
  }

  return { flags, warnings };
}

/**
 * Read a base prompt file relative to the project root.
 * Throws if the file doesn't exist or can't be read.
 */
function readBasePrompt(filePath: string, projectRoot: string): string {
  const resolved = join(projectRoot, filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Base prompt file not found: ${resolved}`);
  }
  return readFileSync(resolved, "utf-8");
}
