#!/usr/bin/env bash
# hook-integration.test.sh — verifies the require-task-in-progress.sh write-gate
# is satisfiable by an MCP-created task, and denies when none is in_progress.
#
# This is the core acceptance criterion of the MCP-task-server feature: a task
# created+promoted via the MCP server must satisfy the existing write-gate.
#
# Uses temp directories so no real repo or ~/.claude is touched.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$PLUGIN_ROOT/hooks/require-task-in-progress.sh"
INVARIANT_HOOK="$PLUGIN_ROOT/hooks/task-invariant.sh"
# The MCP server is shipped as source and compiled to a native binary by
# `bun build --compile` (run via `mise run build-task-mcp`, a dependency of
# `mise run test-task-mcp`). The binary is run directly — not via `bun`.
SERVER="$PLUGIN_ROOT/mcp/dist/task-mcp"
if [[ ! -x "$SERVER" ]]; then
  echo "FAIL — compiled MCP server binary not found at $SERVER (run: mise run build-task-mcp)" >&2
  exit 1
fi

FAIL=0
pass() { printf 'PASS — %s\n' "$1"; }
fail() { printf 'FAIL — %s\n' "$1"; FAIL=1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

TASKDIR="$WORK/tasks"
mkdir -p "$TASKDIR"

# write_payload <tool_name> — emits the PreToolUse hook stdin JSON.
write_payload() {
  jq -nc --arg t "$1" '{tool_name: $t, session_id: "test-session", tool_input: {}}'
}

# decision <hook-output-json> — extracts permissionDecision. Empty hook output
# (the opt-out / non-write-tool path) yields "none".
decision() {
  if [[ -z "${1// /}" ]]; then
    printf 'none\n'
    return 0
  fi
  jq -r '.hookSpecificOutput.permissionDecision // "none"' <<<"$1" 2>/dev/null || printf 'none\n'
}

echo "== Test 1: write-gate DENIES when no task is in_progress =="
OUT="$(write_payload Write | TASK_UTILS_TASK_DIR="$TASKDIR" CLAUDE_PROJECT_DIR="$WORK" bash "$HOOK")"
if [[ "$(decision "$OUT")" == "deny" ]]; then
  pass "no in_progress task -> deny"
else
  fail "expected deny, got: $OUT"
fi

echo "== Test 2: create + promote a task via the MCP server =="
# task_create
CREATE_REQ='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"task_create","arguments":{"subject":"hook-integration task"}}}'
printf '%s\n' "$CREATE_REQ" | TASK_UTILS_TASK_DIR="$TASKDIR" timeout 10 "$SERVER" >/dev/null 2>&1
if [[ -f "$TASKDIR/1.json" ]]; then
  pass "task_create wrote flat $TASKDIR/1.json"
else
  fail "task_create did not write 1.json"
fi

# task_update -> in_progress (with validation-steps).
# $VS holds REAL newlines; jq --arg + json encoding then carries them faithfully
# into the JSON-RPC request so the server's parser sees a proper block.
VS="$(printf '<validation-steps>\n - [ ] verify the gate\n</validation-steps>')"
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}'
UPDATE_CALL="$(jq -nc --arg vs "$VS" \
  '{jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"task_update",arguments:{taskId:"1",status:"in_progress",description:$vs}}}')"
printf '%s\n%s\n' "$INIT" "$UPDATE_CALL" | TASK_UTILS_TASK_DIR="$TASKDIR" timeout 10 "$SERVER" >/dev/null 2>&1
STATUS="$(jq -r '.status' "$TASKDIR/1.json")"
if [[ "$STATUS" == "in_progress" ]]; then
  pass "task_update promoted task 1 to in_progress"
else
  fail "expected in_progress, task 1 is: $STATUS"
fi

echo "== Test 3: write-gate ALLOWS when an MCP task is in_progress =="
OUT="$(write_payload Write | TASK_UTILS_TASK_DIR="$TASKDIR" CLAUDE_PROJECT_DIR="$WORK" bash "$HOOK")"
if [[ "$(decision "$OUT")" == "allow" ]]; then
  pass "MCP in_progress task -> allow (CORE ACCEPTANCE CRITERION)"
else
  fail "expected allow, got: $OUT"
fi

echo "== Test 4: write-gate DENIES again after the task completes =="
VS_DONE="$(printf '<validation-steps>\n - [x] verify the gate\n       RESULT(2026-05-21 04:00Z): gate verified\n</validation-steps>')"
COMPLETE_CALL="$(jq -nc --arg vs "$VS_DONE" \
  '{jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"task_update",arguments:{taskId:"1",status:"completed",description:$vs}}}')"
printf '%s\n%s\n' "$INIT" "$COMPLETE_CALL" | TASK_UTILS_TASK_DIR="$TASKDIR" timeout 10 "$SERVER" >/dev/null 2>&1
OUT="$(write_payload Write | TASK_UTILS_TASK_DIR="$TASKDIR" CLAUDE_PROJECT_DIR="$WORK" bash "$HOOK")"
if [[ "$(decision "$OUT")" == "deny" ]]; then
  pass "completed task no longer satisfies the gate -> deny"
else
  fail "expected deny, got: $OUT"
fi

echo "== Test 5: TASK_UTILS_REQUIRE_TASK=0 opt-out still bypasses the gate =="
OUT="$(write_payload Write | TASK_UTILS_TASK_DIR="$TASKDIR" TASK_UTILS_REQUIRE_TASK=0 CLAUDE_PROJECT_DIR="$WORK" bash "$HOOK")"
if [[ "$(decision "$OUT")" == "none" ]]; then
  pass "opt-out -> no decision emitted (gate disabled)"
else
  fail "expected no decision, got: $OUT"
fi

echo "== Test 6: non-write tool is not gated =="
OUT="$(write_payload Read | TASK_UTILS_TASK_DIR="$TASKDIR" CLAUDE_PROJECT_DIR="$WORK" bash "$HOOK")"
if [[ -z "$OUT" ]]; then
  pass "Read tool -> hook exits silently (not gated)"
else
  fail "expected empty output for Read, got: $OUT"
fi

echo "== Test 7: task-invariant.sh sees MCP in_progress for the 0-or-1 invariant =="
# Re-create an MCP task and promote it to in_progress, then a built-in
# TaskUpdate->in_progress on a legacy task must be denied (0-or-1 across stores).
printf '%s\n' "$CREATE_REQ" | TASK_UTILS_TASK_DIR="$TASKDIR" timeout 10 "$SERVER" >/dev/null 2>&1
NEWID="$(jq -rs 'map(.id) | sort_by(tonumber) | last' "$TASKDIR"/*.json)"
UPDATE2="$(jq -nc --arg vs "$VS" --arg id "$NEWID" \
  '{jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"task_update",arguments:{taskId:$id,status:"in_progress",description:$vs}}}')"
printf '%s\n%s\n' "$INIT" "$UPDATE2" | TASK_UTILS_TASK_DIR="$TASKDIR" timeout 10 "$SERVER" >/dev/null 2>&1

# A legacy built-in task in its own session dir trying to go in_progress.
LEGACY_DIR="$WORK/claude-config/tasks/test-session"
mkdir -p "$LEGACY_DIR"
LEGACY_VS="$(printf '<validation-steps>\n - [ ] x\n</validation-steps>')"
jq -nc --arg vs "$LEGACY_VS" \
  '{id:"99",subject:"legacy task",status:"pending",description:$vs}' > "$LEGACY_DIR/99.json"
INV_PAYLOAD="$(jq -nc '{tool_name:"TaskUpdate",session_id:"test-session",tool_input:{taskId:"99",status:"in_progress"}}')"
OUT="$(printf '%s' "$INV_PAYLOAD" | TASK_UTILS_TASK_DIR="$TASKDIR" CLAUDE_CONFIG_DIR="$WORK/claude-config" CLAUDE_PROJECT_DIR="$WORK" bash "$INVARIANT_HOOK")"
if [[ "$(decision "$OUT")" == "deny" ]]; then
  pass "task-invariant.sh denies a 2nd in_progress across flat+legacy stores"
else
  fail "expected deny (0-or-1 across stores), got: $OUT"
fi

echo
if [[ "$FAIL" -eq 0 ]]; then
  echo "ALL HOOK-INTEGRATION TESTS PASSED"
  exit 0
else
  echo "SOME HOOK-INTEGRATION TESTS FAILED"
  exit 1
fi
