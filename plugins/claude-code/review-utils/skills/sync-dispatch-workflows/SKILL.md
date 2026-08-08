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
**`nsheaps/.github`'s org-wide file-sync system**. `nsheaps/.github/docs/
file-sync.md` covers the general config format and conflict-handling model
(and is accurate on those); it does NOT document the specific cron schedule
or PR dry-run gating below — those two facts come from reading
`nsheaps/.github/.github/workflows/sync-all.yaml` directly, not from that doc.

- **Canonical source**: `nsheaps/.github/ansible/templates/.github/workflows/dispatch-review.yaml`
- **Target list**: `nsheaps/.github/ansible/config/sync-files.yml`, under the
  `.github/workflows/dispatch-review.yaml` key — currently
  `repos: "{{ managed_repos }}"` (every repo in `ansible/config/managed-repos.yml`,
  no exclusions — `nsheaps/.github` onboarded itself as a consumer of its own
  gate, since it takes real PRs too).
- **Distribution engine**: `nsheaps/.github/.github/workflows/sync-all.yaml`
  runs the Ansible playbook (`ansible/playbooks/sync-all.yml`, `file_sync` role).
- **Triggers** (per `sync-all.yaml`'s `on.push.paths` block, verbatim):
  `ansible/config/**`, `ansible/playbooks/sync-all.yml`, `ansible/roles/**`,
  `ansible/ansible.cfg`, `ansible/inventory/**`, `ansible/requirements.yml`,
  `.github/workflows/sync-all.yaml`, `ansible/templates/**`, `scripts/**`,
  `ansible/config/org-settings.yaml`, `.github/org-labels.yaml` — push to
  `main` only; a weekly cron (`0 6 * * 1` = Monday 06:00 UTC); manual
  `workflow_dispatch`. PR runs are always dry-run (the workflow gates
  `DRY_RUN` on `github.event_name == 'pull_request'` — validation only,
  never writes).
- **Conflict handling** (matches `docs/file-sync.md` and
  `ansible/roles/file_sync/files/sync_files.py`): central config always wins.
  The sync pushes directly to the target repo's default branch, overwriting
  drift; if branch protection blocks that (HTTP 409), it opens a PR **in the
  target repo** (not in `nsheaps/.github`) carrying the new content instead.
- **The gate itself**: `state == 'open' && (draft != true ||
action == 'converted_to_draft' || (action == 'labeled' &&
label == 'request-review'))`. Reviews fire automatically on any open,
  non-draft PR event (opened, reopened, synchronize, ready_for_review) — no
  label needed. The `request-review` label only matters to force a review on
  a still-draft PR (apply it while the PR is draft). `converted_to_draft` is
  let through unconditionally so the receiver can short-circuit with a
  `neutral` check instead of leaving a stale pending check-run. The label is
  provisioned org-wide via `.github/org-labels.yaml` (`label_sync` role,
  same `sync-all.yaml` pipeline, run over every `managed_repos` entry) — no
  per-repo setup needed for it.
- **A synced file must not be locally reformatted.** If the target repo runs
  its own formatter (prettier, etc.) over the whole tree, add the synced
  path to that formatter's ignore file — otherwise the next local format run
  silently re-diverges the file from canonical, and the next sync run (or
  this skill's drift check) just re-flags or re-overwrites it, forever. See
  `nsheaps/homebrew-devsetup`'s `.prettierignore` for a worked example: its
  `mise run format` was wrapping `dispatch-review.yaml`'s `on.pull_request.
types` array onto multiple lines (prettier's default `printWidth`
  wrapping a >80-char line), which is what caused its drift in the first
  place.

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
hand patch (harmless, just wasted effort) or, if it _doesn't_ run again soon,
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
- Does not provision the `AUTOMATION_GITHUB_APP_ID`/`_PRIVATE_KEY` secrets —
  handled by `sync-all.yaml`'s inline secret-sync tasks, not a dedicated
  role (`ansible/roles/` has `label_sync`, `org_settings_sync`, `file_sync`,
  and `github_auth` — the latter authenticates the sync run itself, it
  doesn't provision consumer-repo secrets), independently of file-sync.
- Does not directly provision the `request-review` label — that's
  `label_sync`'s job (`.github/org-labels.yaml`, same `sync-all.yaml`
  pipeline), not this skill's or `file_sync`'s. It's mentioned here only
  because it used to be a silent trap: before it was added to
  `org-labels.yaml`, the gate required it on every open PR event (not just
  to force a draft review), so `dispatch-review.yaml` could be perfectly
  synced everywhere and still never fire anywhere the label hadn't been
  hand-added. That's fixed now (see "The gate itself" above), but the
  general lesson holds for any future gate redesign: getting the workflow
  file synced is not the same as confirming the gate actually fires — check
  what it depends on, not just that it's present.
- Does not decide `managed-repos.yml` membership on its own initiative —
  that's an organizational scope call, not something to infer.
