# Communication Protocol

How teammates communicate within an agent team session.

## Communication Model

Think of the team as remote employees communicating asynchronously:

| Channel                         | Analogy                      | When to Use                                                            |
| :------------------------------ | :--------------------------- | :--------------------------------------------------------------------- |
| Direct conversation log         | Walking up to someone's desk | Rare — synchronous, used by the user to interact with the orchestrator |
| `SendMessage` between teammates | Email / Slack DMs            | The norm — async peer-to-peer coordination                             |
| `SendMessage` broadcast         | All-hands announcement       | Critical blocking issues only                                          |
| Shared files in `.claude/tmp/`  | Shared drive / wiki          | Reports, findings, deliverables                                        |

**User interaction model:**

- Users interact with teammates like other people in the organization — they may reach out on external platforms
- Users will never be expected to message teammates via the direct conversation interface
- The orchestrator is the primary point of contact between the user and the team

## Message Routing

| Situation                                   | Send To                                          | Tool                                           |
| :------------------------------------------ | :----------------------------------------------- | :--------------------------------------------- |
| Task complete                               | Team lead or PM                                  | `SendMessage` type `message`                   |
| Something went wrong                        | AI Agent Eng (Wile E. Coyote) AND team lead | `SendMessage` type `message`                   |
| Status update                               | PM (Elmer Fudd) if launched, otherwise team lead | `SendMessage` type `message`                   |
| Spec contradiction or undocumented behavior | AI Agent Eng AND Docs Writer                | `SendMessage` type `message`                   |
| Defect found                                | PM or team lead                                  | `SendMessage` type `message`                   |
| Research findings                           | Team lead (summary), save full report to file    | `SendMessage` type `message`                   |
| Peer coordination                           | The teammate directly                            | `SendMessage` type `message`                   |
| Critical blocking issue for everyone        | All teammates                                    | `SendMessage` type `broadcast` (use sparingly) |

## Rules

1. **Always verify recipients exist before sending.** The `SendMessage` tool returns success even if the recipient doesn't exist. Check the team config or ask the lead who is available.
2. **Collaborate directly with peers.** If you need something from another teammate, message them — don't wait for the orchestrator to relay. Keep the AI Agent Eng and orchestrator informed afterward.
3. **Default to messaging the team lead** if you're unsure who should receive a message.
4. **Use `broadcast` sparingly** — it sends one message per teammate and is expensive.
5. **Never send large reports in messages.** Save reports to files (in `.claude/tmp/`) and send a summary with the file path.
6. **Idle notifications are automatic and normal.** Teammates go idle after every turn. Do not treat idle as "done" or "broken."
7. **Do not send structured JSON** status messages. Use plain text. Use `TaskUpdate` to mark tasks complete.

## Failure Reporting

When something goes wrong, message the AI Agent Eng with:

- **What happened** — specific description
- **What you expected** — what should have happened
- **What you tried** — any recovery attempts
- **Impact** — what's blocked or broken

The AI Agent Eng records failures but does NOT fix them. Fixes are coordinated by the team lead or PM.

## Shared State

- **Task list**: Use `TaskCreate`, `TaskUpdate`, `TaskList` — all teammates share the same task list
- **Files**: Use `.claude/tmp/` for team working files (NOT `/tmp/`)
- **Team config**: Read `~/.claude/teams/{team-name}/config.json` to discover teammates

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
