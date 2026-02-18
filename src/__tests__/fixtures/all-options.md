---
name: all-options
description: Agent with every optional field set
color: red
prompt_mode: extend
base_prompt: _builtin
framework: claude-code
model: claude-opus-4-6
permission_mode: bypassPermissions
dangerously_skip_permissions: true
display_name: "All O (test)"
teammate_mode: tmux
continue_session: true
tools:
  - Read
  - Edit
  - Grep
disallowed_tools:
  - WebSearch
---

Full options agent prompt.
