---
name: test-agent
description: A test agent for unit tests
color: blue
model: claude-sonnet-4-6
permission_mode: delegate
display_name: "Test A (test)"
tools:
  - Read
  - Write
disallowed_tools:
  - Bash
---

You are a test agent.

## Instructions

Do test things.
