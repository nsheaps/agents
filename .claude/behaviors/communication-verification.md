---
name: communication-verification
description: Verify recipients and preserve deliverables before sending messages. Use EVERY time you send a message or deliver work output. Prevents lost work from communication errors.
---

# Communication Verification

Procedure for ensuring messages reach the right recipients and deliverables are never lost. 3 of 9 logged failures involved messages sent to non-existent or incorrectly-named recipients, resulting in 5+ lost deliverables.

## Purpose

Prevent data loss from communication errors. Every message should reach its intended recipient, and every deliverable should be preserved in a file regardless of whether the message succeeds.

## When to Use

- Before EVERY SendMessage call (no exceptions)
- When delivering research, reports, or any substantive work output
- After compaction (your mental model of the team roster may be corrupted)
- When you're unsure of a teammate's exact name

## Steps

1. **Save deliverables to files first** — Before sending any substantive work output:
   - Write the full content to a file (typically `.claude/tmp/{topic}.md` or `docs/research/{topic}.md`)
   - Commit if the content should be preserved long-term
   - The message should contain a summary and the file path, NOT the full content

   Pattern:

   ```
   Save report to .claude/tmp/{topic}.md
   Send message: "Report saved to [path]. Key findings: [3 bullets max]"
   ```

2. **Verify recipient name from team config** — Before every SendMessage:
   - Read `~/.claude/teams/{team-name}/config.json`
   - Find the intended recipient in the `members` array
   - Use the exact `name` field value — do not guess, abbreviate, or assume

3. **Know that SendMessage silently succeeds for invalid recipients** — The platform returns success even when the recipient doesn't exist. You will NOT get an error. This is why step 2 is mandatory — you cannot rely on the tool to catch mistakes.

4. **Use "team-lead" as fallback** — If you cannot find the intended recipient in the config:
   - Send to "team-lead" instead
   - Explain who you were trying to reach and why
   - Do NOT send to a guessed name

5. **Post-compaction name refresh** — After any compaction:
   - Re-read team config before sending ANY messages
   - Your memory of teammate names may be corrupted by the compaction summary
   - Verify every name, even ones you're "sure" about

6. **Escalate on silence** — If you send an important message and get no response within a reasonable time:
   - Do NOT re-send to the same recipient
   - Escalate to team-lead: "I sent [summary] to [recipient] but got no response. Can you verify they received it?"

## Related Behaviors

- **[failure-reporting.md](failure-reporting.md)** — When communication fails or deliverables are lost, use the failure reporting behavior to document the incident and prevent recurrence.

## Anti-Patterns

- Sending full reports in message content instead of saving to files first
- Guessing recipient names from role descriptions instead of reading team config
- Assuming a name is correct because "it sounds right"
- Re-sending to the same potentially-wrong recipient without verifying
- Trusting your post-compaction memory of teammate names
- Sending to multiple guessed variations of a name hoping one works
- Not escalating when messages seem to disappear
