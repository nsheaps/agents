---
type: feature
created: 2026-05-25T20:28:02Z
state: to-triage
priority: 1
project: GSD
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: discord-ask
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1508567250225856522
events:
  - { ts: 2026-05-25T20:28:02Z, by: alex, change: "created from Discord ask[^discord-ask]" }
  - {
      ts: 2026-05-26T01:18:27Z,
      by: alex,
      change: "priority (unset) → 1 per Nate Discord[^discord-prio]",
    }
---

# Launcher --init-only: visible output + per-section timing summaries

## Original Discord message

> lets add another triage ticket, the launcher when it runs --init-only. A) it'd be nice if there was some output there, maybe we can run claude-stream on transcript from it or whatever? B) it needs to time each section, so the logs don't just have the timing info from when the log is written, but a summary after each, `[pre-pass] finished. took 34s` so it's easier to parse, especially if they're done in parallel (which may later be handled by nx?)

Source: Discord msg[^discord-ask] (2026-05-25 20:27Z)

## Goal

Make the launcher's `--init-only` pre-pass observable + per-section timing legible, so an operator (or a parser) can tell what's happening and how long each phase took without doing arithmetic on log-line timestamps.

## Why now

Currently `bin/agent` runs `claude --init-only --dangerously-skip-permissions` to fire SessionStart hooks before the real claude invocation. The output goes... somewhere quiet, and there's no per-section timing. When things go slow during init (e.g. marketplace update is hanging, mise tool install pulled a new version), the operator can only see line-timestamps and has to mentally diff them. With nx-style parallelization (likely future), this becomes much worse.

## Requirements

### A. Output / observability from `--init-only`

- Some real-time signal that the `--init-only` claude is actually running, not hung. Options:
  - Pipe its transcript through `claude-stream` (if that surfaces hook output legibly).
  - Capture stdout/stderr to the launcher log instead of discarding.
  - Tail the session transcript JSONL as it's written.
- Goal: an operator watching the launcher start sees what hook is currently firing, not just silence.

### B. Per-section timing summaries

- After each launcher section completes (`[pre-pass]`, `[marketplace]`, `[op-inject]`, `[gh-auth]`, `[direnv]`, `[seed]`, etc.), emit a summary line of the form:

  ```
  [<section>] finished. took <N>s
  ```

- The line-timestamp at the START of the section + the summary line at the END together give clean parse-able boundaries.
- Distinct from the existing per-line timestamps, which only tell you when each log line was written, not how long the section took.

### C. (Probable future) parallelization

- If sections run in parallel (e.g. nx-driven), per-section timing matters MORE because the summary lines no longer flow in start-order. Each section should self-report its elapsed time.
- This ticket is NOT asking for the parallelization itself — just that the timing-summary format works whether sections run serial OR parallel.

## Acceptance criteria

- A launcher start log shows `[<section>] finished. took <N>s` after each major section.
- `--init-only` claude's hook output is visible during launcher start (mechanism TBD — claude-stream, direct stderr capture, or transcript tail).
- Parsing the log to answer "how long did `[marketplace]` take?" is one regex match, not arithmetic.

## Notes

- Adjacent to the existing launcher-log mechanism in `bin/agent` (the `log()` function that prefixes `[YYYY-MM-DD HH:MM:SS]`).
- claude-stream tool: unclear what it does — needs research as part of triage. If it's the right tool, the implementation may be small.
- nx parallelization: speculative — flagged as a forcing function for the timing-format, not as in-scope work.

[^discord-ask]: https://discord.com/channels/1490863845252665415/1497431286661517353/1508567250225856522

[^discord-prio]: <https://discord.com/channels/1490863845252665415/1497431286661517353/1508640427283185684>
