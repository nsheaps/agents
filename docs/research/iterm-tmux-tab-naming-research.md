# Research: iTerm2/tmux Tab Naming for Agent Panes

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-17
**Question**: How can we make iTerm2 tabs (via tmux -CC) show agent names instead of auto-generated summary titles when running Claude Code agent teams?

## Answer

There are **three viable approaches**, each operating at a different layer. The recommended approach is a **SessionStart hook** that calls `tmux rename-window` — it's the simplest, requires no changes to Claude Code, and works today. The evidence suggests this is achievable with roughly 5 lines of shell script.

## Background: How iTerm2 + tmux -CC Handles Titles

### Architecture

When running `tmux -CC` (control mode) with iTerm2:

- Each **tmux window** maps to an **iTerm2 tab**
- Each **tmux pane** within a window maps to an **iTerm2 split pane**
- iTerm2 subscribes to the tmux control mode protocol and receives `%window-renamed` notifications when window names change

### Title Hierarchy

tmux has three distinct naming concepts:

| Concept            | Set By                                          | Shown In                                                                     | Relevant To Us                                        |
| :----------------- | :---------------------------------------------- | :--------------------------------------------------------------------------- | :---------------------------------------------------- |
| **Window name**    | `tmux rename-window` or `automatic-rename`      | iTerm2 tab title                                                             | **YES** — this is what the user sees as the tab label |
| **Pane title**     | `select-pane -T` or `printf '\033]2;title\007'` | Per-pane title bar (if enabled in iTerm2 → Preferences → Appearance → Panes) | Useful if multiple panes per window                   |
| **Terminal title** | `set-titles` + `set-titles-string`              | iTerm2 window title bar                                                      | Less relevant — only affects the overall window       |

**Confidence**: High — verified from [iTerm2 tmux docs](https://iterm2.com/documentation-tmux-integration.html), [tmux Control Mode wiki](https://github.com/tmux/tmux/wiki/Control-Mode), and [tmux Advanced Use wiki](https://github.com/tmux/tmux/wiki/Advanced-Use).

### iTerm2 tmux Title Configuration

For iTerm2 3.3.0+ with tmux 2.9+, add to `~/.tmux.conf`:

```
set-option -g set-titles on
set-option -g set-titles-string '#T'
```

**Critical caveat**: After changing `set-titles`, you must detach and reattach to tmux for the change to take effect — it's only checked once when tmux integration begins.

**Confidence**: High — [iTerm2 tips gist](https://gist.github.com/drofp/a0255cfb8b65e086039838f34dc43de0).

## How Claude Code Spawns Teammate Panes

### Current Behavior (from GitHub issues and docs)

1. Claude Code creates teammate panes via `tmux split-window` within the current window
2. It then uses `tmux send-keys` to send the Claude Code launch command to the new pane
3. There is a known race condition with `send-keys` when 4+ agents spawn simultaneously ([#23615](https://github.com/anthropics/claude-code/issues/23615))
4. There is **no evidence** that Claude Code sets pane titles or window names when spawning teammates

### Known Issues

- Pane splitting corrupts `send-keys` at scale ([#23615](https://github.com/anthropics/claude-code/issues/23615))
- Feature requests exist for spawning in separate windows instead of panes ([#25396](https://github.com/anthropics/claude-code/issues/25396), [#23615](https://github.com/anthropics/claude-code/issues/23615))
- The tab title currently shows whatever the shell or Claude Code process sets as the terminal title — usually a summary of the running command

**Confidence**: High — verified from GitHub issues [#23615](https://github.com/anthropics/claude-code/issues/23615), [#25396](https://github.com/anthropics/claude-code/issues/25396).

### What Environment Variables Are Available

From the [hooks documentation](https://code.claude.com/docs/en/hooks):

- `TeammateIdle` hooks receive `teammate_name` and `team_name`
- `TaskCompleted` hooks receive `teammate_name` and `team_name`
- `SessionStart` hooks receive `session_id`, `source`, `model`, and optionally `agent_type`
- **`SessionStart` does NOT document `teammate_name`** in its input schema

However, from the [agent teams docs](https://code.claude.com/docs/en/agent-teams) and community sources, `CLAUDE_CODE_AGENT_NAME` is referenced as an environment variable available to teammate processes. The `agent_type` field in SessionStart input contains the agent name when launched with `claude --agent <name>`.

**Confidence**: Medium — the env var is referenced in community sources but not explicitly in the official SessionStart input schema. Needs testing.

## Three Approaches

### Approach 1: SessionStart Hook (RECOMMENDED)

Use a `SessionStart` hook to rename the tmux window/pane when each agent starts.

**How it works:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/set-pane-title.sh"
          }
        ]
      }
    ]
  }
}
```

**Hook script** (`.claude/hooks/set-pane-title.sh`):

```bash
#!/bin/bash
# Read hook input to get agent_type
INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

# Fallback to env var if agent_type not in hook input
AGENT_NAME="${AGENT_TYPE:-${CLAUDE_CODE_AGENT_NAME:-claude}}"

# Set the tmux window name (shows as iTerm2 tab title)
tmux rename-window "$AGENT_NAME" 2>/dev/null || true

# Also set the pane title (shows in per-pane title bar)
tmux select-pane -T "$AGENT_NAME" 2>/dev/null || true

# Disable automatic rename so the title sticks
tmux set-window-option automatic-rename off 2>/dev/null || true

exit 0
```

**Pros:**

- Works today, no Claude Code changes needed
- Runs automatically when each agent starts
- Uses official hook system
- Simple (~10 lines of shell)

**Cons:**

- `agent_type` in SessionStart input may not contain the display name — it may be the agent type slug (e.g., `deep-researcher` not `Road R (researcher)`)
- `CLAUDE_CODE_AGENT_NAME` availability in the hook environment is not 100% confirmed
- If Claude Code or the shell sets the terminal title after the hook runs, it could override the name
- The `automatic-rename off` setting may need to persist across the session

**Confidence**: Medium-High — the mechanism is sound, but the exact variable available for the agent name needs testing.

### Approach 2: Agent-Level tmux Command (In Agent Prompt)

Have each agent run `tmux rename-window` as its first action via a behavior doc or system prompt instruction.

````markdown
## Session Start Behavior

When you start a session, immediately run:

```bash
tmux rename-window "Road R (researcher)" && tmux set-window-option automatic-rename off
```
````

**Pros:**

- Fully within agent-team's control
- Can use the exact display name
- No hook configuration needed

**Cons:**

- Relies on the agent actually executing the command
- Adds noise to the agent's transcript
- The agent could forget or deprioritize it
- Each agent definition needs the command customized

**Confidence**: Medium — works mechanically but relies on LLM compliance.

### Approach 3: Launcher Sets Title at Spawn Time

Modify the agent-team launcher (`bin/agent-team`) to call `tmux rename-window` after spawning each pane.

```bash
# After spawning the pane:
tmux rename-window -t "$pane_target" "$agent_display_name"
tmux select-pane -t "$pane_target" -T "$agent_display_name"
```

**Pros:**

- Most reliable — happens at infrastructure level
- Uses the exact display name from the agent config
- No dependency on hooks or agent behavior

**Cons:**

- Requires launcher code changes
- Only applies when using our custom launcher, not native Claude Code `--teammate-mode tmux`
- Needs to handle the timing correctly (after `split-window` but before the command runs)

**Confidence**: High for our custom launcher. Not applicable to native Claude Code spawning.

## Additional Considerations

### `automatic-rename` Must Be Disabled

By default, tmux renames windows based on the running command. This will override any title we set. The fix:

```bash
tmux set-window-option automatic-rename off
```

This must be set per-window after renaming, or globally in `~/.tmux.conf`:

```
set-option -g automatic-rename off
```

### Claude Code May Set Terminal Title

Claude Code's TUI likely sets the terminal title (OSC escape sequences) as part of its display. This could override pane titles set by escape sequences. The `tmux rename-window` approach is more robust because it operates at the tmux layer, not the terminal escape sequence layer.

### Pane Titles vs Window Names

If teammates are split panes within the same window (current Claude Code behavior):

- `rename-window` changes the tab title for ALL panes in that window — not useful for differentiating
- `select-pane -T` sets per-pane titles, shown in the pane title bar

If teammates are in separate windows (requested in [#25396](https://github.com/anthropics/claude-code/issues/25396)):

- `rename-window` gives each tab a distinct name — this is the ideal case

**Current recommendation**: Use both `rename-window` (for the tab) and `select-pane -T` (for the pane title bar). When Claude Code switches to per-window spawning, `rename-window` will be the primary mechanism.

### iTerm2 Pane Title Bar

To see per-pane titles in iTerm2:

- iTerm2 → Preferences → Appearance → Panes → Check "Show per-pane title bar with split panes"

This is off by default. Users need to enable it to see pane-level titles when multiple panes share a window.

## Recommended Implementation

### Immediate (Phase 1): SessionStart Hook

1. Create `.claude/hooks/set-pane-title.sh` per the script above
2. Add the hook to `.claude/settings.json` (or `.claude/settings.local.json`)
3. Test with a single agent to verify `agent_type` or `CLAUDE_CODE_AGENT_NAME` is available
4. If neither is available, fall back to reading the agent name from stdin's hook input or env vars

### Next (Phase 2): Launcher Integration

When the custom launcher is ready:

1. After `tmux split-window` (or `tmux new-window`), call `tmux rename-window` with the agent's display name
2. Call `tmux select-pane -T` with the display name
3. Set `automatic-rename off` on the window

### tmux.conf Prerequisites

Add to `~/.tmux.conf` (or document as a setup requirement):

```
# Show tmux titles in iTerm2 tabs
set-option -g set-titles on
set-option -g set-titles-string '#T'

# Show pane title in border (for split pane mode)
set-option -g pane-border-status top
set-option -g pane-border-format " #{pane_index}: #{pane_title} "
```

## Open Questions

1. **Is `CLAUDE_CODE_AGENT_NAME` available in SessionStart hook environment?** Needs empirical testing. The `agent_type` field in SessionStart input is documented, but its exact value for custom agents (slug vs display name) is unclear.
2. **Does Claude Code override pane/window titles after startup?** If so, the hook might need to run periodically or use a different mechanism.
3. **When Claude Code adds per-window spawning ([#25396](https://github.com/anthropics/claude-code/issues/25396)), will it set window names?** If Anthropic adds native title support, our hook becomes unnecessary.

## Confidence Levels

| Finding                                                              | Confidence  |
| :------------------------------------------------------------------- | :---------- |
| iTerm2 tabs reflect tmux window names in -CC mode                    | High        |
| `tmux rename-window` works in control mode (sends `%window-renamed`) | High        |
| `select-pane -T` sets per-pane titles                                | High        |
| `automatic-rename off` is needed to preserve titles                  | High        |
| SessionStart hook can call tmux commands                             | High        |
| `agent_type` or `CLAUDE_CODE_AGENT_NAME` available in SessionStart   | Medium      |
| Claude Code doesn't set pane titles when spawning teammates          | Medium-High |
| Claude Code may override titles via terminal escape sequences        | Medium      |

## Sources

- [iTerm2 tmux Integration Docs](https://iterm2.com/documentation-tmux-integration.html)
- [iTerm2 Session Title Docs](https://iterm2.com/documentation-session-title.html)
- [tmux Control Mode Wiki](https://github.com/tmux/tmux/wiki/Control-Mode)
- [tmux Advanced Use Wiki](https://github.com/tmux/tmux/wiki/Advanced-Use) — pane titles, window names
- [iTerm2 tmux Tips Gist](https://gist.github.com/drofp/a0255cfb8b65e086039838f34dc43de0)
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — SessionStart, TeammateIdle, env vars
- [GitHub #23615: Agent teams should spawn in new tmux window](https://github.com/anthropics/claude-code/issues/23615)
- [GitHub #25396: Spawn teammates in separate tmux windows](https://github.com/anthropics/claude-code/issues/25396)
- [tmux Issue #680: Set pane title](https://github.com/tmux/tmux/issues/680)
- [How to Rename a Pane in tmux](https://www.codegenes.net/blog/how-do-i-rename-a-pane-in-tmux/)
