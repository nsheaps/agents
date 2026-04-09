# Tiltfile for nsheaps/agents — manages Jack and Henry tmux sessions.
#
# Each agent runs in a named tmux session on this machine. Tilt's serve_cmd
# creates or attaches to the session, runs bin/agent inside it, and then
# tails the Claude Code transcript jsonl through a basic reformatter so the
# Tilt UI shows a readable stream of user/assistant messages.
#
# Launch:
#     tilt up
# Then click the `jack` or `henry` resource in the Tilt UI to start it. The
# resources use TRIGGER_MODE_MANUAL + auto_init=False so neither agent is
# started automatically — you choose when each one runs.
#
# To attach to the actual tmux session for interactive use:
#     tmux attach -t jack
#     tmux attach -t henry
#
# Out of scope for this scaffolding:
#   - Rich stream formatting with tool-call decoration / syntax highlighting
#   - Stall detection via periodic snapshots (tracked separately)
#   - Rebuilding bin/agent — it lives in each agent's own repo

AGENTS = {
    "jack": "/home/nsheaps/src/nsheaps/.ai-agent-jack",
    "henry": "/home/nsheaps/src/nsheaps/.ai-agent-henry",
}

for name, repo in AGENTS.items():
    local_resource(
        name,
        cmd="true",  # no-op build — nothing to compile here
        serve_cmd="./scripts/agent-serve.sh {} {}".format(name, repo),
        trigger_mode=TRIGGER_MODE_MANUAL,
        auto_init=False,
        labels=["agents"],
    )
