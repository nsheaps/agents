# MOVED

This directory has moved to **[nsheaps/.org/docs/project-tracking/](https://github.com/nsheaps/.org/tree/main/docs/project-tracking)** as of 2026-05-28 (GSD-101).

## What moved

- All ticket files (`projects/GSD/tickets/`)
- MASTER.md, SETUP.md, CLAUDE.md
- Milestones (`milestones/`)
- Schemas (`.metadata/`)
- Drafts, intake, missing-info, to-triage

## Why

Consolidates org-level coordination artifacts (tickets, project tracking, PR-status digests) into a single repo separate from per-agent code (this repo, `nsheaps/agents`).

## What to update

- Any bookmarks pointing at `nsheaps/agents/blob/main/docs/project-tracking/...` → swap `nsheaps/agents` for `nsheaps/.org`.
- Tooling: `pr-status-digest.yaml` is disabled here (PR #205); reworked target lives in `nsheaps/.org` follow-up.

This stub remains in place for ~30 days as a redirect breadcrumb, then will be deleted.

Migration ticket: [GSD-101](https://github.com/nsheaps/.org/blob/main/docs/project-tracking/projects/GSD/tickets/GSD-101-move-tickets-pr-digests-to-nsheaps-org.md).
