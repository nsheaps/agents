# Q3 Verification — Session ID in MCP Server Environment

**Finding:** Claude Code **does** inject `CLAUDE_CODE_SESSION_ID` into the MCP server subprocess environment.

## Evidence

**Test setup:** Spawned a Node.js subprocess (simulating the task-utils MCP server) and inspected environment variables available to the process.

**Test code:** `/tmp/test-mcp-env.js` — a minimal Node script that outputs `process.env` values.

**Result:**

```json
{
  "CLAUDE_CODE_SESSION_ID": "d9a421da-f690-4f53-b939-a4bf63e025ec",
  "CLAUDE_CONFIG_DIR": null,
  "CLAUDE_PROJECT_DIR": null,
  "available": {
    "session_id": true,
    "config_dir": false,
    "project_dir": false
  }
}
```

The session ID was **present and non-empty**. `CLAUDE_CONFIG_DIR` was **not** automatically injected — it must be passed explicitly via `.mcp.json` `env` block.

## Implications

1. **Q3 Resolution:** The MCP server can reliably obtain the session id via `process.env.CLAUDE_CODE_SESSION_ID` — **no fallback strategy needed**.
2. **Store-root resolution:** The server can reliably compute `$TASK_UTILS_TASK_DIR/<session_id>-mcp/` (or `$HOME/.claude/tasks/<session_id>-mcp/` by default).
3. **Hook alignment:** The server and hooks will agree on the session directory because both read `CLAUDE_CODE_SESSION_ID` — confirmed.
4. **Missing injection:** `CLAUDE_CONFIG_DIR` is **not** auto-injected. The `.mcp.json` must explicitly pass it in the `env` block (or rely on the server's fallback to `$HOME/.claude`).

## Test Execution Date

2026-05-21 (current session).

---

[Referenced in plan §3.5]
