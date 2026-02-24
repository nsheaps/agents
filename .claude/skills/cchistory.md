# cchistory: Extract Claude Code System Prompts

Extract the full system prompt from any published Claude Code version using [cchistory](https://github.com/badlogic/cchistory).

## Prerequisites

```bash
npm install -g @mariozechner/cchistory
```

**Note**: The correct package is `@mariozechner/cchistory`, NOT `cchistory` (different, unrelated package).

## Usage

### Extract system prompt with agent teams enabled

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 cchistory <version> --claude-args '--dangerously-skip-permissions'
```

This outputs the **team lead's full system prompt** (including agent team instructions) to `prompts-<version>.md` in the current directory.

### Extract without agent teams

```bash
cchistory <version> --claude-args '--dangerously-skip-permissions'
```

### Extract a range of versions

```bash
cchistory <start-version> --latest --claude-args '--dangerously-skip-permissions'
```

### Use a local/custom binary

```bash
cchistory --binary-path /path/to/cli.js
```

## Key Flags

| Flag | Description |
|------|-------------|
| `<version>` | Claude Code npm version (e.g., `2.1.50`) |
| `--latest` | Extract from specified version through latest |
| `--binary-path <path>` | Use local binary instead of downloading |
| `--claude-args "<args>"` | Pass arguments to Claude Code instance |
| `DEBUG=1` | Enable verbose debug output |

## Important Notes

- `--dangerously-skip-permissions` is required because cchistory runs non-interactively
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` adds team instructions (TeamCreate, SendMessage, task tools) to the prompt
- **Cannot extract teammate prompts** — only captures the lead session's prompt. Teammate prompts are constructed dynamically from agent files + CLAUDE.md + spawn context
- Output is saved to `prompts-<version>.md` in the current directory (skips if file exists)
- The web UI at [cchistory.mariozechner.at](https://cchistory.mariozechner.at/) updates every 30 min and provides version comparison

## Output Location

Save extracted prompts to `docs/research/prompts-<version>.md` in the agent-team repo for version tracking.

## References

- [badlogic/cchistory](https://github.com/badlogic/cchistory)
- [cchistory web interface](https://cchistory.mariozechner.at/)
- [cchistory blog post](https://mariozechner.at/posts/2025-08-03-cchistory/)
- [Road Runner's full research](../../docs/research/cchistory.md)
