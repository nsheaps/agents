/**
 * Agent file discovery and YAML frontmatter parsing.
 * Implements the discovery algorithm from docs/specs/draft/agent-launcher.md §2.
 */

import { Glob } from "bun";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import matter from "gray-matter";
import type {
  AgentDefinition,
  AgentFrontmatter,
  AgentValidationError,
  DiscoveryResult,
  Framework,
  PermissionMode,
  PromptMode,
  TeammateMode,
} from "./types";

const AGENTS_DIRNAME = ".claude/agents";
const REQUIRED_FIELDS = ["name", "description"] as const;

const VALID_PROMPT_MODES: PromptMode[] = ["extend", "replace"];
const VALID_FRAMEWORKS: Framework[] = ["claude-code"];
const VALID_PERMISSION_MODES: PermissionMode[] = [
  "default",
  "delegate",
  "plan",
  "bypassPermissions",
];
const VALID_TEAMMATE_MODES: TeammateMode[] = ["auto", "in-process", "tmux"];

/**
 * Resolve the project root directory.
 * Uses git root if available, otherwise falls back to cwd.
 */
export function resolveProjectRoot(override?: string): string {
  if (override) return override;

  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
    const root = result.stdout.toString().trim();
    if (root) return root;
  } catch {
    // Not a git repo, fall through
  }

  return process.cwd();
}

/**
 * Parse a single agent markdown file into an AgentDefinition.
 * Returns the definition or null (with warnings/errors populated).
 */
function parseAgentFile(
  filePath: string,
  filename: string,
  warnings: AgentValidationError[],
): AgentDefinition | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    warnings.push({ filename, message: `Could not read file` });
    return null;
  }

  // Parse frontmatter with gray-matter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : "unknown error";
    warnings.push({ filename, message: `Invalid frontmatter: ${msg}` });
    return null;
  }

  const fm = parsed.data as Partial<AgentFrontmatter>;

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!fm[field] || (typeof fm[field] === "string" && !fm[field].trim())) {
      warnings.push({ filename, message: `Missing required field '${field}'` });
      return null;
    }
  }

  // Validate optional enum fields
  if (fm.prompt_mode && !VALID_PROMPT_MODES.includes(fm.prompt_mode)) {
    warnings.push({
      filename,
      message: `Invalid prompt_mode '${fm.prompt_mode}'. Must be: ${VALID_PROMPT_MODES.join(", ")}`,
    });
    return null;
  }

  if (fm.framework && !VALID_FRAMEWORKS.includes(fm.framework)) {
    warnings.push({
      filename,
      message: `Invalid framework '${fm.framework}'. Must be: ${VALID_FRAMEWORKS.join(", ")}`,
    });
    return null;
  }

  if (
    fm.permission_mode &&
    !VALID_PERMISSION_MODES.includes(fm.permission_mode)
  ) {
    warnings.push({
      filename,
      message: `Invalid permission_mode '${fm.permission_mode}'. Must be: ${VALID_PERMISSION_MODES.join(", ")}`,
    });
    return null;
  }

  if (fm.teammate_mode && !VALID_TEAMMATE_MODES.includes(fm.teammate_mode)) {
    warnings.push({
      filename,
      message: `Invalid teammate_mode '${fm.teammate_mode}'. Must be: ${VALID_TEAMMATE_MODES.join(", ")}`,
    });
    return null;
  }

  const body = parsed.content.trim();

  return {
    filename,
    name: fm.name!.trim(),
    description:
      typeof fm.description === "string" ? fm.description.trim() : "",
    promptMode: fm.prompt_mode ?? "extend",
    basePrompt: fm.base_prompt ?? "_builtin",
    framework: fm.framework ?? "claude-code",
    model: fm.model ?? null,
    permissionMode: fm.permission_mode ?? "delegate",
    dangerouslySkipPermissions: fm.dangerously_skip_permissions ?? false,
    displayName: fm.display_name ?? fm.name!.trim(),
    teammateMode: fm.teammate_mode ?? null,
    continueSession: fm.continue_session ?? false,
    color: fm.color ?? null,
    tools: Array.isArray(fm.tools) ? fm.tools : null,
    disallowedTools: Array.isArray(fm.disallowed_tools)
      ? fm.disallowed_tools
      : null,
    markdownBody: body,
  };
}

/**
 * Discover all agent definitions from .claude/agents/*.md files.
 * Implements the algorithm from spec §2.
 */
export async function discoverAgents(
  projectRoot: string,
): Promise<DiscoveryResult> {
  const agentsDir = join(projectRoot, AGENTS_DIRNAME);
  const warnings: AgentValidationError[] = [];
  const errors: AgentValidationError[] = [];

  // Check if agents directory exists
  if (!existsSync(agentsDir)) {
    errors.push({
      filename: AGENTS_DIRNAME,
      message: "No agents directory found",
    });
    return { agents: [], warnings, errors };
  }

  // Glob for .md files
  const glob = new Glob("*.md");
  const files: string[] = [];
  for await (const file of glob.scan(agentsDir)) {
    files.push(file);
  }

  if (files.length === 0) {
    warnings.push({
      filename: AGENTS_DIRNAME,
      message: "No agent files found",
    });
    return { agents: [], warnings, errors };
  }

  // Parse each file
  const agents: AgentDefinition[] = [];
  const nameToFile = new Map<string, string>();

  for (const file of files.sort()) {
    const filePath = join(agentsDir, file);
    const agent = parseAgentFile(filePath, file, warnings);
    if (!agent) continue;

    // Check for duplicate names
    const existing = nameToFile.get(agent.name);
    if (existing) {
      errors.push({
        filename: file,
        message: `Duplicate agent name '${agent.name}': '${file}' conflicts with already-loaded '${existing}' (keeping '${existing}')`,
      });
      continue;
    }

    nameToFile.set(agent.name, file);
    agents.push(agent);
  }

  return { agents, warnings, errors };
}
