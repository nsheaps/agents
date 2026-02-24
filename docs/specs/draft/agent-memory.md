---
title: Agent Memory
status: draft
author: Tweety B (docs-writer)
date: 2026-02-23
informs:
  - https://github.com/nsheaps/agent-team/issues/116
  - https://github.com/nsheaps/agent-team/issues/117
source: docs/research/agent-memory-mechanisms.md
---

# Agent Memory Spec

Defines how agents in agent-team persist, share, and secure knowledge across sessions.

**Research basis**: [docs/research/agent-memory-mechanisms.md](../../research/agent-memory-mechanisms.md) — 50+ sources, high confidence.

---

## 1. Problem and Goals

Agents currently lose all learned context when a session ends or compacts. This spec defines:

1. **What** memory each agent type stores
2. **Where** that memory lives (per-agent vs shared)
3. **How** it syncs (local, GitHub Actions, K8s)
4. **What's off-limits** (secrets, PII)
5. **Who can edit what** (agent vs human)
6. **How** the three backend concerns stay separate

---

## 2. Memory Architecture

Three distinct backends, each with a different concern:

```
┌─────────────────────────────────────────┐
│             Agent Session               │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │ Memory   │  │ Agent    │  │ Team  │  │
│  │ Backend  │  │ Backend  │  │Backend│  │
│  │(task     │  │(identity)│  │(shared│  │
│  │ learning)│  │          │  │ know) │  │
│  └──────────┘  └──────────┘  └───────┘  │
└─────────────────────────────────────────┘
```

### 2.1 Memory Backend — Individual Learnings

**Purpose**: Task patterns, debugging solutions, code conventions, project structure. What an agent learns on the job.

**Storage**: Claude Code native `memory:` frontmatter scopes

| Scope     | Location                              | Git-tracked       | Sharing                           |
| --------- | ------------------------------------- | ----------------- | --------------------------------- |
| `project` | `.claude/agent-memory/<agent>/`       | Yes (recommended) | All team members with repo access |
| `local`   | `.claude/agent-memory-local/<agent>/` | No (gitignored)   | None                              |
| `user`    | `~/.claude/agent-memory/<agent>/`     | No                | Same machine, cross-project       |

**Default scope per agent**:

| Agent             | Scope                   | Rationale                                    |
| ----------------- | ----------------------- | -------------------------------------------- |
| ai-agent-eng      | `project` (already set) | Failure patterns are project-specific        |
| software-eng      | `project`               | Code patterns are project-specific           |
| docs-writer       | `project`               | Doc conventions are project-specific         |
| quality-assurance | `project`               | Quality standards are project-specific       |
| project-manager   | `project`               | Task coordination is project-specific        |
| deep-researcher   | `user`                  | Research methodology applies across projects |
| ops-eng           | `user`                  | Infra patterns apply across projects         |
| orchestrator      | `project`               | Team config and history is project-specific  |

**Format**: MEMORY.md as concise index (≤200 lines enforced by Claude Code), with overflow in linked topic files (`debugging.md`, `patterns.md`, etc.).

### 2.2 Agent Backend — Identity Persistence

**Purpose**: Core character traits, communication style, self-knowledge that should persist across projects and teams.

**Current state**: Not implemented. Agent identity resets each session.

**Recommended mechanism (Phase 3)**: [`claude-memory-mcp`](https://github.com/WhenMoon-afk/claude-memory-mcp) — the only MCP memory server focused on agent identity.

| File                  | Contents                               |
| --------------------- | -------------------------------------- |
| `soul.md`             | Core identity truths, character traits |
| `identity-anchors.md` | Patterns promoted from observations    |
| `observations/`       | Raw observations pending promotion     |

**Limitation**: MCP servers are shared by all teammates — no per-agent MCP config exists yet ([#4476](https://github.com/anthropics/claude-code/issues/4476)). Until that lands, agent backend can only be implemented via `user`-scoped memory files.

**Interim approach**: Store identity in `user`-scoped MEMORY.md. Agents self-manage their identity section there.

### 2.3 Team Backend — Shared Knowledge

**Purpose**: Cross-agent patterns, team conventions, shared findings that all agents should know.

**Storage**: Git-backed shared directory (Phase 2) or MCP knowledge graph (Phase 3).

**Phase 2 structure**:

```
.claude/agent-memory/shared/
├── conventions.md          — coding standards, PR rules, tool preferences
├── architecture.md         — system design decisions and rationale
├── patterns.md             — recurring solutions and anti-patterns
└── project-history.md      — key decisions, milestones, context
```

**Promotion mechanism**: Individual agents promote learnings to shared via PR. Team lead or PM reviews. No direct agent writes to `shared/` — all changes go through review.

---

## 3. Repository Structure

Two supported configurations:

### 3.1 In-Repo (Recommended for agent-team)

Memory lives in the project repo:

```
agent-team/
├── .claude/
│   ├── agent-memory/               # git-tracked, project-scoped
│   │   ├── ai-agent-eng/
│   │   │   └── MEMORY.md
│   │   ├── software-eng/
│   │   │   └── MEMORY.md
│   │   ├── docs-writer/
│   │   │   └── MEMORY.md
│   │   └── shared/
│   │       ├── conventions.md
│   │       └── patterns.md
│   └── agent-memory-local/         # gitignored, sensitive
│       └── <agent>/
│           └── MEMORY.md
```

`.gitignore` addition required:

```
.claude/agent-memory-local/
```

**Tradeoffs**: No extra repos, memory is tightly coupled to project version, full visibility, natural git history.

### 3.2 Federated (For large teams or multi-project sharing)

Separate repos per agent with a shared submodule:

```
org/agent-alice-memory/
├── MEMORY.md
└── team-memory/    ← submodule → org/agent-team-shared

org/agent-team-shared/
├── conventions.md
├── patterns.md
└── project-history.md
```

**Access control via CODEOWNERS**:

```
.claude/agent-memory/ai-agent-eng/   @wile-e
.claude/agent-memory/software-eng/   @bugs-b
.claude/agent-memory/shared/         @team-lead @project-manager
```

**Tradeoffs**: Cleaner isolation, harder cross-agent sharing, more operational overhead. Best for orgs with 10+ agents or strict access controls.

**For agent-team currently**: In-repo is sufficient. Federated is the path if agent-team becomes a multi-project framework.

---

## 4. Sync Approaches

### 4.1 Local (Phase 1 — Current)

No sync infrastructure. Memory persists on local filesystem. Works offline, zero setup.

- `project`-scoped memory: committed to git, shared via normal git push/pull
- `local`-scoped memory: stays on one machine only
- `user`-scoped memory: stays on one machine, no sync

**Limitation**: No automatic backup, no multi-machine sync.

### 4.2 GitHub Actions (Phase 2)

Trigger memory validation and optional consolidation on commit:

```yaml
# .github/workflows/memory-sync.yaml
name: Memory Sync

on:
  push:
    paths:
      - ".claude/agent-memory/**"
  schedule:
    - cron: "0 */6 * * *" # every 6 hours
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate memory structure
        run: |
          # Check MEMORY.md files don't exceed 200 lines
          # Check for secrets patterns (block if found)
          # Check stale citations (warn only)
```

**Limitation**: GitHub Actions caches expire after 7 days. Do not use Actions cache for durable memory state. Use the git repo itself as the source of truth.

### 4.3 Kubernetes (Phase 3 — Production)

Sidecar pattern for cloud-native deployments:

```
Pod:
  - Container: agent (runs claude-code)
  - Container: memory-sync (sidecar)
    - Watches .claude/agent-memory/ for changes
    - Commits and pushes on change (debounced 30s)
    - Pulls on agent startup
  - Volume: memory-pvc (shared between containers)
```

Storage: `PersistentVolumeClaim` for the memory volume, git remote as backing store.

**When to use**: Production multi-machine deployments, auto-restart recovery required, per-agent memory isolation at the infrastructure level.

---

## 5. Security Model

### 5.1 What Goes in Memory (Safe)

These are safe to store in any memory scope, including git-tracked `project` scope:

- Code patterns and conventions
- Architecture decisions and rationale
- Debugging solutions and common errors
- Project structure and key file locations
- Tool preferences and workflow habits
- Agent communication style and work patterns
- Team procedures and coordination norms
- External references (URLs, issue numbers, PR numbers)

### 5.2 What Must NOT Go in Git

**Hard rule — never store in version-controlled memory**:

- API keys, tokens, passwords, secrets of any kind
- Personal identifiable information (PII)
- Private user data or communications
- Authentication credentials
- Session tokens or temporary auth state
- Internal security configurations
- Anything that would be harmful if the repo were made public

Sensitive knowledge that must be remembered should go in `local`-scoped memory (gitignored) or a secure backend (1Password, HashiCorp Vault).

### 5.3 Encryption for Cloud Backups

If memory is backed up to cloud storage:

| Approach                   | Use Case                                                |
| -------------------------- | ------------------------------------------------------- |
| rclone crypt (AES-256-GCM) | Full client-side encryption before upload — recommended |
| git-crypt                  | Per-file transparent encryption via GPG                 |
| S3 SSE-KMS                 | AWS-managed server-side encryption — baseline minimum   |

**Recommended**: rclone crypt for any cloud backup. Storage provider never sees plaintext.

### 5.4 Shared Memory Visibility

| Scope                   | Who Can Read                                      |
| ----------------------- | ------------------------------------------------- |
| `project` (git-tracked) | All repo contributors, all CI runs, all teammates |
| `local` (gitignored)    | Local machine only                                |
| `user`                  | Local machine only, all projects                  |
| `shared/` directory     | All teammates, all CI, anyone with repo access    |

Be deliberate about scope. The default (`project`) is visible to everyone with repo access.

---

## 6. Editability Rules

Three tiers of write access:

### 6.1 Agent-Editable (Normal Operation)

The agent that owns the memory file writes to it automatically:

- Own `MEMORY.md` and topic files under `.claude/agent-memory/<own-agent>/`
- Pattern: agent appends learnings at session end using Write/Edit tools

### 6.2 Human-Only (Review Required)

These paths require a human-approved PR:

- `.claude/agent-memory/shared/` — any change to shared team knowledge
- Adding a new agent to the memory directory structure
- Changing the memory scope for any agent (frontmatter `memory:` field)
- Any delete of existing memory content

**Rationale**: Shared knowledge is institutional knowledge. Accidental or malicious overwrites degrade the whole team.

### 6.3 Read-Only to Agents (System Config)

These paths agents should read but never write:

- `.gitignore` entries for memory paths
- CODEOWNERS rules
- GitHub Actions workflow files for memory sync
- This spec

---

## 7. Implementation Phases

### Phase 1 — Native Memory (Now, Low Effort)

1. Enable `memory: project` in all agent frontmatter files that are missing it (see §2.1 table)
2. Add `.claude/agent-memory-local/` to `.gitignore`
3. Create empty `MEMORY.md` stubs for all agents so the directory structure is established
4. Document memory scope in each agent's role description

**Deliverable**: All agents have persistent memory that commits with the project repo.

### Phase 2 — Git-Tracked Team Memory (Soon, Medium Effort)

1. Create `.claude/agent-memory/shared/` with starter files
2. Document promotion process: how agents propose additions to shared knowledge
3. Add memory validation to CI (line count checks, secrets scanning)
4. Write a skill for agents to follow when updating memory

**Deliverable**: Team knowledge accumulates in version-controlled shared directory.

### Phase 3 — MCP / Identity Backends (Later, Higher Effort)

1. Evaluate `claude-memory-mcp` for agent identity persistence
2. Evaluate `mcp-memory-service` or Qdrant for semantic search over team knowledge
3. Implement K8s sidecar for production deployments
4. Implement cloud backup with rclone crypt

**Gate**: Wait for [#4476](https://github.com/anthropics/claude-code/issues/4476) (agent-scoped MCP config) before investing heavily in MCP memory.

---

## 8. Open Questions / Human Decisions Required

| Decision                       | Options                                        | Who Decides             |
| ------------------------------ | ---------------------------------------------- | ----------------------- |
| Memory scope per agent         | `project` vs `user` (see §2.1 recommendations) | Team lead + spec review |
| Git-track agent memory?        | Yes (recommended) vs No (local only)           | Repo owner              |
| Shared memory repo structure   | In-repo (recommended) vs Federated             | Architect               |
| Identity persistence needed?   | Phase 3 MCP vs `user`-scope MEMORY.md interim  | Product owner           |
| Cloud backup required?         | rclone crypt to S3/GCS vs local only           | Ops owner               |
| Promotion workflow for shared/ | PR-based review vs direct agent push           | Team lead               |

---

## 9. References

### Research

- [Agent Memory Mechanisms Research](../../research/agent-memory-mechanisms.md) — primary source

### Official Docs

- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)
- [Claude Code Sub-agents Docs](https://code.claude.com/docs/en/sub-agents)
- [Agent-Scoped MCP Configuration #4476](https://github.com/anthropics/claude-code/issues/4476)

### Implementations

- [claude-memory-mcp](https://github.com/WhenMoon-afk/claude-memory-mcp) — agent identity
- [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) — enterprise multi-agent
- [Letta Context Repositories](https://www.letta.com/blog/context-repositories) — git-backed memory model

### Related Issues

- [agent-team#116](https://github.com/nsheaps/agent-team/issues/116) — Research task
- [agent-team#117](https://github.com/nsheaps/agent-team/issues/117) — This spec
