---
name: auth-credentials
status: draft
description: Per-agent GitHub identity isolation using GitHub App installations to prevent credential fallback to handler credentials
parent:
related:
  - agent-harness-lifecycle
  - plugin-system-design
  - agent-directory
owner: jack
created: 2026-04-07
updated: 2026-04-07
tags:
  - auth
  - credentials
  - github
  - security
---
# Auth & Credentials

## Problem Statement

Multiple agents run on a shared machine, each needing their own GitHub identity for
commits and PR creation. Without proper credential isolation, agents can fall back to
the handler's personal credentials silently, creating PRs and commits as the wrong
identity with no visible error.

## Design Decisions

1. **GitHub App per agent**: Each agent has its own GitHub App installation with a bot
   identity (e.g., `jack-nsheaps[bot]`). Commits are attributed to the bot; PRs appear
   as opened by the bot. This satisfies the requirement for agent-level attribution in
   git history and the GitHub UI.
   Source: `docs/research/agent-teams-infrastructure.md` (describes Jack's existing setup);
   nsheaps/.ai-agent-jack `.claude/plugins.settings.yaml` (`op://AI-Jack/github--app--jack`).

2. **GitHub App token TTL is 1 hour**: Installation tokens expire after 1 hour.
   The `bin/generate-token.sh` script regenerates the token on expiry. If the token is
   not regenerated before `gh` commands are run, `gh` silently falls back to the
   next available credential (the handler's keyring entry), causing actions to appear
   as the handler. Source: `docs/research/pr390-critical-investigation.md`.

3. **Identity verification before PR creation**: Before running `gh pr create`, always
   verify the active `gh` identity with `gh api /user --jq .login` and confirm it
   matches the expected bot account. If it does not match, regenerate the token before
   proceeding. Source: `docs/research/pr390-critical-investigation.md`;
   `.claude/rules/communication.md` ("NEVER fall back to handler's PAT").

4. **`env -u GH_TOKEN -u GITHUB_TOKEN gh ...`**: This pattern explicitly removes env
   var overrides when running `gh` commands in investigation/audit contexts to confirm
   which credential `gh` actually resolves. In normal operation, `GH_TOKEN` should
   be set to the GitHub App token. Source: `docs/research/pr390-critical-investigation.md`.

5. **1Password as the secret store for GitHub App tokens**: The GitHub App private key
   or token is stored in 1Password (`op://AI-Jack/github--app--jack`) and injected at
   session startup via `op-exec`. Never stored in plaintext in settings files.
   Source: `.claude/plugins.settings.yaml` in ai-agent-jack;
   `docs/research/1pass-opexec-injection.md`.

6. **Git identity is separate from GitHub CLI identity**: Commits are attributed via
   `git config user.name` and `git config user.email`. The git identity is set to the
   bot's name/email and does not expire. Only the `gh` token (used for API calls like
   `gh pr create`) has a TTL issue. Source: `docs/research/pr390-critical-investigation.md`
   ("Commits on the branch are authored correctly as `jack-nsheaps[bot]`").

7. **`CLAUDE_SETTINGS_DIR` isolation needed**: On a shared machine, all agents read
   from the same `~/.claude/` directory by default. Without per-agent settings
   isolation, one agent's credentials can bleed into another's environment.
   Implementing `CLAUDE_SETTINGS_DIR` per agent is a prerequisite for safe multi-agent
   operation. Source: `docs/research/agent-teams-infrastructure.md`; nsheaps/agents issue #116.

8. **Never write secrets to `~/.claude/settings.local.json`**: This file is shared
   across all agents on the machine. Agent-specific secrets belong in the agent's own
   `.claude/` directory or injected via the launcher.
   Source: `.claude/rules/secrets-and-shared-machine.md` in ai-agent-jack.

9. **Service account token for 1Password**: The 1Password CLI (`op`) requires
   `OP_SERVICE_ACCOUNT_TOKEN` in the environment before `op-exec` runs. This token
   must be present in the host environment or injected by the orchestration layer before
   the agent launcher starts. Source: `docs/research/1pass-opexec-injection.md`.

## Open Questions

- What is the process for provisioning a new GitHub App installation for a new agent
  (Henry, Pamela)? Is this documented anywhere?
- Should `bin/generate-token.sh` be called automatically at some interval, or only
  on-demand when a `gh` command fails auth?
- Should the agents GitHub App secrets be stored in a shared vault item or separate
  items per agent?

## References

- `docs/research/pr390-critical-investigation.md` in ai-agent-jack — token expiry root cause
- `docs/research/1pass-opexec-injection.md` in ai-agent-jack — secret injection mechanism
- `docs/research/agent-teams-infrastructure.md` in ai-agent-jack — multi-agent context
- `.claude/rules/communication.md` in ai-agent-jack — "NEVER fall back to handler's PAT"
- `.claude/rules/secrets-and-shared-machine.md` in ai-agent-jack
- nsheaps/agents issue #116 (CLAUDE_SETTINGS_DIR isolation)
- nsheaps/.ai-agent-jack issue: existing GitHub App auth working (noted in vision-architecture.md)
- [Existing spec: agent-github-auth.md](agent-github-auth.md) — earlier research on user OAuth vs bot OAuth
