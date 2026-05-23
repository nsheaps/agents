# plugin-dev

Skills for Claude Code plugin and tool development.

## Skills

### `data-storage-using-the-filesystem`

Covers conventions for persistent data storage in Claude Code plugins:

- File format selection (YAML > JSON5 > Markdown-with-frontmatter > JSON)
- Metadata storage (YAML frontmatter, comment-block frontmatter)
- File sizing and splitting
- YAML pros/cons and copy-swap concurrency pattern
- YAML → JSONL conversion at RPC/streaming boundaries
- Known path discipline (`$CLAUDE_PROJECT_DIR/.claude/`)
- Sync model: fetch-before-edit, push-after-write, daemon/MCP preferred
- Conflict detection and resolution

**Triggers:** "how to store data in a plugin", "YAML vs JSON", "keep task files in sync",
"streaming storage", "frontmatter metadata", "concurrent writes"

## Installation

This plugin is part of the `nsheaps/agents` repository. Enable it in your Claude Code settings:

```json
{
  "enabledPlugins": ["plugin-dev@agents-local"]
}
```
