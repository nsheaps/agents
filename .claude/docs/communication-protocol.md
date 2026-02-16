# Communication Protocol

How teammates communicate within an agent team session.

## Message Routing

| Situation                                   | Send To                                          | Tool                                           |
| :------------------------------------------ | :----------------------------------------------- | :--------------------------------------------- |
| Task complete                               | Team lead or PM                                  | `SendMessage` type `message`                   |
| Something went wrong                        | Coach (Wile E. Coyote) AND team lead             | `SendMessage` type `message`                   |
| Status update                               | PM (Elmer Fudd) if launched, otherwise team lead | `SendMessage` type `message`                   |
| Spec contradiction or undocumented behavior | Coach AND Technical Writer                       | `SendMessage` type `message`                   |
| Defect found                                | PM or team lead                                  | `SendMessage` type `message`                   |
| Research findings                           | Team lead (summary), save full report to file    | `SendMessage` type `message`                   |
| Critical blocking issue for everyone        | All teammates                                    | `SendMessage` type `broadcast` (use sparingly) |

## Rules

1. **Always verify recipients exist before sending.** The `SendMessage` tool returns success even if the recipient doesn't exist. Check the team config or ask the lead who is available.
2. **Default to messaging the team lead** if you're unsure who should receive a message.
3. **Use `broadcast` sparingly** — it sends one message per teammate and is expensive.
4. **Never send large reports in messages.** Save reports to files (in `.claude/tmp/`) and send a summary with the file path.
5. **Idle notifications are automatic and normal.** Teammates go idle after every turn. Do not treat idle as "done" or "broken."
6. **Do not send structured JSON** status messages. Use plain text. Use `TaskUpdate` to mark tasks complete.

## Failure Reporting

When something goes wrong, message the Coach with:

- **What happened** — specific description
- **What you expected** — what should have happened
- **What you tried** — any recovery attempts
- **Impact** — what's blocked or broken

The Coach records failures but does NOT fix them. Fixes are coordinated by the team lead or PM.

## Shared State

- **Task list**: Use `TaskCreate`, `TaskUpdate`, `TaskList` — all teammates share the same task list
- **Files**: Use `.claude/tmp/` for team working files (NOT `/tmp/`)
- **Team config**: Read `~/.claude/teams/{team-name}/config.json` to discover teammates

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
