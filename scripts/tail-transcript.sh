#!/usr/bin/env bash
# tail-transcript.sh — tail a Claude Code transcript jsonl and print a
# simplified stream of user/assistant messages suitable for the Tilt UI.
#
# Usage:
#   scripts/tail-transcript.sh <path/to/transcript.jsonl>
#
# Output format (one line per relevant message):
#   [USER 2026-04-09T15:58:19] first 200 chars of the user message
#   [ASST 2026-04-09T15:58:22] first 200 chars of the assistant text
#
# system / summary / tool-only entries are skipped. This is intentionally
# dumb — rich tool-call decoration belongs in a future, dedicated formatter.

set -euo pipefail

TRANSCRIPT="${1:-}"
if [[ -z "$TRANSCRIPT" ]]; then
  echo "usage: $0 <transcript.jsonl>" >&2
  exit 2
fi

# Wait for the file to exist (transcripts may lag slightly behind session start).
for _ in $(seq 1 30); do
  [[ -e "$TRANSCRIPT" ]] && break
  sleep 1
done

if [[ ! -e "$TRANSCRIPT" ]]; then
  echo "tail-transcript: file not found: $TRANSCRIPT" >&2
  exit 1
fi

exec tail -n +1 -F "$TRANSCRIPT" | python3 -u -c '
import json
import sys

MAX = 200

def extract_text(msg):
    content = msg.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                parts.append(block.get("text", ""))
            elif btype == "tool_use":
                parts.append("<tool_use:{}>".format(block.get("name", "?")))
            elif btype == "tool_result":
                parts.append("<tool_result>")
        return " ".join(p for p in parts if p)
    return ""

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        continue
    etype = entry.get("type")
    if etype not in ("user", "assistant"):
        continue
    ts = (entry.get("timestamp") or "")[:19]
    msg = entry.get("message") or {}
    text = extract_text(msg).replace("\n", " ").strip()
    if not text:
        continue
    if len(text) > MAX:
        text = text[:MAX] + "..."
    label = "USER" if etype == "user" else "ASST"
    print("[{} {}] {}".format(label, ts, text), flush=True)
'
