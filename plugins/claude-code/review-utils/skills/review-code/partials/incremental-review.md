## Incremental Review: Classification, Cache, and the Skip Decision

The receiver re-dispatches a review on every `opened`/`synchronize`/`ready_for_review`/`labeled`
PR event — including Renovate/Dependabot force-push rebases that don't change the reviewable
diff at all. Posting a full-depth review on every one of those churns the PR (dismiss →
re-review → dismiss → re-review) without giving the author anything new to act on. This
partial defines how to avoid that.

### 1. Load prior state

`${REVIEW_STATE_PATH}` points at a cache file (restored by the `run-agent` composite action via
`actions/cache`, keyed per PR — see the action's "Restore prior review state" step) that
persists your last run's conclusions across CI runs. If the file doesn't exist or is empty,
this is the first review — treat everything below as "no prior state" and always do a full
review.

Read it with `cat "${REVIEW_STATE_PATH}"` (or `yq`) if present. Fields: `diff_fingerprint`,
`pr_classification`, `verdict`, `follow_ups`, `review_url`, `skipped`, `unresolved_thread_ids`.

### 2. Classify the PR

- **`routine-update`**: the PR author is a known automation bot (`renovate[bot]`,
  `dependabot[bot]`, or another bot in the org's dependency-update allowlist) AND every changed
  file is a dependency manifest/lockfile (`package.json`, `*.lock`, `go.mod`/`go.sum`,
  `mise.toml`, `.claude-plugin/plugin.json` version bumps, `requirements*.txt`, `Gemfile.lock`,
  `*.tf.lock.hcl`, GitHub Actions version pins in `.github/workflows/*.yaml`, etc.) — no
  application/config logic changed.
- **`standard`**: everything else. If ANY changed file falls outside the dependency-manifest
  allowlist, classify as `standard` even if the PR is bot-authored — a Renovate PR that also
  touches source is not routine.

Reclassification from `routine-update` (in prior state) to `standard` (this run) always forces
a full re-review — never skip or brief-refresh across a classification change.

### 3. Compute the diff fingerprint

```bash
gh pr diff "${PR_NUMBER}" | sha256sum | awk '{print $1}'
```

Compute this BEFORE deciding — it's the basis of the skip decision, not the head SHA. A
Renovate force-push rebase changes the head SHA but frequently produces byte-identical diff
content; fingerprinting the diff (not the SHA) is what catches that case.

### 4. Decide: skip / brief refresh / full review

```
no prior state                                    -> FULL REVIEW
prior state.pr_classification != this classification -> FULL REVIEW
diff_fingerprint == prior state.diff_fingerprint   -> SKIP
  (same reviewable content — rebase/force-push only, or a re-trigger with no new commits)
diff_fingerprint != prior state.diff_fingerprint
  AND classification == routine-update             -> BRIEF REFRESH
  (new dependency-bump commits, still routine — say so briefly, don't re-litigate)
diff_fingerprint != prior state.diff_fingerprint
  AND classification == standard                   -> FULL REVIEW
```

**SKIP**: Do not call `create_pending_pull_request_review`, do not minimize/resolve/dismiss
anything, do not post any comment. Go straight to writing state (step 12 of the main skill) and
metrics (step 13) with `skipped: true` and every other field copied unchanged from prior state.
The receiver workflow reuses the prior verdict for the check-run conclusion and phrases the
title to make clear nothing new ran (see `read-metrics-and-compute-conclusion.sh`).

**BRIEF REFRESH**: A new review IS warranted (the diff changed), but keep it proportionate:

- Do NOT dismiss the prior approval — a routine dependency bump on top of an already-approved
  routine-update PR does not need a fresh "ready to merge" gate.
- If your assessment is unchanged (still no issues) and the verdict would be the same as prior
  state, you may still choose not to post a new review — just refresh `diff_fingerprint` and
  `verdict`/`follow_ups` (copied from prior state) in the state file with `skipped: true`, OR
  post a one-line comment (not a formal review) noting the bump was checked and nothing changed,
  if the diff is worth acknowledging (e.g. a major-version bump). Use judgment; prefer silence
  over noise when genuinely nothing changed in substance.
- If new follow-ups appear, post a real review using the brief format (see
  `partials/review-formatting.md`) — still don't dismiss the prior approval unless your new
  verdict is `REQUEST_CHANGES` (in which case dismiss it: an approval that no longer holds must
  not stay visible — see `partials/review-thread-management.md`).

**FULL REVIEW**: Standard depth and process — this is the pre-existing behavior. Before posting
the new review, dismiss any prior `APPROVED` review from you on this PR (see
`partials/review-thread-management.md` — "Dismissing a stale prior approval"), so the PR can't
merge on a now-superseded approval. Resolve threads whose concerns this diff addresses; leave
the rest open per the existing thread-management rules.

### 5. Referencing past review material instead of re-deriving it

Whichever branch you take, prefer citing prior state/prior review content over re-deriving
findings from scratch: if `unresolved_thread_ids` from prior state are still open and still
apply, don't re-analyze that code path — just carry the concern forward by leaving the thread
open (do nothing) rather than restating it in a new review body.
