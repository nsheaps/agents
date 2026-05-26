---
type: feature
id: GSD-22
state: in-progress
created: 2026-05-25T23:38:45Z
project: GSD
assignee: contacts://heaps-group/byGithubAppUrl/https%3A%2F%2Fgithub.com%2Fapps%2Falex-nsheaps
requester: contacts://heaps-group/byGithubUsername/nsheaps
milestone: ../../milestones/M2.md
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508615338802286592
  - id: pr-18
    type: github-pr
    url: https://github.com/nsheaps/.ai-agent-alex/pull/18
events:
  - { ts: 2026-05-25T23:38:45Z, by: alex, change: "created from Nate Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-25T23:42:00Z,
      by: alex,
      change: "PR #18 opened with hook + settings.json wiring + unit tests",
    }
---

# GSD-22 — Force-background Agent() PreToolUse hook

## Original ask

From Nate Discord [`1508615338802286592`][^discord-ask] (2026-05-25 23:38Z):

> please make sure you're always running Agent() with run-in-background=true. Add a ticket that you prioritize to do right now that you fix your hooks in your repo so that any call to Agent() gets modified to always set run-in-background to true regardless of not set or set to false. if not set, warn that they should always be run in the background, even though the tool doesn't default to that. It is important to do things asynchronously, and running without the flag or set to false forces foreground work until a timeout is hit. Its better to have the agent in the background and you go idle, than to keep that one agent in the foreground. if set to false, it should warn a bit more loudly but still permit the tool use. Both should end with a "Your Agent() has been forced to the background. If this is an issue stop the task immediately."
>
> Tag me when you have a PR for that change.

## User story

- **As Alex (the agent)**, I want every `Agent()` tool call to land in the background regardless of the `run_in_background` field I pass, **so that** the main session stays responsive to handler messages while subagents do their work — foreground dispatches block the main loop until timeout.

## Stakeholders

- Nate (handler) — observes responsiveness as a quality signal
- Alex (self) — the rule subject
- Other agents (Henry, Jack) — pattern they should adopt too (captured as follow-up below)

## Requirements

- PreToolUse hook at `.claude/hooks/force-background-agent.sh` matched on `Agent` tool
- `run_in_background: true` → no-op (silent pass-through)
- `run_in_background` unset → warn + mutate to `true`
- `run_in_background: false` → LOUD warn + mutate to `true`
- Every modified call's `systemMessage` ends with: "Your Agent() has been forced to the background. If this is an issue stop the task immediately."
- Wired in `.claude/settings.json` PreToolUse for matcher `Agent`

## Acceptance criteria

- [x] Hook script written + executable
- [x] settings.json wired
- [x] Unit-tested all 3 inbound cases via shell harness — outputs verified
- [ ] PR merged (PR [#18][^pr-18])
- [ ] Live verification post-merge: trigger an Agent() call and confirm hook fires + force-backgrounds

## Implementation

- PR [#18][^pr-18] on `nsheaps/.ai-agent-alex` (branch `feat/force-background-agent-hook`, commit `532c485`)
- Uses jq `has("run_in_background")` to distinguish unset vs false (jq's `//` coalesces false → would mis-classify)
- Emits `hookSpecificOutput.updatedInput` per Claude Code hooks contract

## Follow-ups (out of scope)

- Propagate to Henry + Jack repos (same hook + wiring)
- Eventually move into a shared plugin so the rule is centrally maintained

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508615338802286592

[^pr-18]: https://github.com/nsheaps/.ai-agent-alex/pull/18
