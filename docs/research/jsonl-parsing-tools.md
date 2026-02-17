# JSONL Parsing Tools: Research Report

**Date**: February 2026
**Researcher**: Road Runner (Researcher)
**Task**: #99

---

## 1. Claude Code JSONL Transcript Schema

Claude Code stores conversation transcripts as JSONL files at `~/.claude/projects/**/*.jsonl`. Each line is a self-contained JSON object representing one event in the conversation. Files can be large — a single session transcript reached 38MB during testing.[^1]

### File Location

```
~/.claude/projects/{project-path-hash}/{session-id}.jsonl
```

Example: `~/.claude/projects/-Users-nathan-heaps-src-nsheaps-claude-utils/f848e71b-ec98-44bb-84ef-c6a0ade9e480.jsonl`

### Top-Level Keys (All Entries)

Every JSONL entry contains these fields:

| Key | Type | Description |
|:----|:-----|:------------|
| `uuid` | string | Unique identifier for this entry |
| `parentUuid` | string | UUID of the parent entry (conversation threading) |
| `type` | string | Entry type: `user`, `assistant`, `system`, `progress`, `queue-operation`, `summary` |
| `timestamp` | string | ISO 8601 timestamp |
| `sessionId` | string | Session identifier |
| `version` | string | Schema version |
| `cwd` | string | Working directory at time of entry |
| `gitBranch` | string | Git branch at time of entry |
| `isSidechain` | boolean | Whether entry is part of a sidechain |
| `teamName` | string | Team name (when using agent teams) |
| `agentName` | string | Agent name within the team |
| `userType` | string | Type of user interaction |

### Entry Type Distribution

From a 38MB transcript (~12,000 entries):[^1]

| Type | Count | Percentage | Description |
|:-----|------:|:-----------|:------------|
| `queue-operation` | 10,602 | ~86% | Internal queue management |
| `progress` | 599 | ~5% | Hook progress, waiting states |
| `assistant` | 563 | ~5% | LLM responses |
| `user` | 359 | ~3% | User messages and tool results |
| `system` | 68 | ~1% | System events (hooks, compaction) |

### Entry Type Details

#### `user` Entries

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "string or array"
  },
  "isMeta": false
}
```

Content is either a plain string (user text) or an array of tool result objects:

```json
{
  "content": [
    {
      "tool_use_id": "toolu_xxx",
      "type": "tool_result",
      "content": "result text",
      "is_error": false
    }
  ]
}
```

#### `assistant` Entries

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6-20250514",
    "id": "msg_xxx",
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "..."},
      {"type": "tool_use", "id": "toolu_xxx", "name": "Bash", "input": {...}},
      {"type": "thinking", "thinking": "..."}
    ],
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 12345,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 5000,
      "output_tokens": 500
    }
  },
  "requestId": "req_xxx"
}
```

Content block types observed:

| Content Blocks | Count | Description |
|:---------------|------:|:------------|
| `["tool_use"]` | 345 | Tool invocation only |
| `["text"]` | 217 | Text response only |
| `["thinking"]` | 37 | Internal reasoning |

Most-used tools (from sample):

| Tool | Count |
|:-----|------:|
| Bash | 82 |
| Read | 69 |
| TaskOutput | 34 |
| Task | 32 |
| SendMessage | 29 |
| Write | 26 |
| TaskUpdate | 24 |
| Glob | 14 |
| TaskList | 12 |

#### `system` Entries

```json
{
  "type": "system",
  "subtype": "stop_hook_summary | turn_duration | compact_boundary",
  "slug": "string",
  "stopReason": "string",
  "level": "string",
  "hookCount": 0,
  "hasOutput": false,
  "hookErrors": [],
  "hookInfos": [],
  "preventedContinuation": false,
  "toolUseID": "string"
}
```

Subtype distribution: `stop_hook_summary` (42), `turn_duration` (18), `compact_boundary` (8).

#### `progress` Entries

```json
{
  "type": "progress",
  "data": {
    "type": "hook_progress | waiting_for_task",
    "hookEvent": "string",
    "hookName": "string",
    "command": "string"
  },
  "parentToolUseID": "string",
  "toolUseID": "string"
}
```

Subtypes: `hook_progress` (598), `waiting_for_task` (20).

#### `queue-operation` Entries

```json
{
  "type": "queue-operation",
  "operation": "enqueue | dequeue | remove",
  "content": "...",
  "sessionId": "string"
}
```

Operations: `enqueue` (5,314), `dequeue` (5,273), `remove` (15).

#### `summary` Entries

Created during context compaction:

```json
{
  "type": "summary",
  "summary": "long text summarizing compacted context",
  "leafUuid": "uuid of the last entry before compaction"
}
```

---

## 2. CLI Tools

### jq

The standard tool for JSON/JSONL processing. Processes JSONL natively — one filter invocation per line without special flags.[^2]

**Install**: `brew install jq`

**Key patterns for Claude Code transcripts**:

```bash
# Filter by entry type
jq 'select(.type == "assistant")' transcript.jsonl

# Extract user messages (text only)
jq -r 'select(.type == "user") | .message.content | strings' transcript.jsonl

# Get tool usage from assistant entries
jq 'select(.type == "assistant") | .message.content[] | select(.type == "tool_use") | .name' transcript.jsonl

# Count entries by type
jq -s 'group_by(.type) | map({type: .[0].type, count: length})' transcript.jsonl

# Token usage per assistant turn
jq 'select(.type == "assistant") | {timestamp, input: .message.usage.input_tokens, output: .message.usage.output_tokens}' transcript.jsonl

# Filter by timestamp range
jq --arg start "2026-02-15T10:00" 'select(.timestamp > $start and .type == "assistant")' transcript.jsonl
```

**Streaming & performance**:

| File Size | Approach | Memory |
|:----------|:---------|:-------|
| < 100MB | Standard `jq 'select(...)'` | Low — line-by-line |
| 100MB–5GB | `jq --stream` for memory safety | Constant |
| Aggregations | `jq -s` (loads all into memory) | High — avoid on large files |

**Strengths**: Full JSON structural awareness, nested field access, aggregations, transformations.[^2]
**Weaknesses**: Slower than grep for simple text matching (5–50x), `--slurp` loads everything into memory.[^2]

### Miller (mlr)

Tabular data processor. Handles JSONL as flat key-value records with streaming architecture.[^3]

**Install**: `brew install miller`

**Key patterns**:

```bash
# Filter entries
mlr --jsonl filter '$type == "assistant"' transcript.jsonl

# Select specific fields
mlr --jsonl cut -f type,timestamp,uuid transcript.jsonl

# Count by type
mlr --jsonl stats1 -a count -g type transcript.jsonl

# Sort by timestamp
mlr --jsonl sort -f timestamp transcript.jsonl

# Convert to CSV for spreadsheet analysis
mlr --j2c cut -f type,timestamp transcript.jsonl > transcript.csv
```

**Streaming support**: Most operations (filter, cut, stats) are fully streaming. Sort requires full buffering. Use `--no-mmap` for files over 1GB.[^3]

**Strengths**: Excellent for tabular operations, format conversion (JSONL↔CSV↔TSV), streaming aggregations.[^3]
**Weaknesses**: Flattens nested JSON to dotted keys — cannot handle deeply nested structures like assistant message content blocks. Use jq first for nested extraction, then pipe to mlr for tabular operations.[^3]

### grep / ripgrep (rg)

Line-oriented text search. 5–50x faster than jq for simple pattern matching.[^4]

**Install**: `brew install ripgrep` (grep is built-in)

**Key patterns for Claude Code transcripts**:

```bash
# Find entries by type (fast)
rg -F '"type":"assistant"' transcript.jsonl

# Count entries by type
rg -c '"type":"user"' transcript.jsonl

# Find specific session
rg -F '"sessionId":"f848e71b"' transcript.jsonl

# Find tool uses
rg '"name":"Bash"' transcript.jsonl

# Find error results
rg '"is_error":true' transcript.jsonl

# Combine with jq for structured extraction
rg -F '"type":"assistant"' transcript.jsonl | jq '.message.usage'
```

**Performance on 1GB JSONL**:[^4]

| Task | grep | rg | jq |
|:-----|:-----|:---|:---|
| Count matches | 0.5s | 0.3s | 8–12s |
| Return matching lines | 1.2s | 0.8s | 15–20s |
| Filter + extract field | N/A | N/A | 20–25s |

**Strengths**: Speed for simple text patterns, UUIDs, timestamps. No JSON parsing overhead.[^4]
**Weaknesses**: No structural awareness, no numeric comparisons, no nested field queries. String value collisions (matches anywhere in the line).[^4]

**Best practice**: Use `rg` for fast pre-filtering, pipe to `jq` for structured extraction.[^4]

---

## 3. Node.js / Bun Packages

All streaming approaches handle 100MB+ files with ~1–5MB constant memory usage.[^5]

### Recommended by Runtime

| Runtime | Primary Choice | Fallback |
|:--------|:---------------|:---------|
| **Bun** | `Bun.JSONL.parseChunk()` (native, fastest) | `Bun.file().stream()` (no deps) |
| **Node.js** | `ndjson` (147k dependents, industry standard) | `readline` (built-in, zero deps) |

### Package Comparison

| Package | Install | Streaming | Gzip | Error Handling | Best For |
|:--------|:--------|:----------|:-----|:---------------|:---------|
| **Bun.JSONL** | Built-in | Chunk-based | No | Non-throwing (returns error object) | Bun runtime, maximum speed |
| **ndjson** | `bun add ndjson` | Full stream | No | `strict: false` skips invalid lines | Industry standard, proven |
| **@jsonlines/core** | `bun add @jsonlines/core` | Full stream | Yes | Configurable | Compressed files, custom serializers |
| **readline** | Built-in (Node) | Line-by-line | No | Manual try/catch | Zero dependencies |

### Bun.JSONL.parseChunk() Example

```typescript
const file = Bun.file('transcript.jsonl')
const stream = file.stream()
const reader = stream.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value)
  const result = Bun.JSONL.parseChunk(buffer)

  for (const entry of result.values) {
    if (entry.type === 'assistant') {
      const usage = entry.message?.usage
      console.log(`${entry.timestamp}: ${usage?.output_tokens} tokens`)
    }
  }

  buffer = buffer.slice(result.read)
}
```

### ndjson Example (Node.js / Bun)

```typescript
import { createReadStream } from 'fs'
import ndjson from 'ndjson'

createReadStream('transcript.jsonl')
  .pipe(ndjson.parse({ strict: false }))
  .on('data', (entry) => {
    if (entry.type === 'assistant') {
      console.log(entry.message?.usage)
    }
  })
```

---

## 4. Python Tools

For scripting and data analysis workflows.[^6]

### Recommended by Use Case

| Use Case | Tool | Why |
|:---------|:-----|:----|
| Simple streaming | Built-in `json` | Zero deps, minimal memory |
| JSONL-specific API | `jsonlines` | Clean API, type validation |
| DataFrames / aggregation | `pandas` | Familiar, powerful filtering |
| Speed-critical / large files | `polars` | Rust-based, 3–7x faster, streaming >RAM |

### Quick Patterns

```bash
# Count entries by type (one-liner)
python3 -c 'import json, sys; [print(json.dumps(x)) for x in map(json.loads, sys.stdin) if x.get("type") == "assistant"]' < transcript.jsonl

# Polars for fast analysis
python3 -c "
import polars as pl
df = pl.scan_ndjson('transcript.jsonl')
print(df.filter(pl.col('type') == 'assistant').collect(engine='streaming'))
"
```

### polars (Fastest Python Option)

```python
import polars as pl

# Lazy scan — streaming, handles files larger than RAM
df = pl.scan_ndjson('transcript.jsonl')
assistants = df.filter(pl.col('type') == 'assistant').collect(engine='streaming')
print(f"Assistant turns: {len(assistants)}")
```

---

## 5. Decision Matrix

### By Task Type

| Task | Best Tool | Why |
|:-----|:----------|:----|
| **Quick text search** (UUID, session ID) | `rg` | 5–50x faster than jq |
| **Type-based filtering** | `rg` + `jq` pipe | rg pre-filters, jq extracts |
| **Nested field extraction** | `jq` | Full structural JSON access |
| **Token usage analysis** | `jq` or `polars` | Numeric aggregation needed |
| **Format conversion** (to CSV) | `mlr` | Streaming, handles large files |
| **Programmatic processing** | `Bun.JSONL` | Native, fastest in TypeScript |
| **Data science / visualization** | `polars` or `pandas` | DataFrame ecosystem |
| **Aggregation / grouping** | `jq -s` (small files) or `mlr` (large) | Memory constraints |

### By File Size

| File Size | Recommended Approach |
|:----------|:---------------------|
| < 10MB | Any tool works fine |
| 10–100MB | `jq` (line-by-line), `rg` for text search |
| 100MB–1GB | `rg` pre-filter + `jq`, or `mlr` streaming, or `Bun.JSONL` |
| > 1GB | `rg` for search, `jq --stream`, `mlr --no-mmap`, `polars` streaming |

### By Language Ecosystem

| Ecosystem | Primary | Secondary |
|:----------|:--------|:----------|
| **Shell / CLI** | `jq` + `rg` | `mlr` for tabular ops |
| **TypeScript / Bun** | `Bun.JSONL.parseChunk()` | `ndjson` (cross-runtime) |
| **Node.js** | `ndjson` | `readline` (zero deps) |
| **Python** | `polars` (speed) | `jsonlines` (simplicity) |

---

## 6. Practical Recipes for Claude Code Transcripts

### Find all user messages (text only)

```bash
jq -r 'select(.type == "user") | .message.content | strings' transcript.jsonl
```

### List all tools used in a session

```bash
jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' transcript.jsonl | sort | uniq -c | sort -rn
```

### Calculate total token usage

```bash
jq -s '[.[] | select(.type == "assistant") | .message.usage] | {
  total_input: (map(.input_tokens) | add),
  total_output: (map(.output_tokens) | add),
  total_cache_read: (map(.cache_read_input_tokens) | add),
  total_cache_create: (map(.cache_creation_input_tokens) | add)
}' transcript.jsonl
```

### Find errors from tool results

```bash
rg '"is_error":true' transcript.jsonl | jq -r '.message.content[] | select(.is_error == true) | .content[:200]'
```

### Extract conversation flow (text exchanges only)

```bash
jq -r 'select(.type == "user" or .type == "assistant") |
  if .type == "user" then
    "USER: " + (.message.content | if type == "string" then . else "[tool_result]" end)
  else
    "ASSISTANT: " + ([.message.content[] | select(.type == "text") | .text] | join(" "))
  end' transcript.jsonl
```

### Find compaction boundaries

```bash
jq 'select(.type == "system" and .subtype == "compact_boundary")' transcript.jsonl
```

### Get session timeline

```bash
jq -r 'select(.type == "assistant" or (.type == "user" and (.message.content | type) == "string")) | [.timestamp, .type, (if .type == "user" then .message.content[:80] else (.message.content[0].text // .message.content[0].name // "")[0:80] end)] | @tsv' transcript.jsonl
```

---

## References

[^1]: Analysis of `~/.claude/projects/-Users-nathan-heaps-src-nsheaps-claude-utils/f848e71b-ec98-44bb-84ef-c6a0ade9e480.jsonl` (38MB, ~12,000 entries)
[^2]: [jq 1.8 Manual](https://jqlang.org/manual/), [JSON Lines Format](https://jsonlines.org/examples/), [JQ Select Explained](https://earthly.dev/blog/jq-select/)
[^3]: [Miller Documentation](https://miller.readthedocs.io/), [Miller GitHub](https://github.com/johnkerl/miller)
[^4]: [ripgrep GitHub](https://github.com/BurntSushi/ripgrep), [JSON, JSONlines, and jq as a better grep](https://zxvf.org/post/jq-as-grep/), [Ripgrep vs Grep Performance](https://www.codeant.ai/blogs/ripgrep-vs-grep-performance)
[^5]: [ndjson npm](https://www.npmjs.com/package/ndjson), [@jsonlines/core npm](https://www.npmjs.com/package/@jsonlines/core), [Bun JSONL API](https://bun.sh/docs/api/jsonl)
[^6]: [jsonlines PyPI](https://pypi.org/project/jsonlines/), [polars documentation](https://docs.pola.rs/), [pandas read_json](https://pandas.pydata.org/docs/reference/api/pandas.read_json.html)
