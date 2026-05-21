---
name: tmux-usage
description: Use when working with tmux in Claude Code agent team sessions. Covers core tmux concepts, pane/window management, session attachment, and agent-team-specific tmux patterns. Trigger phrases — "tmux", "terminal multiplexer", "attach to session", "split panes", "switch windows", "tmux shortcuts".
---
# tmux Usage for Agent Teams

How to use tmux effectively when working with Claude Code agent teams.

## General tmux Concepts

tmux is a terminal multiplexer — it lets you run multiple terminal sessions inside a single window, detach from them, and reattach later. Agent teams use tmux as the backend for visible teammate panes.

### Core Hierarchy

```
Server (one per user, runs in background)
  └── Session (named group of windows)
        └── Window (like a tab)
              └── Pane (split within a window)
```

### Essential Commands

| Command                       | What It Does                  |
| :---------------------------- | :---------------------------- |
| `tmux new-session -s name`    | Create a named session        |
| `tmux attach -t name`         | Attach to an existing session |
| `tmux detach` (or `Ctrl+B d`) | Detach from current session   |
| `tmux list-sessions`          | List all sessions             |
| `tmux list-panes -t session`  | List panes in a session       |
| `tmux kill-session -t name`   | Kill a session                |
| `tmux kill-server`            | Kill all sessions             |

### Prefix Key

tmux commands inside an attached session start with a **prefix key** (default: `Ctrl+B`). After pressing the prefix:

| Key        | Action                                 |
| :--------- | :------------------------------------- |
| `d`        | Detach                                 |
| `%`        | Split pane vertically                  |
| `"`        | Split pane horizontally                |
| Arrow keys | Move between panes                     |
| `[`        | Enter copy/scroll mode (exit with `q`) |
| `z`        | Toggle pane zoom (fullscreen)          |

Source: [tmux Getting Started](https://github.com/tmux/tmux/wiki/Getting-Started)

## Claude Code Agent Teams and tmux

When `teammateMode` is set to `tmux`, Claude Code uses tmux to create visible panes for each teammate. The lead session manages the tmux layout automatically.

### How It Works

1. The lead session starts (either inside an existing tmux session, or via `tmux -CC` for iTerm2)
2. When teammates are spawned via the `Task` tool, Claude Code creates new tmux panes
3. Each pane runs an independent Claude Code session
4. The lead manages the pane layout — you don't need to manually split panes

### Keyboard Controls (Claude Code specific)

These work within the Claude Code UI, not at the tmux level:

| Control       | Function                                                           |
| :------------ | :----------------------------------------------------------------- |
| Shift+Up/Down | Cycle through teammates (in-process mode)                          |
| Ctrl+T        | Toggle task list                                                   |
| Ctrl+O        | Toggle verbose transcript (shows tool usage and execution details) |
| Shift+Tab     | Toggle permission mode (lead coordination only)                    |
| Escape        | Interrupt teammate's turn                                          |

### tmux -CC Control Mode (iTerm2)

When running in iTerm2 outside a tmux session, Claude Code uses `tmux -CC` (control mode). Instead of rendering the green tmux status bar and using prefix keys, tmux sends structured text commands to iTerm2, which renders them as native macOS windows and tabs.

**What changes in control mode:**

- Teammate panes appear as native iTerm2 splits or tabs
- Native trackpad scrolling, Cmd+C/V, Cmd+F search all work
- No tmux prefix key needed — interact with panes by clicking
- Session persists even if iTerm2 quits (reconnect with `tmux -CC attach`)

**How `claude-team` handles this:**

```bash
# If not already in a tmux session and tmux mode is selected:
exec tmux -CC new-session -- claude --dangerously-skip-permissions "${TEAM_FLAGS[@]}"
```

The `claude-team` helper auto-launches `tmux -CC` when needed, so users don't have to start tmux manually.

Sources: [tmux Control Mode Wiki](https://github.com/tmux/tmux/wiki/Control-Mode), [iTerm2 tmux Integration](https://iterm2.com/documentation-tmux-integration.html)

## Sending Commands to tmux Panes Programmatically

### `tmux send-keys`

Sends key presses to a target pane as if you typed them.

**Basic syntax:**

```bash
tmux send-keys -t <target-pane> "text to type" Enter
```

**How it works:** tmux checks each argument against a list of key names (like `Enter`, `Escape`, `Tab`, `C-c`, `C-m`). If the argument matches a key name, the corresponding key press is sent. Otherwise, the literal characters are sent.

**Key arguments (case-sensitive):**

| Argument | Key Sent                        |
| :------- | :------------------------------ |
| `Enter`  | Return/Enter key                |
| `C-m`    | Carriage return (same as Enter) |
| `Escape` | Escape key                      |
| `C-c`    | Ctrl+C (interrupt)              |
| `Tab`    | Tab key                         |
| `Space`  | Space character                 |
| `BSpace` | Backspace                       |

### GOTCHA: `Enter` Must Be a Separate Argument

This is the most common `send-keys` mistake:

```bash
# CORRECT — Enter is a separate argument, recognized as a key name
tmux send-keys -t %3 "hello world" Enter

# WRONG — Enter is inside the quotes, sent as literal characters "E-n-t-e-r"
tmux send-keys -t %3 "hello world Enter"

# WRONG — \n is not interpreted by tmux as a key press
tmux send-keys -t %3 "hello world\n"
```

The `-l` flag disables key name lookup entirely — with `-l`, `Enter` is sent as five literal characters. Don't use `-l` if you need Enter to work.

Source: [tmux send-keys reference](https://blog.damonkelley.me/2016/09/07/tmux-send-keys/), [tmux(1) man page](https://man7.org/linux/man-pages/man1/tmux.1.html)

### GOTCHA: `send-keys` May Not Actually Submit

**Sending keys to a pane does NOT guarantee the application receives or processes them.** The keys are injected into the pane's terminal input buffer, but the running application may not be in a state to accept them.

**Situations where `send-keys` appears to work but nothing happens:**

1. **Application is processing / busy** — The target application (e.g., Claude Code) is mid-execution and not reading from stdin. The keys sit in the buffer until the application next reads input, which may be never (if the application exits first) or much later.

2. **Pane is in copy mode** — If someone pressed `Ctrl+B [` to enter scroll/copy mode, the pane is no longer forwarding keys to the application. Keys are interpreted as copy-mode commands instead.

3. **Application has its own input model** — Interactive applications like Claude Code don't use simple line-based stdin. They may use raw terminal mode where Enter doesn't mean "submit" — the application controls when and how input is processed.

4. **Race conditions** — If you send keys immediately after spawning a process, the process may not have started reading input yet. There's no built-in mechanism to wait for "ready."

5. **Enter included in the quoted string** — Per the gotcha above, `"text Enter"` sends literal characters, not a key press.

6. **Claude Code requires a second Enter** — Even when `send-keys` correctly types text and sends `Enter`, Claude Code may display the text at the prompt but not process it until a **second `Enter` is sent**. This is a timing/buffering issue — Claude Code's input handler may not have been ready when the first Enter arrived, so it queued the text but didn't submit it.

**Observed in this session (two incidents):**

- An attempt to send `tmux send-keys` to a Claude Code teammate pane (QA agent) did not result in the command being submitted. The pane showed the text was typed but it was never processed.
- Foghorn (Ops Eng) confirmed the same behavior: "The text was displayed at the prompt but wasn't processed until I sent an additional Enter keypress."

**Mitigation strategies:**

- Send a second `Enter` after a short delay: `tmux send-keys -t %3 "text" Enter && sleep 1 && tmux send-keys -t %3 Enter`
- Add a `sleep` delay before `send-keys` to let the process initialize
- Use `tmux capture-pane` to check if the application is ready before sending
- For Claude Code sessions, prefer the `SendMessage` tool over `send-keys` for inter-agent communication
- Accept that programmatic input to interactive applications is inherently unreliable

### Target Pane Identifiers

Panes are identified by session, window, and pane index:

```bash
# By pane ID (most reliable — unique across sessions)
tmux send-keys -t %3 "command" Enter

# By session:window.pane
tmux send-keys -t mysession:0.1 "command" Enter

# By session name (targets the active pane)
tmux send-keys -t mysession "command" Enter
```

Pane IDs (like `%3`) are assigned by tmux and visible in the team config's `tmuxPaneId` field.

## Monitoring Panes with `capture-pane`

### `tmux capture-pane`

Captures the visible contents of a pane — useful for monitoring teammate activity without attaching.

**Basic syntax:**

```bash
# Print pane contents to stdout
tmux capture-pane -t <target-pane> -p

# Capture full scrollback history
tmux capture-pane -t %3 -p -S -

# Save to a file
tmux capture-pane -t %3 -p -S - > /tmp/pane-output.txt
```

**Useful flags:**

| Flag        | Purpose                                                           |
| :---------- | :---------------------------------------------------------------- |
| `-p`        | Print to stdout (instead of paste buffer)                         |
| `-t target` | Target pane                                                       |
| `-S start`  | Start line (`-` = beginning of history, `0` = first visible line) |
| `-E end`    | End line (`-` = end of visible content)                           |
| `-e`        | Include escape sequences (preserves colors)                       |
| `-J`        | Join wrapped lines (useful for parsing)                           |

**Use case for agent teams:** Check what a teammate is doing without switching focus:

```bash
# What's on the screen of pane %3 right now?
tmux capture-pane -t %3 -p

# Get the full scrollback
tmux capture-pane -t %3 -p -S - > /tmp/teammate-output.txt
```

Source: [tmux capture-pane guide](https://tmuxai.dev/tmux-capture-pane/), [Baeldung: tmux logging](https://www.baeldung.com/linux/tmux-logging)

## Creating Detached Sessions

### `tmux new-session -d`

Creates a new session without attaching to it — the session runs in the background.

**Syntax:**

```bash
tmux new-session -d -s <session-name> -c <working-directory> [-- command args...]
```

| Flag      | Purpose                            |
| :-------- | :--------------------------------- |
| `-d`      | Don't attach (detached/background) |
| `-s name` | Session name                       |
| `-c path` | Working directory for the session  |
| `-- cmd`  | Command to run in the session      |

**Example — launching Claude Code in background:**

```bash
# Start a Claude Code session in the background
tmux new-session -d -s agent-team -c ~/src/nsheaps/agent-team -- \
  claude --dangerously-skip-permissions --teammate-mode tmux

# Later, attach to it
tmux attach -t agent-team

# Or for iTerm2 control mode:
tmux -CC attach -t agent-team
```

**Example — launching `ct` (claude-team) in a detached session:**

```bash
tmux new-session -d -s ct-session -c ~/src/nsheaps/claude-utils -- ct --mode tmux
```

Source: [tmux Getting Started](https://github.com/tmux/tmux/wiki/Getting-Started), [tmux(1) man page](https://man7.org/linux/man-pages/man1/tmux.1.html)

## Interactive vs Non-Interactive Considerations

### The Problem

Some tools require a real interactive terminal with a human at the keyboard. They cannot be driven by `tmux send-keys` or launched in detached sessions without additional work.

### Examples

**gum (interactive TUI):**

The `claude-team` helper uses `gum choose` for the mode picker. This requires:

- A TTY (terminal) attached to stdin
- A human to make a selection
- Focus in the pane

If you launch `ct` in a detached session (`tmux new-session -d`), the gum picker will fail or hang because there's no attached terminal. You must either:

1. Attach to the session first (`tmux attach -t name`), then interact with gum
2. Skip the picker with `--mode tmux` (bypasses gum entirely)

**Observed in this session:** `ct` was launched in a detached tmux session. The gum interactive picker required the user to attach to the session and make a selection before Claude Code would start.

**Claude Code session input:**

Claude Code uses a custom terminal input model (not simple line-based stdin). Sending text via `tmux send-keys` may type the text visually but the Claude Code session may not process it as a user message. This was observed when trying to use `send-keys` to make the QA agent report its name — the text appeared but was not submitted.

**For inter-agent communication, always use `SendMessage`** instead of `send-keys`. The `SendMessage` tool is designed for this purpose and bypasses the terminal input layer entirely.

### Rules of Thumb

| Scenario                      | Works with `send-keys`?    | Better Alternative    |
| :---------------------------- | :------------------------- | :-------------------- |
| Simple shell commands         | Yes                        | —                     |
| Answering yes/no prompts      | Usually                    | `echo "y" \| command` |
| Interactive TUI (gum, fzf)    | No                         | Skip with CLI flags   |
| Claude Code user input        | Unreliable                 | `SendMessage` tool    |
| Starting a background process | Yes (via detached session) | —                     |

## Troubleshooting

### Unresponsive Teammate (Stuck Mid-Turn)

When a teammate agent is unresponsive (stuck mid-turn and not processing messages), send the ESC key via tmux to interrupt its current turn and allow pending messages to propagate:

```bash
tmux send-keys -t <pane-id> Escape
```

The pane ID can be found in the team config's `tmuxPaneId` field, or by listing panes:

```bash
tmux list-panes -a -F '#{pane_id} #{pane_title}'
```

This sends the Escape key to the target pane, which interrupts Claude Code's current turn. After the interruption, the agent will process any queued inbox messages on its next turn.

### "sessions should be nested with care"

If you try to create a tmux session while already inside one, you get this warning. Set `TMUX=''` to override, or use `tmux new-session -d` to create it detached.

### Pane ID Not Found

Pane IDs (`%N`) are ephemeral — they're assigned when the pane is created and don't persist across tmux server restarts. If a pane ID from the team config doesn't work, list current panes:

```bash
tmux list-panes -a -F "#{pane_id} #{session_name} #{pane_current_command}"
```

### Session Cleanup

After a team session ends, tmux sessions may linger. Clean up with:

```bash
# List all sessions
tmux list-sessions

# Kill a specific session
tmux kill-session -t agent-team

# Kill everything
tmux kill-server
```

## Known Claude Code + tmux Issues

Issues documented in the Claude Code GitHub repository that affect agent teams using tmux. These were discovered through research and direct experience.

| Issue                                                                                                                              | Description                                                                                                          | Impact                                           |
| :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| [#25375](https://github.com/anthropics/claude-code/issues/25375)                                                                   | Pane index mismatch — Claude Code hardcodes 0-based indexing, conflicts with user's `pane-base-index` setting        | Messages target wrong teammate pane              |
| [#23415](https://github.com/anthropics/claude-code/issues/23415), [#24108](https://github.com/anthropics/claude-code/issues/24108) | Teammate inbox never polled — spawned teammates never read inbox files on macOS tmux backend                         | Teammates stuck idle, never receive instructions |
| [#24771](https://github.com/anthropics/claude-code/issues/24771)                                                                   | Messaging disconnection with iTerm2 -CC — lead's messaging system disconnects from teammate sessions in control mode | Teammates launch but don't communicate           |
| [#23615](https://github.com/anthropics/claude-code/issues/23615)                                                                   | Send-keys corruption at scale — splitting current pane for many teammates garbles output                             | Garbled pane content                             |

**Workaround for pane index:** Query `pane-base-index` at runtime rather than assuming 0-based indexing. Any orchestration script should use `tmux show-options -g pane-base-index` to get the actual value.

**Workaround for inbox polling:** If teammates aren't receiving messages, check that the inbox JSON files are being written to `~/.claude/teams/{team-name}/inboxes/`. The issue may be specific to certain tmux + macOS configurations.

Source: [Claude Code Agent Teams Issues](https://github.com/anthropics/claude-code/issues?q=label%3Aagent-teams)

## References

### Official Documentation

- [tmux(1) man page](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [tmux Wiki: Getting Started](https://github.com/tmux/tmux/wiki/Getting-Started)
- [tmux Wiki: Control Mode](https://github.com/tmux/tmux/wiki/Control-Mode)
- [tmux Wiki: Advanced Use](https://github.com/tmux/tmux/wiki/Advanced-Use)
- [iTerm2 tmux Integration](https://iterm2.com/documentation-tmux-integration.html)
- [iTerm2 tmux Best Practices](https://gitlab.com/gnachman/iterm2/-/wikis/tmux-Integration-Best-Practices)

### Claude Code Specific

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [claude-utils agent-teams skill](https://github.com/nsheaps/claude-utils)

### Tutorials and Guides

- [tmux send-keys reference](https://blog.damonkelley.me/2016/09/07/tmux-send-keys/)
- [tmux capture-pane guide](https://tmuxai.dev/tmux-capture-pane/)
- [iTerm2 + tmux -CC: Remote Development Setup](https://evoleinik.com/posts/iterm2-tmux-control-mode/)
- [Tao of tmux: Scripting](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/10-scripting.html)

### GitHub Issues

- [tmux #1778: send-keys enter not working as expected](https://github.com/tmux/tmux/issues/1778)
- [tmux #1425: send-keys stripping spaces](https://github.com/tmux/tmux/issues/1425)
