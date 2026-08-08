---
name: sync-dispatch-workflows
description: Verify and repair the two-file PR-review dispatch pattern (dispatch-review.yaml + pr-status-dispatch.yaml) in a consumer repo, so it matches the canonical templates owned by nsheaps/.github. Use when onboarding a repo to the review-dispatch pipeline, when a repo's copies have drifted (pinned SHAs, reformatted YAML, stale `on:` triggers), or when auditing managed_repos for consistency with each other and with the templates.
---

# sync-dispatch-workflows

Applies and audits the **review-dispatch consumer pattern**: the pair of thin
GitHub Actions workflow files that every `managed_repos` entry (except the
sync source itself) carries so its PRs get routed into the AI review pipeline
and reported into the org-wide PR status digest.

This pattern is normally kept in sync automatically by `nsheaps/.github`'s
`sync-all.yaml` (Ansible `sync_files` role — cron weekly + on template push).
This skill exists for the gaps in that automation: onboarding a repo before
its next scheduled sync, repairing drift found by manual audit, or verifying
convergence after a fix.

## The pattern

Two independent files, each with its own source-of-truth and its own
exclusion rule. Do not conflate them — a repo can legitimately have one
without the other.

| File                                        | Canonical source                                                                                                                             | Applies to                                                                         | Excluded                                                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/dispatch-review.yaml`    | `nsheaps/.github` → `ansible/templates/.github/workflows/dispatch-review.yaml` (mirrored at `nsheaps/agents/templates/dispatch-review.yaml`) | every repo in `managed_repos` (`nsheaps/.github/ansible/config/managed-repos.yml`) | `nsheaps/.github` (sync source never receives its own template)                                                                                                                                                                  |
| `.github/workflows/pr-status-dispatch.yaml` | `nsheaps/.github` → `ansible/templates/.github/workflows/pr-status-dispatch.yaml`                                                            | every repo in `managed_repos`                                                      | `nsheaps/.github` (sync source) **and** `nsheaps/.org` (the digest _receiver_ — it listens to its own `pull_request` events directly via `pr-status-digest.yaml`/`pr-status-digest-retry.yaml` instead of dispatching to itself) |

The exclusion list is defined authoritatively in
`nsheaps/.github/ansible/config/sync-files.yml` under the two file keys —
re-read that file rather than trusting a cached copy of this table, in case
the exclusion set has changed since this skill was written.

Both files are **byte-for-byte identical across every consumer** — there is
no per-repo templating/parameterization. If a repo's copy differs from the
canonical source in anything beyond whitespace that isn't meaningful YAML
(i.e. any semantic diff at all — pinned SHA vs `@main`, reformatted `on:`
block, changed `types:` list, altered permissions), it has drifted and must
be overwritten with the canonical content verbatim. Do not "merge" or
"preserve" a repo's local variation — per the spec (`nsheaps/agents/plugins/
claude-code/review-utils/specs/review-dispatch.md`, §"Why nsheaps/.github CI
sync owns both consumer-side files"): _"Drift across consumers is impossible
by construction (the sync overwrites)."_ This skill enforces the same
invariant by hand.

## Procedure

For a given target repo `nsheaps/<repo>`:

1. **Determine applicability.** Read `managed-repos.yml` and `sync-files.yml`
   from `nsheaps/.github` to confirm the repo is in `managed_repos`, and
   compute which of the two files it should carry per the exclusion rules
   above. If the repo isn't in `managed_repos` at all, stop and say so rather
   than guessing — that's a scope decision for a human, not this skill.

2. **Fetch canonical content.** Prefer a local clone of `nsheaps/.github` if
   one is already present in the working environment (read
   `ansible/templates/.github/workflows/<file>` directly). Otherwise fetch via
   `gh api repos/nsheaps/.github/contents/ansible/templates/.github/workflows/<file> --jq '.content' | base64 -d`.

3. **Compare.** For each applicable file, diff the canonical content against
   `.github/workflows/<file>` in the target repo (missing entirely counts as
   a full diff). For each file that should be _excluded_, confirm it is
   actually absent — an excluded file that's present anyway is also a
   discrepancy (e.g. `nsheaps/.org` should never grow a
   `pr-status-dispatch.yaml`).

4. **Fix.** For any file that's missing or drifted, write the canonical
   content verbatim to `.github/workflows/<file>` (create parent dirs as
   needed). For any file present that should be excluded, flag it for a human
   decision rather than silently deleting — removing a workflow file changes
   what runs on every future PR in that repo.

5. **Commit, push, PR.** If step 4 made any change, commit with a message
   naming the specific file(s) touched (e.g. `fix: sync dispatch-review.yaml
to canonical template`), push to the assigned branch, and open a draft PR
   if one doesn't already exist for that branch (update the existing PR's
   description instead if one is open). If step 4 made no change, do **not**
   open a no-op PR — report the repo as already compliant.

6. **Re-verify independently.** After any fix, re-fetch the canonical content
   fresh (don't reuse the diff from step 3) and re-diff against what's now on
   disk to confirm the fix actually matches, before considering the repo done.

## Non-goals

- This skill does not touch `managed-repos.yml` or `sync-files.yml`
  membership — adding/removing a repo from the sync scope is a deliberate,
  reviewed change to `nsheaps/.github`, not something this skill infers.
- This skill does not provision secrets (`AUTOMATION_GITHUB_APP_ID` /
  `AUTOMATION_GITHUB_APP_PRIVATE_KEY`) or the `request-review` label — those
  are handled by `nsheaps/.github`'s secret-sync and `org-labels.yaml` sync
  respectively, org-wide, independent of this file pair.
- This skill does not modify `nsheaps/.github/ansible/templates/**` itself.
  If the canonical template needs to change, that's a `nsheaps/.github` PR;
  this skill only propagates whatever the template currently says.
