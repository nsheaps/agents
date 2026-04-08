# Agent GitHub Auth Abstraction

**Status**: Draft
**Created**: 2026-02-18
**Author**: Road Runner (Researcher)
**Research**: [.claude/tmp/github-auth-research.md](../../.claude/tmp/github-auth-research.md)

---

## Problem & Requirements

### Problem

In agent team workflows, all agents run as tmux panes on the user's machine, sharing the user's git config and GitHub credentials. This means:

1. **No agent attribution**: Every commit, PR, and issue appears as the user personally. There's no way to tell which agent (Engineer, Researcher, QA) performed an action by looking at the GitHub UI.
2. **No audit trail**: `git log` shows the same author for all changes. When debugging, you can't filter by "show me only what the Engineer agent did."
3. **No permission scoping**: All agents have the user's full GitHub access. A research agent could accidentally push to main, create PRs, or modify repo settings.
4. **No accountability separation**: If an agent creates a bad PR or force-pushes, GitHub blame points at the user with no indication an agent was involved.

Current mitigation: Claude Code adds `Co-Authored-By: Claude Code <noreply@anthropic.com>` to commits. This is attribution (human + AI), not identity (which agent).

### User Interest

The user specifically asked about "user OAuth vs bot/app OAuth" — they want to understand the trade-offs between agents acting as the user (with agent metadata) vs agents having their own bot identities.

### Requirements

1. **Agent-level attribution in git history**: Each agent's commits must be distinguishable. At minimum, `git log --author="Engineer"` should work.
2. **Agent-level attribution in GitHub UI**: Ideally, PRs/issues show which agent created them. At minimum, agent identity should be visible in commit details.
3. **Human accountability preserved**: The user must remain the accountable party. Agents act on the user's behalf, not independently.
4. **GPG signing compatibility**: Verified commit badges should still work.
5. **Zero or minimal infrastructure**: The user is a solo developer with a personal GitHub account. Solutions requiring org plans, enterprise features, or significant infrastructure are lower priority.
6. **Configurable per-agent**: The orchestrator should be able to set different identities per agent role.
7. **Works with existing Claude Code**: Must integrate with how Claude Code makes git commits and API calls today.

### Non-Requirements

- **CI/CD integration**: Agents run locally, not in GitHub Actions or CI pipelines.
- **Enterprise SSO/SAML**: Personal account only.
- **Multi-org support**: Single user, single org (or personal account) for now.

---

## Technical Design

### Layered Architecture

The design uses three tiers of increasing capability, each building on the previous:

```
┌──────────────────────────────────────────────────┐
│ Tier 3: Full Bot Identity (Optional)             │
│ GitHub App installation tokens for API calls     │
│ PRs/issues appear as "team-bot[bot]"             │
│ Verified API commits                             │
├──────────────────────────────────────────────────┤
│ Tier 2: API Attribution (Optional)               │
│ Single private GitHub App for the team           │
│ API calls use installation token                 │
│ PR descriptions include agent metadata           │
├──────────────────────────────────────────────────┤
│ Tier 1: Git Identity (Always On)                 │
│ GIT_AUTHOR_NAME/EMAIL per agent                  │
│ GIT_COMMITTER stays as user                      │
│ Co-authored-by + custom trailers                 │
│ Zero infrastructure required                     │
└──────────────────────────────────────────────────┘
```

### Tier 1: Git Author/Committer Split (Zero Infrastructure)

**How it works**: Git stores two identities per commit — author (who wrote it) and committer (who applied it). By setting agent-specific author and keeping the user as committer, we get agent attribution in git history while preserving human accountability.

**Implementation in claude-team launcher**:

```bash
# When spawning each agent's tmux pane, set env vars:
export GIT_AUTHOR_NAME="Claude Engineer (looney-tunes)"
export GIT_AUTHOR_EMAIL="claude-engineer+looney-tunes@noreply.local"
# GIT_COMMITTER_* defaults to user's ~/.gitconfig (unchanged)
```

**Email convention**: `claude-{role}+{team-name}@noreply.local`

- Non-routable domain (`.local`) — won't match any GitHub account
- Includes role and team name for filtering
- `noreply` signals this is an automated identity

**What the user sees**:

| Surface                       | Display                                                                               |
| :---------------------------- | :------------------------------------------------------------------------------------ |
| `git log`                     | `Author: Claude Engineer (looney-tunes) <claude-engineer+looney-tunes@noreply.local>` |
| `git log`                     | `Commit: Nathan Heaps <nathan@example.com>`                                           |
| GitHub commit view            | Author avatar: generic (no matching account). Committer overlay: user's avatar.       |
| GitHub blame                  | Shows author name per line                                                            |
| `git log --author="Engineer"` | Filters to only that agent's commits                                                  |

**GPG signing**: The committer (user) signs. Since GPG validates the committer identity, verified badges still work. The author can be different.

**Trailers for additional metadata**:

```
feat: implement login flow

Agent-Role: Engineer
Agent-Team: looney-tunes
Agent-Session: tmux-pane-3
Co-Authored-By: Claude Code (User Settings, in: /Users/nathan.heaps/src/...) <noreply@anthropic.com>
```

GitHub renders `Co-Authored-By` specially. Custom trailers (`Agent-Role`, etc.) are queryable via `git log --grep` but not rendered in the UI.

**Cost**: Free. No accounts, tokens, or infrastructure.

### Tier 2: Private GitHub App for API Operations

**Why**: Tier 1 covers git commits but not GitHub API operations (creating PRs, opening issues, commenting). For those, we need a token that identifies the agent team.

**Setup (one-time)**:

1. User creates a private GitHub App at [github.com/settings/apps/new](https://github.com/settings/apps/new):
   - Name: `claude-team` (or `{user}-agent-team`)
   - Homepage URL: any (e.g., `https://github.com/{user}/claude-utils`)
   - Webhook: unchecked (not needed for local use)
   - Permissions: Contents (read/write), Pull requests (read/write), Issues (read/write)
   - Where can this be installed: Only on this account
2. Generate a private key (PEM file), store at `~/.config/agent/github-app.pem`
3. Install the app on relevant repos
4. Note the App ID and Installation ID

**Token management in claude-team**:

```bash
# At team launch, generate an installation token (valid 1 hour)
INSTALLATION_TOKEN=$(generate-github-app-token \
  --app-id "$GITHUB_APP_ID" \
  --private-key "$HOME/.config/agent/github-app.pem" \
  --installation-id "$GITHUB_INSTALLATION_ID")

# Pass to agents as env var
export GITHUB_TOKEN="$INSTALLATION_TOKEN"
```

Token refresh: Installation tokens expire after 1 hour. The orchestrator should refresh the token and propagate to running agents. A SessionStart hook or background process can handle this.

**What the user sees**:

| Surface         | Display                                                |
| :-------------- | :----------------------------------------------------- |
| PRs/issues      | Created by `claude-team[bot]`                          |
| API commits     | Authored by `claude-team[bot]` with **verified** badge |
| Git CLI commits | Still use Tier 1 (author/committer split)              |

**Per-agent distinction**: Even with a single app, git author/committer split (Tier 1) distinguishes agents in commits. For PRs/issues, include agent identity in the body:

```markdown
## Summary

Implemented login flow with OAuth support.

---

_Created by Claude Engineer (looney-tunes) via claude-team_
```

**Cost**: Free (private GitHub Apps have no cost). One-time setup ~15 minutes.

### Tier 3: Per-Agent Bot Identity (Maximum Separation)

**Option A: Multiple GitHub Apps**

Create one GitHub App per agent role:

- `claude-engineer[bot]`
- `claude-researcher[bot]`
- `claude-qa[bot]`

Each has its own PEM key and installation token. PRs/issues/commits are fully attributed to the specific agent.

**Pros**: Maximum auditability, per-agent permission scoping
**Cons**: N apps to manage, N PEM keys, N installations per repo

**Option B: Machine User Accounts**

Create dedicated GitHub accounts per agent:

- `claude-engineer-bot` (separate email, SSH key, PAT)
- `claude-researcher-bot`

**Pros**: Full GitHub identity (profile, avatar, GPG key, verified commits via git CLI)
**Cons**: Each needs a unique email, each is a seat in paid orgs, account creation is manual

**GitHub ToS**: Machine user accounts are explicitly permitted. The human (user) must register each account and is responsible for its actions.

**Cost**: Free on personal plan. Per-seat cost in organization plans.

### How Existing Tools Compare

| Tool               | Identity Model                         | Why                                                          |
| :----------------- | :------------------------------------- | :----------------------------------------------------------- |
| **Dependabot**     | GitHub App → `dependabot[bot]`         | First-party app, verified API commits                        |
| **Renovate**       | GitHub App → `renovate[bot]`           | Third-party app, `platformCommit: true` for verified commits |
| **GitHub Actions** | System account → `github-actions[bot]` | Built-in, uses `GITHUB_TOKEN`                                |
| **GitHub Copilot** | Copilot as author, human as co-author  | Controversial — users dislike being demoted to co-author     |
| **Claude Code**    | Human as author, Claude as co-author   | Conservative — preserves human ownership                     |
| **Aider**          | Human name + `(aider)` suffix          | Simple name modification                                     |

### User OAuth Analysis

The user asked specifically about user OAuth. Here's the analysis:

**User OAuth tokens** (from OAuth Apps or GitHub App user access tokens) always attribute actions to the user. GitHub tracks which app generated the token internally, but this is NOT surfaced in the UI. There is no `X-Agent-Identity` header or equivalent.

**What this means**: User OAuth is the _least_ useful approach for agent identity. It gives you permission scoping (the token has limited scopes) but zero visual attribution. Everything looks like the user did it.

**The user OAuth + git author hybrid**: You could use user OAuth for API calls (PRs appear as the user) while using git author/committer split for commits (commits show agent identity). This preserves the user's contribution graph (green squares) and works with existing branch protection rules.

**Recommendation**: If the user values contribution graph credit and existing branch protection compatibility, use Tier 1 (git identity) + user's existing PAT for API calls. If they want bot attribution in PRs/issues, use Tier 2 (GitHub App).

### Implementation in claude-team

**Phase 1: Tier 1 (git identity)**

Modify `bin/claude-team` to set per-agent git identity env vars when spawning tmux panes:

```bash
# In the agent spawn function:
spawn_agent() {
  local name="$1" role="$2"
  local author_name="Claude ${role^} (${TEAM_NAME})"
  local author_email="claude-${role}+${TEAM_NAME}@noreply.local"

  tmux send-keys -t "$pane" \
    "GIT_AUTHOR_NAME='${author_name}' GIT_AUTHOR_EMAIL='${author_email}' \
     claude --continue ..." Enter
}
```

Add to the orchestrator's `--append-system-prompt`:

```
Each agent has a distinct git identity. Commits will show the agent's role as the author.
Do NOT override GIT_AUTHOR_NAME or GIT_AUTHOR_EMAIL in your commits.
```

**Phase 2: Tier 2 (GitHub App)**

1. Add `github-app` config section to claude-team config:
   ```yaml
   github:
     app_id: 12345
     installation_id: 67890
     private_key_path: ~/.config/agent/github-app.pem
   ```
2. Token generation script (`bin/lib/github-app-token.sh`) using JWT + installation token API
3. SessionStart hook to set `GITHUB_TOKEN` for each agent
4. Background refresh before 1-hour expiry

**Phase 3: Tier 3 (per-agent identity)**

Optional, user-configurable. Each agent role can map to a different GitHub App or machine user in config.

### Open Questions

1. **Does Claude Code honor `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL` env vars?** It calls `git commit` internally — these env vars should be respected by git itself, but need to verify Claude Code doesn't override them with its own `--author` flag.

2. **Token refresh for long sessions**: Agent teams can run for hours. GitHub App installation tokens expire after 1 hour. How should the orchestrator propagate refreshed tokens to running agents? Options: env var (requires shell restart), file-based token (agents read from a shared file), MCP tool (agents call a token-refresh tool).

3. **Should the git identity be configurable per-team or per-agent?** Current design uses role-based naming (`Claude Engineer`). Some users might want custom names per-agent (`Bugs Bunny`).

4. **Co-authored-by format**: Claude Code currently adds its own `Co-Authored-By` trailer. Should the agent identity replace it, augment it, or leave it unchanged?

5. **Branch protection interaction**: If using a GitHub App for API calls, do branch protection rules need updating to allow the bot? (Yes — the app must be listed in bypass rules for protected branches.)

6. **What about GitHub Copilot's pattern?** Copilot uses "bot as author, human as co-author" which is the inverse of our Tier 1 approach. Should we offer both patterns as configurable options?

### References

- [GitHub Apps Authentication — GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Generating installation access tokens — GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [OAuth Device Flow — GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Fine-grained PATs — GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Machine User Accounts — GitHub Docs](https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts)
- [Git Author vs Committer](https://git-scm.com/docs/git-commit/2.33.0) — `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`
- [Creating commits with multiple authors — GitHub Docs](https://docs.github.com/articles/creating-a-commit-with-multiple-authors)
- [About GitHub Copilot coding agent — GitHub Docs](https://docs.github.com/en/copilot/concepts/coding-agent/coding-agent)
- [Renovate GitHub Platform Docs](https://docs.renovatebot.com/modules/platform/github/)
- [Agent Identity for Git Commits — Justin Poehnelt](https://justin.poehnelt.com/posts/agent-identity-git-commits/)
- [Agent Identity blog — usize.github.io](https://usize.github.io/blog/2025/november/agent-identity.html)
- [GitHub App vs OAuth — Nango Blog](https://nango.dev/blog/github-app-vs-github-oauth)
- [PAT vs OAuth vs GitHub App — Community Discussion #109668](https://github.com/orgs/community/discussions/109668)
- [Commit Signing with GitHub Apps — Community Discussion #50055](https://github.com/orgs/community/discussions/50055)
- [Dependabot author identities — dependabot/feedback#191](https://github.com/dependabot/feedback/issues/191)
- [Copilot author attribution controversy — Community Discussion #179983](https://github.com/orgs/community/discussions/179983)
- [Machine user ToS — Community Discussion #179529](https://github.com/orgs/community/discussions/179529)
