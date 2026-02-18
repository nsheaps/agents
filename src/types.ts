/**
 * Agent launcher type definitions.
 * Matches the YAML frontmatter schema in docs/specs/draft/agent-launcher.md §3.
 */

/** Prompt modes for how the agent's markdown body combines with the base prompt. */
export type PromptMode = "extend" | "replace";

/** Supported agent frameworks. Only claude-code in Phase 1. */
export type Framework = "claude-code";

/** Claude Code permission modes. */
export type PermissionMode =
  | "default"
  | "delegate"
  | "plan"
  | "bypassPermissions";

/** Claude Code teammate display modes. */
export type TeammateMode = "auto" | "in-process" | "tmux";

/** Raw YAML frontmatter fields as parsed from the agent file. */
export interface AgentFrontmatter {
  // Required (Claude Code native)
  name: string;
  description: string;

  // Optional (Claude Code native)
  color?: string;

  // Optional (launcher-specific, with defaults applied later)
  prompt_mode?: PromptMode;
  base_prompt?: string;
  framework?: Framework;
  model?: string;
  permission_mode?: PermissionMode;
  dangerously_skip_permissions?: boolean;
  display_name?: string;
  teammate_mode?: TeammateMode;
  continue_session?: boolean;
  tools?: string[];
  disallowed_tools?: string[];
}

/** Fully resolved agent definition with defaults applied. */
export interface AgentDefinition {
  /** Source filename (e.g., "software-eng.md") */
  filename: string;

  // --- Required fields ---
  name: string;
  description: string;

  // --- Resolved fields (defaults applied) ---
  promptMode: PromptMode;
  basePrompt: string;
  framework: Framework;
  model: string | null;
  permissionMode: PermissionMode;
  dangerouslySkipPermissions: boolean;
  displayName: string;
  teammateMode: TeammateMode | null;
  continueSession: boolean;
  color: string | null;
  tools: string[] | null;
  disallowedTools: string[] | null;

  /** The full markdown body after the frontmatter (the agent's prompt content). */
  markdownBody: string;
}

/** CLI flags produced by prompt assembly (spec §4). */
export interface CLIFlags {
  systemPrompt?: string;
  appendSystemPrompt?: string;
}

/** Validation error for a single agent file. */
export interface AgentValidationError {
  filename: string;
  message: string;
}

/** Result of discovering agents from the filesystem. */
export interface DiscoveryResult {
  agents: AgentDefinition[];
  warnings: AgentValidationError[];
  errors: AgentValidationError[];
}
