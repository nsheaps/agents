# agent-team

Provider-agnostic agent team orchestration.

## Status: POC / Sandbox

The TypeScript/Bun launcher code in `src/` is a proof-of-concept exploring agent lifecycle management patterns. It is not actively developed — the current focus is on `claude-team` (shell-based orchestration in the [claude-utils](https://github.com/nsheaps/claude-utils) repo). This POC will inform the eventual MVP rebuild.

54 passing tests. Key modules: discover, prompt, spawn, lifecycle.

## Overview

Reusable agent prompts and orchestration patterns for multi-agent teams. Currently targets Claude Code agent teams, with a longer-term vision for provider-agnostic orchestration via MCP.

## Development

```bash
# Install dependencies
bun install

# Format markdown
mise run fmt

# Check formatting
mise run fmt-check

# Run linting
mise run lint

# Run tests
mise run test
```

## License

Proprietary. All rights reserved.
