---
type: feature
id: GSD-66
legacy_ids:
  - FXP/1.8.1
aliases:
  - "FXP/1.8.1"
created: 2026-05-28T02:50:00Z
state: triage
project: GSD
priority: 1
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: originating-task
    type: alex-task
    url: "https://github.com/nsheaps/.ai-agent-alex/issues/20#task-642"
    note: "#642: FXP/1.12 PARENT pr-status-cli + skill (broken down — see #643+)"
  - id: source-pr-157
    type: github-pr
    url: https://github.com/nsheaps/agents/pull/157
  - id: gsd-62-parent
    type: ticket
    url: ./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md
  - id: discord-scope-expansion
    type: discord-message
    url: https://discord.com/channels/1490863845252665415/1497431286661517353/1509383543116271616
events:
  - {
      ts: 2026-05-28T02:50:00Z,
      by: alex,
      change: "created from Nate Discord 2026-05-28 02:31Z scope-expansion of FXP/1.8",
    }
---

# FXP/1.8.1 — port task-MCP server from nsheaps/agents#157 (under current rules)

## Original ask

From Nate Discord 2026-05-28 02:31:19Z[^discord-scope-expansion]:

> take a look at nsheaps/agents#157. We're gonna re-use a lot of that logic. In one (new) branch, we're gonna pull in all those changes, but following our current rules (like the plugin task opt out) and the ci fixes. This migration should be tracked under FXP/1.8.1, with a corresponding GSD ticket. Then in a branch on top of that we'll re-use the same logic for tickets.

## Goal

Land a new branch in `nsheaps/agents` that brings in the **task-MCP server** (Bun-based) from [PR #157][^source-pr-157] while:

1. Conforming to current task-utils rules (plugin opt-out for the require-task-in-progress gate via `TASK_UTILS_REQUIRE_TASK=0` env var).
2. Applying the CI fixes from #157 (claude-code 2.1.128 pin, node dep, `inputs.*` workflow fix).
3. Leaving the agent-tools-baseline backout + YAML flat store + farish session archive OUT of scope (those are #157-specific concerns).

This is the **expanded port** that builds on the simple ticket-MCP foundation from FXP/1.8 ([GSD-62][^gsd-62-parent]). Per Nate Discord 2026-05-28 02:50Z correction: GSD-62 (simple ticket-MCP) ships first; GSD-66 (port task-MCP from #157 + bolt on shared multi-backend/reconciliation/CLI patterns) builds on top.

## Scope

In (port from #157):

- Port `apps/task-mcp/` (Bun MCP server) from PR #157 — task tool surface (task_list, task_get, task_create, task_update, task_stop).
- Port `mcp/build.sh` build script (native build on-device).
- Port the `TASK_UTILS_REQUIRE_TASK=0` opt-out wiring in the task-utils plugin.
- Port the CI fixes (claude-code pin, node dep, workflow `if:` fix).

In (expanded scope per Nate 02:31Z):

- **Multi-backend storage** for BOTH task and ticket documents:
  - (a) files only
  - (b) files + git (auto push/pull, possibly via `git-sync` utility)
  - (c) Linear
  - (d) GitHub Issues
- **Reconciliation engine** — k8s-controller-like: resource actions trigger JIT updates to live backends, plus a periodic reconcile process that maintains eventual consistency. Reconcile triggered at MCP server startup.
- **Project-id mappings** in configs:
  - Ticket configs: project-id → repo / Linear-project mappings
  - Task configs: map to repo or Linear (recommended: GitHub Issues)
- **Shared code package(s)** — first time we're building shared code across 2 servers + 2 CLIs; this establishes the patterns.
- **agent-task-cli + agent-ticket-cli** — same functionality as the MCP servers, plus a `reconcile` subcommand for ad-hoc execution and user exploration/editing.
- New branch named after this ticket: `feat/gsd-66-task-mcp` (branch and PR named after ticket id per Nate's directive).

Out:

- The agent-tools-baseline backout (separate concern, already resolved).
- The YAML flat store migration (separate concern — task-utils JSON→YAML, not MCP-related).
- The farish session archive (unrelated).

## Blocked by

- [GSD-62](./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md) (FXP/1.8) — simple ticket-MCP foundation must ship first.

## Research checkpoint required before dispatch

Per Nate Discord 02:31Z: "significant research to understand the desired state and plan well so we don't build this twice". Before any branch work begins:

- Survey ALL prior-art in the repo files re: task/ticket MCP server design, multi-backend storage, reconciliation patterns (including but not limited to #157's task-MCP).
- Survey GSD tickets that touch ticket/task management (GSD-31 ticket-utils-plugin, GSD-32 ticket-intake, GSD-33 task-utils assign-on-launch, GSD-34 task-utils validation, GSD-41 ticket-vs-task criteria, GSD-48 ticket-utils plugin, GSD-49 per-ticket file structure).
- Produce a design doc with shared-code package layout + per-backend adapter interface + reconcile cycle pseudocode.
- Handler review of design doc before any code work.

## Open Questions

- (Q1) Cherry-pick specific commits from #157 vs fresh-rebase the relevant subset? Fresh-rebase is cleaner given the 62-file diff is mixed-concern.
- (Q2) Should the task-MCP land as `apps/task-mcp/` (mirroring #157) or get folded into `plugins/claude-code/task-utils/mcp/`?
- (Q3) Branch naming convention — does Nate prefer `feat/gsd-66-task-mcp` or `gsd-66/task-mcp`? Default: `feat/gsd-66-task-mcp`.

## Acceptance criteria

- New branch + PR open against `nsheaps/agents` main, named after GSD-66.
- Task-MCP server builds via `mcp/build.sh`, registers tool surface, callable from a test claude session.
- `TASK_UTILS_REQUIRE_TASK=0` opt-out works (verified by setting env + running a non-task-bound tool call).
- CI green (lint, validate, test, validate-CI).
- Henry review + handler ack + merge.
- This branch becomes the merge-base for the FXP/1.8 ticket-MCP branch (GSD-62).

## Related

- [PR #157][^source-pr-157] — source of logic to hoist (mixed-concern; we cherry-pick the task-MCP + CI-fixes parts).
- [GSD-62](./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md) — FXP/1.8 ticket-MCP (built on this).
- [GSD-63](./GSD-63-fxp-1-9-skill-tools-hook.md) — FXP/1.9 skill-tools-hook (independent).

[^source-pr-157]: https://github.com/nsheaps/agents/pull/157

[^gsd-62-parent]: ./GSD-62-fxp-1-8-bun-ts-mcp-ticket-server.md

[^discord-scope-expansion]: https://discord.com/channels/1490863845252665415/1497431286661517353/1509383543116271616
