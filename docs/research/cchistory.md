# cchistory: Claude Code System Prompt Extraction Tool

Research Date: 2026-02-23
Researcher: Road Runner (Deep Researcher)
Task: #134 / #133

## Question

What is cchistory, how does it work, what are its flags, what does the specific command `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 cchistory 2.1.50 --claude-args '--dangerously-skip-permissions'` do, and can it show a teammate's system prompt?

## Answer

**cchistory** is a tool by Mario Zechner ([@badlogic](https://github.com/badlogic)) that extracts system prompts, tool definitions, and user message augmentations from any published Claude Code version. It works by downloading the target version from npm, patching version checks, running it through `claude-trace` (an API request interceptor), and saving the extracted content to markdown files. It **cannot** extract teammate system prompts — it only captures the lead session's prompt.

---

## 1. What It Is and How It Works

### Identity

| Field | Value |
|-------|-------|
| Package | `@mariozechner/cchistory` |
| Version | 1.1.11 (installed) |
| Author | Mario Zechner (badlogic) |
| Repository | [github.com/badlogic/cchistory](https://github.com/badlogic/cchistory) |
| Web UI | [cchistory.mariozechner.at](https://cchistory.mariozechner.at/) (updates every 30 min) |
| Blog | [cchistory: Tracking Claude Code System Prompt and Tool Changes](https://mariozechner.at/posts/2025-08-03-cchistory/) |
| Companion tool | `@mariozechner/claude-trace` — API request interception |

**Note**: The npm package `cchistory` (v0.2.1 by stephaneckardt) is a **different, unrelated package**. The correct package is `@mariozechner/cchistory`.

### How It Works (Source Code Analysis)

The extraction flow, traced through `dist/index.js`:

```
1. Download Claude Code version from npm
   → npx @anthropic-ai/claude-code@{version}

2. Patch version check
   → Finds cli.mjs in downloaded package
   → Replaces outdatedCheck() with no-op to prevent "outdated" errors

3. Run with claude-trace
   → Command: npx @mariozechner/claude-trace --claude-path {patched_cli} --no-open --run-with {args} -p "Write a haiku about it."
   → claude-trace monkeypatches fetch() to intercept API requests
   → A single haiku prompt triggers one full API round-trip

4. Select best request (dist/core/request-filter.js)
   → Filter out Haiku model requests (want the main model)
   → Prefer requests with tools AND system prompt
   → Sort by tool count descending, take first
   → Exclude MCP tools (prefix "mcp__")

5. Extract content (dist/core/content-extractor.js)
   → System prompt: join all system blocks of type "text"
   → User message: first message with role "user"
   → Tools: full tool definitions minus MCP tools

6. Save to file
   → Output: prompts-{version}.md
   → Skips if file already exists
```

### Key Source Code: Request Selection

From `dist/core/request-filter.js`:

```javascript
function selectBestRequest(pairs) {
    const nonHaikuPairs = filterNonHaikuRequests(pairs);
    const requestsWithToolsAndSystemPrompt = filterRequestsWithTools(nonHaikuPairs)
        .filter((pair) => pair.request.body.system);
    if (requestsWithToolsAndSystemPrompt.length > 0) {
        const sorted = requestsWithToolsAndSystemPrompt.sort(
            (a, b) => (b.request.body.tools?.length || 0) - (a.request.body.tools?.length || 0)
        );
        return sorted[0];
    }
    if (nonHaikuPairs.length > 0) { return nonHaikuPairs[0]; }
    throw new Error("No non-Haiku request found in the log");
}
```

This means cchistory picks the request with the **most tools** that also has a **system prompt** — which is the main Claude Code session request, not any sub-agent or background request.

### Two Operating Modes

1. **NPM version mode** (default): Downloads from npm, patches, traces
2. **Custom binary mode** (`--binary-path`): Uses local binary directly, skips download/patching

---

## 2. All Supported Flags and Options

From `--help` output and source code:

| Flag/Arg | Type | Description |
|----------|------|-------------|
| `version` | Positional | Claude Code npm version to extract (e.g., `2.1.50`) |
| `--latest` | Boolean | Extract all versions from specified version through latest release |
| `--binary-path <path>` | String | Use a custom/local Claude Code binary instead of downloading |
| `--claude-args "<args>"` | String (quoted) | Pass additional arguments to the Claude Code instance during extraction |
| `--version`, `-v` | Boolean | Show cchistory version |
| `--help`, `-h` | Boolean | Show usage documentation |

### Environment Variables

| Variable | Effect |
|----------|--------|
| `DEBUG=1` | Enable detailed output showing intercepted API requests and traces |
| Any env var prefixed before the command | Passed to the Claude Code instance (e.g., `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) |

### Usage Examples

```bash
# Extract single version
cchistory 2.1.50

# Extract range from version to latest
cchistory 1.0.0 --latest

# Test local/custom build
cchistory --binary-path /path/to/cli.js

# Pass flags to Claude Code
cchistory 2.1.50 --claude-args "--debug"

# Enable debug output
DEBUG=1 cchistory 2.1.50

# Show version
cchistory --version
```

### `--claude-args` Details

- Uses `shell-quote` library for proper escaping
- Shell operators are filtered for safety
- Arguments are appended to the Claude Code invocation command
- Common use: `--dangerously-skip-permissions`, `--debug`, `--mcp-config <path>`, `--append-system-prompt`

---

## 3. The Specific Command

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 cchistory 2.1.50 --claude-args '--dangerously-skip-permissions'
```

### Component-by-Component Breakdown

| Component | What It Does |
|-----------|-------------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Environment variable passed to the Claude Code instance. Enables the experimental agent teams feature flag, which adds agent-team-related instructions to the system prompt (TeamCreate, SendMessage, teammate management, etc.) |
| `cchistory` | The extraction tool |
| `2.1.50` | Target Claude Code version to download from npm and extract |
| `--claude-args` | cchistory flag to pass arguments through to the Claude Code instance |
| `'--dangerously-skip-permissions'` | Claude Code flag that disables all permission prompts. Required because cchistory runs non-interactively — without this, the test haiku would stall waiting for permission approval |

### What Actually Happens

1. cchistory downloads `@anthropic-ai/claude-code@2.1.50` from npm
2. Patches version check in the downloaded `cli.mjs`
3. Constructs command (from `dist/index.js`):
   ```
   npx --node-options="--no-warnings" -y @mariozechner/claude-trace \
     --claude-path {patched_cli_path} \
     --no-open \
     --run-with --dangerously-skip-permissions \
     -p "{date}. Write a haiku about it."
   ```
4. The Claude Code v2.1.50 instance starts with:
   - Agent teams **enabled** (env var)
   - Permission prompts **disabled** (`--dangerously-skip-permissions`)
5. claude-trace intercepts the API request containing the system prompt
6. cchistory extracts and saves to `prompts-2.1.50.md`

### Why `--dangerously-skip-permissions` Is Needed

Without it, cchistory's test prompt would trigger permission checks (the Bash tool, file reads, etc. all require approval in default mode). Since cchistory runs non-interactively, there's no way to approve permissions — the process would hang or fail.

### Why `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

With this env var set, Claude Code includes agent team instructions in its system prompt — TeamCreate tool, SendMessage tool, teammate lifecycle management, task coordination primitives. Without it, these instructions are absent from the system prompt. This is useful for seeing exactly what instructions teammates receive.

### Output

The resulting `prompts-2.1.50.md` will contain the **full system prompt including agent team instructions** — the combined system prompt that the lead session uses when agent teams are enabled.

---

## 4. Can cchistory Show a Teammate's System Prompt?

**No.** The evidence suggests cchistory cannot extract individual teammate system prompts. Here's why:

### How Teammate Prompts Work

When Claude Code spawns a teammate (via the Task tool with `team_name`), the teammate is a **separate Claude Code process** with its own:
- System prompt (constructed dynamically based on agent type, spawn prompt, and project context)
- Context window
- API connection
- Tool set (filtered by agent type and permissions)

### Why cchistory Cannot Capture Teammate Prompts

1. **Single test request**: cchistory sends one haiku prompt to a single Claude Code session. Teammates are only spawned when the lead session actively creates them during real work — a test haiku never triggers teammate spawning.

2. **Separate processes**: Even if teammates were somehow spawned, they run as independent processes. claude-trace only intercepts the **parent process's** fetch calls, not child processes.

3. **Dynamic construction**: Teammate system prompts are assembled dynamically from:
   - The agent type definition (`.claude/agents/<type>.md`)
   - The spawn prompt (what the lead tells the teammate to do)
   - Project context (CLAUDE.md, MCP servers, skills, rules)
   - Team config (team name, member list, task list location)
   - Custom agent instructions (`<system-message>` blocks in agent files)

   There is no single static "teammate system prompt" to extract.

4. **Request filter selects the lead**: The `selectBestRequest()` function picks the request with the most tools. The lead session always has the most tools (including TeamCreate, SendMessage, TaskCreate, etc.). Even if teammate requests were captured, they'd be filtered out in favor of the lead's request.

### What cchistory DOES Capture When Agent Teams Are Enabled

With `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, cchistory captures the **lead session's system prompt**, which includes:
- All standard Claude Code instructions
- Agent team coordination instructions (how to spawn teammates, use SendMessage, manage tasks)
- TeamCreate, SendMessage, TaskCreate/Update/List/Get tool definitions
- Team lifecycle management instructions

This reveals the **framework** for agent teams but not individual teammate prompts.

### Workarounds for Teammate Prompt Inspection

| Approach | Method | Confidence |
|----------|--------|------------|
| **claude-trace directly** | Run claude-trace on a live team session, filter for teammate process API calls | Medium — requires identifying teammate PIDs |
| **Self-reporting** | Ask a teammate to output its own system prompt via a task | Medium-High — teammates can read their own system context |
| **File inspection** | Read `.claude/agents/<type>.md` + project CLAUDE.md + team config to reconstruct what the prompt would be | High — all inputs are files on disk |
| **Modified cchistory** | Fork cchistory to trace child processes, or run cchistory within a teammate context | Low — significant engineering effort |

**Recommendation**: The most practical approach is file inspection — read the agent definition, CLAUDE.md, team rules, and team config, which together comprise the inputs to teammate prompt construction. The framework assembles these deterministically.

---

## Confidence Levels

| Finding | Confidence |
|---------|------------|
| cchistory extracts system prompts via claude-trace interception | **High** — verified from source code |
| Request selection prefers non-Haiku with most tools | **High** — read `selectBestRequest()` directly |
| MCP tools are filtered out of output | **High** — `filterAndSortTools()` excludes `mcp__` prefix |
| Agent teams env var adds team instructions to system prompt | **High** — documented Claude Code behavior |
| cchistory cannot capture teammate prompts | **High** — architectural limitation (separate processes, single test request, request filter logic) |
| `--dangerously-skip-permissions` is required for non-interactive use | **Medium-High** — inferred from non-interactive execution model |
| File inspection is the most practical alternative for teammate prompts | **Medium** — reasonable inference, not empirically tested |

---

## Open Questions

1. **Does version 2.1.50 exist on npm?** — The web research couldn't confirm this specific version. Claude Code versions in discussions range from 1.x to recent releases, but the exact version catalog isn't publicly indexed.
2. **Could claude-trace be modified to trace child processes?** — If claude-trace's monkeypatch could propagate to forked processes, teammate interception might work. Requires investigation of Node.js process spawning behavior.
3. **What exactly changes in the system prompt with agent teams enabled vs disabled?** — Running the specific command and diffing against a non-agent-teams extraction would reveal the delta.

---

## Sources

- [badlogic/cchistory - GitHub](https://github.com/badlogic/cchistory) — Repository, README, source code
- [cchistory.mariozechner.at](https://cchistory.mariozechner.at/) — Web UI for version comparison
- [cchistory blog post](https://mariozechner.at/posts/2025-08-03-cchistory/) — Technical deep-dive by the author
- `dist/index.js` (291 lines) — Main entry point, extraction flow
- `dist/core/request-filter.js` (68 lines) — Request selection logic
- `dist/core/content-extractor.js` (52 lines) — System prompt and user message extraction
- `package.json` — Package metadata, dependencies, author info
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) — Official agent teams docs
- `cchistory --help` output — CLI flags and usage examples

## References

- [badlogic/cchistory](https://github.com/badlogic/cchistory)
- [cchistory web interface](https://cchistory.mariozechner.at/)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [@mariozechner/claude-trace](https://www.npmjs.com/package/@mariozechner/claude-trace)
