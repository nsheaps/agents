# Storage Formats Reference

Detailed comparison of storage formats for Claude Code plugins.

---

## YAML

### When to use

- Default for all structured plugin data: task files, config, plugin state
- Any file that a human will read or edit
- Any file that needs comments to document intent

### Syntax examples

```yaml
# Task file example
id: "42"
subject: Fix the login bug
status: in_progress
created_at: 2026-05-23T10:00:00Z
description: |-
  Investigate why login fails on Safari 17.

  <validation-steps>
  - [ ] Reproduce on Safari 17
  - [ ] Identify root cause
  - [ ] Implement fix
  </validation-steps>
```

```yaml
# Multi-document (stream) — one file, many records
---
id: "1"
status: completed
---
id: "2"
status: pending
```

```yaml
# Anchors and aliases — reduce config repetition
defaults: &defaults
  timeout: 30
  retries: 3

task_hook:
  <<: *defaults
  command: hooks/task-invariant.sh
```

### Querying YAML with yq

```bash
# Get a field
yq -r '.status' task-42.yaml

# Filter files by status
for f in .claude/tasks/*.yaml; do
  status=$(yq -r '.status' "$f")
  [[ "$status" == "in_progress" ]] && echo "$f"
done

# Update a field (copy-swap)
yq -y '. + {"status": "completed"}' task-42.yaml > task-42.yaml.tmp
mv task-42.yaml.tmp task-42.yaml
```

### Block style vs flow style

Always use block style in data files. Flow style (`{key: value}`) is compact but:

- Harder to read in diffs
- Does not support comments
- Cannot span multiple lines cleanly

```yaml
# GOOD: block style
metadata:
  created_by: task-utils
  version: 1

# BAD: flow style (harder to diff, no comments)
metadata: {created_by: task-utils, version: 1}
```

---

## JSON5

### When to use

- Config files where comments improve understanding but tooling requires JSON-like syntax
- `.claude/settings.json` files (Claude Code supports JSON5 comments in practice)
- When migrating from JSON and you need to add explanatory comments

### Syntax example

```json5
// Plugin configuration
{
  // Required: MCP server URL
  mcpUrl: "http://localhost:3000",

  // Optional: override default timeout (seconds)
  // "timeout": 30,

  hooks: {
    preToolUse: true,
  },
}
```

### Limitations

- Not all JSON parsers support JSON5 (test before using)
- `jq` cannot parse JSON5 natively (strip comments first)
- Prefer YAML when both humans and tools read the file

---

## Markdown with Frontmatter

### When to use

- Plans and implementation documents (`docs/plans/`)
- Specifications (`docs/specs/`)
- Task files with rich freeform descriptions
- Any document where the body is prose and the metadata is queryable

### Format

```markdown
---
id: "42"
subject: Fix the login bug
status: in_progress
tags: [auth, safari, bug]
created_at: 2026-05-23T10:00:00Z
---

# Fix the Login Bug

## Problem

Safari 17 fails to complete the OAuth redirect because...

## Work Log

2026-05-23T10:00:00Z — Started investigation.
2026-05-23T11:00:00Z — Identified root cause: SameSite cookie policy.
```

### Parsing frontmatter

The `yq` tool can parse YAML frontmatter from a Markdown file by treating everything before the
second `---` as a YAML document:

```bash
# Extract frontmatter only
sed -n '1,/^---$/p' task.md | head -n -1 | yq -r '.status'

# Or use a dedicated frontmatter parser
python3 -c "
import sys, yaml
content = open(sys.argv[1]).read()
parts = content.split('---', 2)
if len(parts) >= 3:
    meta = yaml.safe_load(parts[1])
    print(meta.get('status', ''))
" task.md
```

---

## JSON

### When to use

- Wire protocols: MCP stdio, HTTP APIs, WebSockets
- External tool output (e.g., `gh api` returns JSON)
- Files that must interoperate with tools that cannot parse YAML

### Do NOT use JSON for

- Human-editable config (no comments)
- Files that agents will read in context (verbose without structure benefits)
- Plugin state or task files (use YAML instead)

### Conversion: JSON → YAML

```bash
# Convert a JSON task file to YAML
cat task.json | yq -y '.'

# Verify round-trip integrity
original=$(jq -c '.' task.json)
converted=$(yq -y '.' task.json | yq -c '.')
[[ "$original" == "$converted" ]] && echo "Round-trip OK" || echo "MISMATCH"
```

### Conversion: YAML → JSON

```bash
yq -c '.' task.yaml   # Compact JSON
yq '.' task.yaml      # Pretty JSON
```

---

## Format Decision Matrix

| Need                                        | Format                    |
| ------------------------------------------- | ------------------------- |
| Structured data, human-readable             | YAML                      |
| Config with comments, JSON-tooling required | JSON5                     |
| Prose + metadata                            | Markdown-with-frontmatter |
| Wire protocol / external API                | JSON                      |
| Streaming with typed values                 | JSONL / TOON              |
| Querying across many records                | SQLite (narrow case)      |
| Tree-structured documents                   | XML (narrow case)         |

---

## Migration: JSON → YAML

Use this pattern when migrating existing `.json` files to `.yaml`:

```bash
#!/usr/bin/env bash
# migrate-json-to-yaml.sh
set -euo pipefail

for json_file in .claude/tasks/*.json; do
  [[ -f "$json_file" ]] || continue
  yaml_file="${json_file%.json}.yaml"

  # Convert
  yq -y '.' "$json_file" > "$yaml_file"

  # Verify round-trip
  original=$(jq -c '.' "$json_file")
  restored=$(yq -c '.' "$yaml_file")
  if [[ "$original" != "$restored" ]]; then
    echo "ERROR: Round-trip mismatch for $json_file" >&2
    rm -f "$yaml_file"
    exit 1
  fi

  echo "Migrated: $json_file → $yaml_file"
  rm -f "$json_file"
done
```
