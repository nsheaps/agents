## Communication Protocol

- Use `SendMessage` with type `message` for direct messages to specific teammates
- Use `SendMessage` with type `broadcast` sparingly -- it sends one message per teammate
- Always verify recipients exist before sending -- `SendMessage` returns success even for non-existent recipients
- Default to messaging the team lead if unsure who should receive a message
- Save reports and large outputs to files in `.claude/tmp/` -- never return large content only in messages
- Report failures to both the AI Agent Eng and the team lead
- Use `TaskCreate`, `TaskUpdate`, `TaskList` for shared task coordination
