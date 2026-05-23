# Streaming Formats Reference

Formats for streaming data output, line-delimited protocols, and structured tool output.

---

## JSONL (JSON Lines / NDJSON)

**When to use:**

- MCP stdio wire protocol (each request/response is one JSON line + `\n`)
- Log files where each line is a structured event
- Streaming API responses where records are emitted as they complete
- Shell pipelines that process records one at a time

**Format:**

```jsonl
{"id":"1","status":"completed","subject":"Fix the login bug"}
{"id":"2","status":"in_progress","subject":"Add dark mode"}
{"id":"3","status":"pending","subject":"Write tests"}
```

**Rules:**

- Each line is a complete, valid JSON object
- No trailing commas between lines
- No enclosing array brackets
- Empty lines are ignored by convention

**Producing JSONL from YAML:**

```bash
# Convert a YAML task file to a single JSONL line
yq -c '.' task-42.yaml

# Stream all tasks as JSONL
for f in .claude/tasks/*.yaml; do
  yq -c '.' "$f"
done
```

**Consuming JSONL:**

```bash
# Filter in-progress tasks from a JSONL stream
cat tasks.jsonl | jq -c 'select(.status == "in_progress")'

# Extract a single field
cat tasks.jsonl | jq -r '.subject'
```

---

## MCP Stdio Protocol

The MCP server communicates over stdio using JSONL at the wire level.

**Request (stdin, one line):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "task_list", "arguments": {} }
}
```

**Response (stdout, one line):**

```json
{ "jsonrpc": "2.0", "id": 1, "result": { "content": [{ "type": "text", "text": "..." }] } }
```

**Key constraint:** Each message must be a single line (no embedded newlines in JSON values
unless escaped as `\n`). The SDK (`@modelcontextprotocol/sdk`) handles this serialization.

**Internal storage vs wire format:**

- YAML on disk → YAML parsed to in-memory objects → JSON serialized by SDK → JSONL on wire
- The plugin's storage layer and wire protocol are independent
- Never write raw YAML to a stdio MCP transport

---

## TOON / TRON

**What it is:** A convention for streaming tool output where each line contains a typed value
with metadata. Used when downstream consumers need to distinguish between different record types
in a mixed stream.

**TOON format (Tool Output Object Notation):**

```
TYPE:{"field":"value","other":123}
```

**Example:**

```
TASK:{"id":"42","status":"completed","subject":"Fix login bug"}
LOG:{"level":"info","message":"Task updated","ts":"2026-05-23T10:00:00Z"}
ERROR:{"code":"CONFLICT","message":"Race condition on task 42"}
```

**When to use TOON:**

- A tool emits multiple record types in the same stream
- Downstream consumers need to route by type without fully parsing each record
- You need streaming output with type safety but without a full schema registry

**Parsing TOON:**

```bash
# Extract only TASK records
grep '^TASK:' output.toon | sed 's/^TASK://' | jq '.'

# Route by type
while IFS= read -r line; do
  type="${line%%:*}"
  payload="${line#*:}"
  case "$type" in
    TASK)  echo "$payload" | jq '.id' ;;
    ERROR) echo "Error: $(echo "$payload" | jq -r '.message')" >&2 ;;
  esac
done < output.toon
```

**When NOT to use TOON:**

- When the MCP SDK handles serialization (use JSONL/JSON-RPC instead)
- When there's only one record type in the stream (use JSONL directly)
- When the consumer is a standard tool that expects pure JSONL

---

## Per-Row Streaming vs Formatted-Document Output

### Per-row streaming (JSONL / TOON)

- Emit each record as soon as it's ready
- Consumer processes incrementally — no need to buffer the entire response
- Loss of document-level formatting: no headers, no comments, no structure between records
- Best for: live tail, large datasets, pipelines

### Formatted-document output (YAML / JSON pretty-printed)

- Emit the entire document at once
- Human-readable structure: headers, indentation, comments
- Cannot be streamed incrementally
- Best for: config files, reports, specs, anything a human reads

**Tradeoff rule:** Use per-row streaming at boundaries (wire protocols, pipelines, logs).
Use formatted-document output for persistent storage and human-facing output.

---

## Log File Conventions

Plugin log files use JSONL for machine-queryable structured logs, or simple space-separated
text for human-readable logs.

### Structured log (JSONL)

```jsonl
{"ts":"2026-05-23T10:00:00Z","hook":"task-invariant","tool":"TaskCreate","decision":"allow"}
{"ts":"2026-05-23T10:01:00Z","hook":"task-invariant","tool":"TaskUpdate","decision":"deny","reason":"no-validation-steps"}
```

```bash
# Query: all denies in the last hour
cat .claude/logs/task-invariant.log | jq -c 'select(.decision == "deny")'
```

### Text log (append-only)

```
2026-05-23T10:00:00Z tool=TaskCreate session=abc12345 decision=allow
2026-05-23T10:01:00Z tool=TaskUpdate session=abc12345 decision=deny reason=no-validation-steps
```

```bash
# Query: grep for denies
grep 'decision=deny' .claude/logs/task-invariant.log
```

**Recommendation:** Use text log format for hook logs (simpler, grep-able, lower overhead).
Use JSONL for MCP server logs (structured queries needed).
