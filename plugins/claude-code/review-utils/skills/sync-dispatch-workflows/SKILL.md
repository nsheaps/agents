---
name: sync-dispatch-workflows
description: Explains and operates the review-dispatch consumer pattern (per-repo .github/workflows/dispatch-review.yaml, the thin gate that forwards PR events into the shared AI review pipeline in nsheaps/agents) — how the canonical template is distributed by nsheaps/.github's Ansible file-sync mechanism, how to change the template, how to add/remove consumer repos, and how to trigger the sync rather than hand-patching individual repos. Use when onboarding a repo, changing what the gate does org-wide, or diagnosing why a repo's copy has drifted.
---

# sync-dispatch-workflows

Covers exactly one file: `.github/workflows/dispatch-review.yaml`, the thin
per-repo gate that forwards PR events to the shared review-dispatch decider
in `nsheaps/agents`. **`pr-status-dispatch.yaml` is a separate, unrelated
mechanism** (pings `nsheaps/.org`'s PR status digest on state changes) —
don't conflate the two; this skill doesn't cover it.

## The mechanism

This file is not hand-copied between repos. It's one entry in
**`nsheaps/.github`'s org-wide file-sync system** (full reference:
`nsheaps/.github/docs/file-sync.md`):

- **Canonical source**: `nsheaps/.github/ansible/templates/.github/workflows/dispatch-review.yaml`
- **Target list**: `nsheaps/.github/ansible/config/sync-files.yml`, under the
  `.github/workflows/dispatch-review.yaml` key — currently
  `repos: "{{ managed_repos }}"` (every repo in `ansible/config/managed-repos.yml`,
  no exclusions — `nsheaps/.github` onboarded itself as a consumer of its own
  gate, since it takes real PRs too).
- **Distribution engine**: `nsheaps/.github/.github/workflows/sync-all.yaml`
  runs the Ansible playbook (`ansible/playbooks/sync-all.yml`, `file_sync` role).
- **Triggers**: push to `main` touching `ansible/config/**`,
  `ansible/templates/**`, `ansible/roles/**`, or `scripts/**`; a weekly cron
  (Monday 06:00 UTC); manual `workflow_dispatch`. PR runs against
  `nsheaps/.github` are always dry-run (validate only, never write).
- **Conflict handling**: central config always wins. The sync pushes directly
  to the target repo's default branch, overwriting drift; if branch
  protection blocks that (HTTP 409), it opens a PR **in the target repo**
  (not in `nsheaps/.github`) carrying the new content instead.

## How to maintain it

**Change what the gate does everywhere** (edit the template):
1. Edit `nsheaps/.github/ansible/templates/.github/workflows/dispatch-review.yaml`.
2. Also update the convenience mirror at `nsheaps/agents/templates/dispatch-review.yaml`
   — grep `sync-files.yml`: nothing maps to `nsheaps/agents/templates/`, so
   this copy is documentation-only and will silently drift if you forget it.
3. Merge to `main`. The push-triggered sync run (or the next weekly cron)
   propagates it to every repo in the target list.

**Add or remove a consumer repo**:
- New repo to the org generally → append it to `managed-repos.yml`.
- Change which files an already-managed repo receives → edit that file's
  `repos:` expression in `sync-files.yml` (e.g. add back a
  `| difference([...])` filter to exclude a specific repo from
  `dispatch-review.yaml`).
- Removing a repo from either list does **not** retroactively delete the
  file it already received — do that by hand if it's actually intended.

## How to execute it

Prefer triggering the real mechanism over hand-copying the file into a
consumer repo. A manual patch only fixes the one repo you're looking at, it
doesn't fix the config that caused the drift, and — per the conflict
handling above — the next real sync will either silently re-overwrite your
hand patch (harmless, just wasted effort) or, if it *doesn't* run again soon,
leave you wondering whether your patch or the template is now the source of
truth. Run the mechanism instead:

- **Local preview**: from `nsheaps/.github`, `export GITHUB_TOKEN=...` then
  `mise run sync-files -- --dry-run`
- **Local apply**: `mise run sync-files` (`-- --force` to resync files the
  engine thinks are already unchanged)
- **Remote**: trigger `sync-all.yaml` via `workflow_dispatch` on
  `nsheaps/.github` — set `skip_secrets`/`skip_settings`/`skip_labels` true
  to scope the run to just file-sync if that's all you need
- **After running**, confirm convergence by diffing the target repo's
  `.github/workflows/dispatch-review.yaml` against the canonical template —
  a direct push lands silently, so "did it work" isn't self-evident from
  having triggered it.

## Diagnosing a specific repo

1. Confirm the repo is actually in `managed_repos` and not excluded by the
   `dispatch-review.yaml` entry's `repos:` expression in `sync-files.yml`.
   If it isn't in scope, that's a config change to make (previous section),
   not a file to add by hand.
2. Diff the repo's `.github/workflows/dispatch-review.yaml` byte-for-byte
   against the canonical template.
3. If they differ: either the template changed and the sync hasn't run
   since (trigger it — previous section), or someone hand-edited the
   consumer copy directly (the next real sync overwrites it regardless, per
   "central config always wins" — no action needed beyond triggering it if
   you don't want to wait for the weekly cron).

## Non-goals

- Does not cover `pr-status-dispatch.yaml` (separate mechanism, see above).
- Does not provision secrets (`AUTOMATION_GITHUB_APP_ID`/`_PRIVATE_KEY`) or
  the `request-review` label — handled by the same `sync-all.yaml` pipeline's
  secret-sync and label-sync roles, independently of file-sync.
- Does not decide `managed-repos.yml` membership on its own initiative —
  that's an organizational scope call, not something to infer.
