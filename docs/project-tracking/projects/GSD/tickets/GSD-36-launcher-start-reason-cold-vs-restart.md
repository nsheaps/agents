---
type: feature
id: GSD-36
legacy_ids:
  - "1779740986"
created: 2026-05-25T20:29:46Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-611"
    note: "#611: AGENT(triager-v2): Process to-triage chronologically per new spec (14 items)"
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508567575733469214
  - id: discord-prio
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684
events:
  - { ts: 2026-05-25T20:29:46Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:18:27Z,
      by: alex,
      change: "priority (unset) → 1 per Nate Discord[^discord-prio]",
    }
  - {
      ts: 2026-05-26T01:40:00Z,
      by: alex-triager,
      change: "promoted to-triage → GSD-36 (state=triage) per triager-v2 workflow",
    }
---

# Launcher: tell the agent in the start-prompt whether this was a cold launch or a normal restart

## Original ask

> the launch prompt to the agent should specify if it was a cold launch (system just turned on, or agent died and tmux shell or launcher were killed), or the launcher restarted it because claude exited (normal restart)

Source: Discord msg[^discord-ask] (2026-05-25 20:28Z)

## Goal

When `bin/agent` constructs the prompt it hands to the freshly-spawned claude process, include a line that classifies WHY claude is starting: cold launch (system just booted, or tmux/launcher were killed) vs normal restart (claude exited cleanly and the launcher loop respawned it). The agent reads this and can adjust its first-tick behavior — recover crons/monitors aggressively on cold, lighter-touch on restart.

## Why now

Right now the agent can't tell, from the start prompt alone, whether it's coming up after a hard crash (in which case nothing in-memory survived — Monitors gone, Crons gone, background shells gone, subagent dispatches gone) vs a soft restart triggered by something benign (claude exited because /agentic-behavior:exit was called for a config-pickup, the previous session is still very recent and most state CAN be re-established cleanly).

The agent currently has to infer this from indirect signals:

- `.claude/scheduled-tasks.yaml` always-re-create-via-CronList-dedupe (works but heuristic)
- Time since last journal entry / commit (proxy)
- Whether continuation prompt is empty

A direct signal from the launcher would let the agent just KNOW.

## Requirements

- `bin/agent` knows (or can derive) why it's spawning claude this iteration:
  - **cold:** first iteration of this launcher process (the `while true; do claude; done` loop's first pass), OR the previous claude exit code suggests a crash (non-zero, SIGKILL), OR system uptime is shorter than launcher uptime (system rebooted under us).
  - **restart:** subsequent iterations where the previous claude exit was clean (exit 0, or known-clean signals like SIGINT from `/agentic-behavior:exit`).
- The classification is included in the prompt fed to claude as something the agent can read on first tick. E.g. a line in the launcher-log block: `[start-reason] cold` or `[start-reason] restart-after-clean-exit`.

## Acceptance criteria

- A fresh `tmux new-session` → first claude in the prompt sees `[start-reason] cold` (or equivalent).
- A `/agentic-behavior:exit` → launcher respawn → next claude sees `[start-reason] restart` (or equivalent).
- A `kill -9 <claude-pid>` → launcher respawn → next claude sees `[start-reason] cold` (or whatever the crash classification is).
- The agent's session-startup logic uses this to decide how aggressively to re-bootstrap crons/monitors.

## Notes

- Adjacent to the existing launcher-log + continuation-prompt construction in `bin/agent`.
- Related to GSD-35 (launcher --init-only output/timing) — both touch the launcher's observability surface but address different needs.
- Likely interacts with `scheduled-tasks.yaml` rule: on cold start, the rule says "always CronList-dedupe before recreating" — that's still correct, but with this signal the agent can do MORE (e.g. on cold also re-dispatch any AGENT(...) tasks that were in_progress at last known checkpoint).

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508567575733469214

[^discord-prio]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684
