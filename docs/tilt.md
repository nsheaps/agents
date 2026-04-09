# Tilt for agent tmux sessions

This repo ships a basic `Tiltfile` that manages the Jack and Henry agents as
Tilt `local_resource`s. Each resource owns a named tmux session on the host,
runs the agent's `bin/agent` inside it, and tails the Claude Code transcript
through a simple reformatter so the Tilt UI shows a readable stream of
user/assistant messages.

This is intentional scaffolding only. A richer stream formatter with tool-call
decoration and syntax highlighting is out of scope and tracked separately, as
is stall detection.

## Prerequisites

- [Tilt](https://docs.tilt.dev/install.html)
- [tmux](https://github.com/tmux/tmux/wiki)
- `python3` and `jq` on `PATH`
- Jack and Henry repos checked out at the expected paths:
  - `/home/nsheaps/src/nsheaps/.ai-agent-jack`
  - `/home/nsheaps/src/nsheaps/.ai-agent-henry`
- Each repo must have a working `bin/agent` entrypoint.

If your checkout paths differ, edit the `AGENTS` dict at the top of
`Tiltfile`.

## Launching

From the repo root:

```bash
tilt up
```

The Tilt UI opens at <http://localhost:10350>. You will see two resources
under the `agents` label: `jack` and `henry`. Both are configured with
`TRIGGER_MODE_MANUAL` and `auto_init=False`, so neither starts automatically.

Click the trigger button (or the resource name) to start an agent. Tilt will:

1. Create a detached tmux session with the agent's repo as cwd
2. Run `bin/agent` inside that session
3. Wait for the agent to write its Claude Code session id to
   `<repo>/.claude/tmp/session-id`
4. Start tailing the corresponding transcript jsonl from
   `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` through
   `scripts/tail-transcript.sh`

The Tilt UI logs pane will show a simplified stream like:

```
[USER 2026-04-09T15:58:19] hello jack, what's on the agenda today?
[ASST 2026-04-09T15:58:22] Pulling recent PRs and messages now...
```

## Attaching to the real tmux session

Tilt only tails the transcript. To actually interact with the agent, attach to
the tmux session directly in another terminal:

```bash
tmux attach -t jack
# or
tmux attach -t henry
```

Detach with `Ctrl-b d` — the session keeps running and Tilt continues tailing
the transcript.

## Stopping

- Clicking the stop button on a resource in the Tilt UI terminates the
  `serve_cmd` (the tail process). The tmux session keeps running so you do
  not lose the agent.
- To fully stop an agent: `tmux kill-session -t jack` (or `henry`).
- `tilt down` shuts down Tilt itself but, again, leaves any running tmux
  sessions untouched.

## Files

- `Tiltfile` — declares the two `local_resource`s
- `scripts/agent-serve.sh` — creates/attaches to a tmux session and resolves
  the transcript path
- `scripts/tail-transcript.sh` — parses the jsonl and prints simplified
  user/assistant lines
