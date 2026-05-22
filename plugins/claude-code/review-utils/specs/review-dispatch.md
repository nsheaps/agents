---
name: review-dispatch
status: draft
description: PR-event-driven review pipeline — consumer-side dispatch workflow farms out to a shared decider, which fires `repository_dispatch` to the target agent repo whose receiver workflow runs the `review-utils` plugin under that agent's identity.
parent: agent-harness-lifecycle
related:
  - marketplace-structure
  - plugin-system-design
  - directory-taxonomy
owner: alex
created: 2026-05-22
updated: 2026-05-22
tags:
  - review
  - dispatch
  - github-actions
  - check-runs
  - review-utils
source: https://discord.com/channels/1490863845252665415/1497431286661517353/1507422997261062214
---

# review-dispatch

> **Spec for the AI-code-review dispatch pipeline.** A consumer repo's PR event fires a tiny `dispatch-review.yaml` workflow, which calls a shared decider in `nsheaps/agents`. The decider gates on PR/CI state, posts a queued check-run on the consumer PR, and (if the gate passes) fires a `repository_dispatch` to the **target agent repo** (henry by default). The target's `dispatch-receiver-review.yaml` — also a tiny shell — calls the same `nsheaps/agents` shared workflow which runs the `review-utils` plugin under the target agent's GitHub App identity. Both consumer-side files (`dispatch-review.yaml` + `dispatch-receiver-review.yaml`) are copied into repos by `nsheaps/.github` CI automation.

## Status

DRAFT — not yet implemented. This document is the contract we'll validate the implementation against. Implementation is a follow-up after spec review.

**Supersedes:** the post-#164 in-process executor (where the review ran on `nsheaps/agents` runners under a generic bot identity). [Nate ruled](https://discord.com/channels/1490863845252665415/1497431286661517353/1507407855471563026) the reviewer-as-henry framing should be authoritative: the review is henry's work product, executed in henry's repo, under henry's identity.

## Problem

The pre-#164 flow (`peter-evans/repository-dispatch` forwarder) had henry's repo running its own local composite actions + prompt, with full review logic copy-pasted across `nsheaps/.ai-agent-henry/.github/actions/`. PR #164 pulled the review logic into a marketplace plugin (`review-utils@nsheaps-agents`), but mistakenly ran the plugin in-process on the `nsheaps/agents` runners — losing the per-agent-identity property.

The pipeline needs:

1. **Plugin-owned logic.** Review behavior lives in `review-utils`; both ends of the dispatch only orchestrate.
2. **Per-agent identity.** The review check-run, the review comment, and the API operations all run under the target agent's GitHub App. Today henry is the only reviewer; future expansion (other agent-reviewers) plugs in without code changes.
3. **Cheap to add a consumer repo.** Adding `dispatch-review.yaml` to a new repo is a `nsheaps/.github` CI sync, not a hand-wired PR.
4. **Cheap to add a reviewer repo.** Same — the receiver workflow is also a thin shell copied by CI.
5. **Always-visible check-runs.** Every PR that could trigger a review gets a check, even in the "we decided not to review" cases — so contributors aren't left wondering whether the bot saw the PR.

## Goal

Three thin shell workflows + one shared `workflow_call` library (per side) + one plugin. PR events flow through the decider, dispatch fires the receiver, the receiver runs the plugin, the plugin posts the review. Every state transition lights up a check-run on the originating PR with a deep link to the most recent relevant workflow run.

## Non-goals

- Implementing the `review-utils` plugin itself — that already exists (PR [#164](https://github.com/nsheaps/agents/pull/164)). This spec describes how the dispatch pipeline calls it.
- Replacing the `nsheaps/.github` CI sync mechanism. This spec assumes it exists and works; consumer-side workflow files arrive via that path.
- Designing the metrics yaml/json schema. The spec only states that the agent emits it and the receiver-side CI gates on its presence; the schema is a follow-up.
- Generalising beyond GitHub Actions / GitHub Apps. This spec is GH-specific.

## Topology

```mermaid
flowchart TB
    subgraph consumer["consumer repo<br/>(alex, ai-mktpl, agents, ...)"]
        CR[".github/workflows/<br/>dispatch-review.yaml<br/><br/><em>thin shell</em><br/>copied by nsheaps/.github sync"]
    end

    subgraph agentsDecider["nsheaps/agents"]
        SD[".github/workflows/<br/>review-dispatch.yaml<br/><br/><em>shared decider</em><br/>workflow_call"]
    end

    subgraph target["target agent repo<br/>(nsheaps/.ai-agent-henry, ...)"]
        TR[".github/workflows/<br/>dispatch-receiver-review.yaml<br/><br/><em>thin shell</em><br/>copied by nsheaps/.github sync"]
    end

    subgraph agentsReceiver["nsheaps/agents"]
        SR[".github/workflows/<br/>review-receiver.yaml<br/><br/><em>shared receiver</em><br/>workflow_call"]
    end

    subgraph plugin["review-utils plugin<br/>(claude-code marketplace plugin in nsheaps/agents)"]
        RV["run-agent composite action<br/>+ review-code skill"]
    end

    OUT["review posted on the original PR<br/>+ metrics dropped to yaml/json"]

    CR -->|"uses: nsheaps/agents/<br/>.github/workflows/<br/>review-dispatch.yaml@main"| SD
    SD -->|"gate passes →<br/>repository_dispatch event"| TR
    TR -->|"uses: nsheaps/agents/<br/>.github/workflows/<br/>review-receiver.yaml@main"| SR
    SR -->|"runs plugin's<br/>run-agent composite"| RV
    RV -->|"claude-code-action runs<br/>the review-code skill"| OUT
```

`review-utils` MUST be declared in the target agent's `.claude/settings.json` plugin list — that's the source-of-truth for "this agent is a reviewer," even though the GitHub Actions side checks out the plugin's composite actions directly from `nsheaps/agents`. The settings.json declaration also makes the plugin available to the agent at restart-time for any review-related skills (e.g. local-running `/review` commands).

### Two `workflow_call`s, not one

The decider and the receiver are SEPARATE shared workflows in `nsheaps/agents`. Combining them would conflate "should we review this PR?" (consumer-side gating, runs on consumer runners) with "now run the review" (target-side execution, runs on target runners under target's identity). Keeping them separate also lets us evolve receiver semantics (e.g. metrics schema, approval dismissal) without redeploying every consumer's `dispatch-review.yaml`.

## Trigger events (consumer side)

The consumer's `dispatch-review.yaml` listens for **any** of:

- `pull_request` with action ∈ {`opened`, `ready_for_review`, `reopened`}.
- `pull_request` with action `labeled` AND `event.label.name == inputs.request-label` (default `request-review`).
- `workflow_run` of the consumer's own CI workflows with `conclusion ∈ {success, skipped}` and `event.pull_requests` non-empty — this is how "CI just settled" re-evaluates the gate.
- (?) `issue_comment` containing a bot-mention pattern — see [Open questions §2](#open-questions).

Each event fires the workflow; the workflow then runs the dispatch gate (next section) to decide whether to actually dispatch.

## Dispatch gate (decider workflow)

The shared `review-dispatch.yaml` evaluates these conditions in order. A gate decision determines BOTH whether to fire the `repository_dispatch` AND which check-run to post on the head SHA.

```mermaid
flowchart TD
    A[Event fires] --> B{Trigger event?}
    B -->|PR opened/ready_for_review/reopened| C{PR draft?}
    B -->|label applied = request-review| C
    B -->|workflow_run settled| C
    B -->|bot-mention?| C

    C -->|draft AND trigger != label-applied| D[post check: failure 'PR is draft, not reviewing']
    C -->|not draft OR label-on-draft| E{All required checks present?}

    E -->|no checks at all| F[no-op — wait for CI to fire]
    E -->|some required checks pending| F
    E -->|all required settled| G{All success or skipped?}

    G -->|any failure| H[post check: failure 'CI failing, not reviewing']
    G -->|all success/skipped| I[post check: queued 'Dispatching review agent']

    I --> J[repository_dispatch → target repo]
    J -->|dispatch ok| K[update check: queued 'Review agent dispatched']
    J -->|dispatch error| L[update check: failure 'Failed to dispatch review agent']
```

### Detailed conditions

- **Draft handling.** Reviews run on non-draft PRs, with one exception: if the trigger event is `pull_request.labeled` AND the applied label matches `inputs.request-label`, the dispatch runs even if the PR is still in draft. (This is the "I want pre-merge feedback before un-drafting" path.)
- **"CI settled" semantics.** The decider fetches all check-runs for the head SHA via the GitHub API. If the consumer repo configures _required_ status checks (branch protection), the decider considers ONLY those required checks. Otherwise it considers all checks. A check is "settled" iff it has a terminal `conclusion ∈ {success, failure, skipped, neutral, cancelled, timed_out, action_required}`. The dispatch fires iff the relevant set is non-empty AND every entry is in `{success, skipped, neutral}` (the "OK to proceed" group).
- **Zero-checks case.** If the relevant set is empty, the gate emits **no check-run** and exits silently. CI hasn't run yet; when it does, the consumer's `workflow_run` trigger re-fires the dispatch workflow, which re-evaluates. (Without this no-op rule we'd post a permanent "no CI" failure check on every fresh PR.)
- **Required-checks-only.** Branch protection's required-checks list is fetched via `GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks`. If absent (no branch protection or no required-checks rule), fall back to "all checks present."

## Check-run lifecycle

Every check-run posted by the pipeline targets the head SHA of the consumer PR. The `name` is fixed (`AI Code Review`) so reruns update the same check-run rather than stacking new ones. The `details_url` ALWAYS points at the most-recent / most-relevant workflow run — gathered via `qoomon/actions--context@v5` so we link to the right run even when re-triggers happen.

```mermaid
stateDiagram-v2
    [*] --> Gate

    Gate --> NoOp: 0 checks settled
    Gate --> DraftFail: draft + non-label trigger
    Gate --> CIFail: any required check failed
    Gate --> Dispatching: gate passed

    NoOp --> [*]: no check posted

    DraftFail --> [*]: completed/failure\n'PR is draft'
    CIFail --> [*]: completed/failure\n'CI failing'

    Dispatching --> Dispatched: dispatch ok\nqueued/'Dispatched'
    Dispatching --> DispatchFail: dispatch error\nfailure/'Failed to dispatch'

    Dispatched --> Running: receiver picks up\nin_progress/'Running...'

    Running --> CommentOnly: agent verdict COMMENT\ncompleted/neutral\n'9 follow-ups found'
    Running --> Rejected: agent verdict REQUEST_CHANGES\ncompleted/failure\n'34 follow-ups found'
    Running --> Approved: agent verdict APPROVE\ncompleted/success\n'3 follow-ups found'
    Running --> AgentFail: if: failure() guard\ncompleted/failure\n'review agent failed'

    DispatchFail --> [*]
    CommentOnly --> [*]
    Rejected --> [*]
    Approved --> [*]
    AgentFail --> [*]
```

### Stage-by-stage

1. **Decider posts initial check.** The first action inside the dispatch job that decided to fire is `checks.create({name: "AI Code Review", head_sha, status: "queued", output: {title: "Dispatching review agent", summary: "..."}})`. The check_id is exported as a job output so the receiver can update it.
2. **`repository_dispatch` payload.** The dispatch event carries: `event_type` (e.g. `pr-review`), `client_payload.source` (consumer repo, PR number, head SHA, head ref, base ref), `client_payload.check_run_id` (the consumer-side check-run to update), `client_payload.consumer_workflow_run_url` (so the receiver can preserve the deep link if it doesn't override).
3. **Receiver updates to in_progress.** First action on the receiver side is `checks.update({check_run_id, status: "in_progress", output: {title: "Review agent running..."}})`. The receiver runs under the target agent's GitHub App, but updates the check-run on the consumer repo — so the App must be installed on the consumer.
4. **Agent runs.** `claude-code-action` invokes the `review-code` skill from the `review-utils` plugin. The skill posts the actual review (comment / REQUEST_CHANGES / APPROVE) via the GitHub MCP server. It ALSO emits a structured metrics file (yaml or json — schema TBD) into the workflow workspace.
5. **Approval dismissal.** Before the agent runs, the receiver dismisses any prior `APPROVED` review from this bot on this PR. The intent: a previously-approved PR with new commits MUST get a fresh look before merge. Comment-only and request-changes reviews are NOT dismissed — they remain part of the audit trail. See [Open question §1](#open-questions) on whether this should happen earlier.
6. **Metrics gate.** A final receiver step reads the metrics file. If absent, the workflow fails (`if: !steps.metrics.outputs.exists`). This forces the agent to emit metrics or the run is marked failed — preventing silent regressions where the agent posts but doesn't report.
7. **Final check update.** Based on the agent's verdict + the metrics' follow-up count:
   - COMMENT only → `completed/neutral` "The agent finished. {N} follow-ups found."
   - REQUEST_CHANGES → `completed/failure` "The agent rejected this PR. {N} follow-ups found."
   - APPROVE → `completed/success` "The agent approved this PR. {N} follow-ups found."
8. **`if: failure()` guard.** A final receiver step that runs only when an earlier step failed posts `completed/failure` "The review agent failed to run." This catches infrastructure failures (auth gone, MCP server crash, etc.) that would otherwise leave the check stuck `in_progress`.

### Why posting a "draft, not reviewing" check?

Contributors who open a draft PR and DON'T attach `request-review` see a failure check, not a missing check. The signal is: "the bot saw your PR and decided not to review yet." Without this, draft PRs would silently lack any review-check, and contributors would wonder if the workflow is wired correctly. The check title alone communicates the decision (no comment payload is needed).

### Why `details_url` always points at the most recent run?

A dispatch can be re-triggered (new commits → workflow_run re-evaluates → fresh dispatch). The check-run with the OLD `details_url` becomes stale. `qoomon/actions--context@v5` exports the current job's workflow-run URL; we set `details_url` to this on every check update. The user clicking the check on the PR always lands on the run that produced the current state.

## End-to-end sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User (consumer PR)
    participant CR as consumer repo<br/>dispatch-review.yaml
    participant SD as nsheaps/agents<br/>review-dispatch.yaml<br/>(workflow_call decider)
    participant CK as Check-run<br/>(on consumer head SHA)
    participant TR as target agent repo<br/>dispatch-receiver-review.yaml
    participant SR as nsheaps/agents<br/>review-receiver.yaml<br/>(workflow_call receiver)
    participant AG as agent runtime<br/>(claude-code-action)
    participant RV as review-utils plugin

    U->>CR: pull_request opened / labeled / ready_for_review
    CR->>SD: workflow_call (with secrets)
    SD->>SD: evaluate gate<br/>(draft, required-checks, all settled?)

    alt gate fails / no-op
        SD-->>CK: post failure or skip
        SD-->>U: terminal
    else gate passes
        SD->>CK: queued / 'Dispatching review agent'
        SD->>TR: repository_dispatch event<br/>{source, check_run_id, head_sha}
        SD->>CK: queued / 'Review agent dispatched'
        TR->>SR: workflow_call (with secrets)
        SR->>CK: in_progress / 'Review agent running...'
        SR->>SR: dismiss prior APPROVED reviews
        SR->>AG: run review-code skill
        AG->>RV: invoke plugin
        RV-->>U: post review (comment / approve / request-changes)<br/>+ metrics yaml/json
        AG-->>SR: stop (metrics required)

        alt review APPROVE
            SR->>CK: success / 'Approved. N follow-ups'
        else review REQUEST_CHANGES
            SR->>CK: failure / 'Rejected. N follow-ups'
        else review COMMENT only
            SR->>CK: neutral / 'Finished. N follow-ups'
        else infra failure
            SR->>CK: failure / 'review agent failed to run'
        end
    end
```

## Why `nsheaps/.github` CI sync owns both consumer-side files

Both `dispatch-review.yaml` (consumer) AND `dispatch-receiver-review.yaml` (target agent) are tiny shell-workflow files that change rarely. Putting their templates in `nsheaps/.github` and letting the sync workflow distribute them means:

- One file edit propagates to every repo that has the consumer wired up.
- New consumer repos onboard by being added to the sync target list — no copy-paste PR.
- Drift across consumers is impossible by construction (the sync overwrites).
- The shared `workflow_call` in `nsheaps/agents` is where ALL logic lives. Consumer files have NO logic — they just declare the trigger events + secret passthrough.

The receiver template is similarly thin: it forwards the `repository_dispatch.client_payload` straight into `nsheaps/agents/.github/workflows/review-receiver.yaml`. Adding a new reviewer-agent is the same shape: drop the receiver template into the agent repo's `.github/workflows/` (via sync), install `review-utils@nsheaps-agents` in its `.claude/settings.json`, ensure the target repo's GitHub App has access to the consumer repos that might dispatch to it.

## Secrets

### Consumer-side (passes through to decider)

- `REVIEW_GITHUB_APP_ID` + `REVIEW_GITHUB_APP_PRIVATE_KEY` — used by the decider to post check-runs on the consumer PR. Same App is installed on the consumer repo + the target agent repo.

### Receiver-side (passes through to plugin)

- `REVIEW_GITHUB_APP_ID` + `REVIEW_GITHUB_APP_PRIVATE_KEY` — re-used by the receiver to update check-runs back on the consumer repo + post the review comment.
- ONE of: `REVIEW_ANTHROPIC_API_KEY` OR `CLAUDE_CODE_OAUTH_TOKEN` — auth for `claude-code-action`. Owned by the target agent's repo (since the receiver runs there).

Each agent owns its own LLM auth. This is the lever that lets us run multiple reviewer-agents under different identities and even different model billing.

## Open questions

1. **Approval-dismissal timing.** Should we dismiss the prior `APPROVED` review at decider-time (right when the dispatch fires) instead of at receiver-time (when the agent starts running)? Decider-time dismissal closes the "PR is APPROVED, ready to merge" UI affordance ~30s earlier, but if the dispatch then fails downstream we've dismissed an approval we couldn't replace. Receiver-time dismissal is safer but leaves a brief window where the PR shows green-approved while the agent is queued.
2. **Bot mention as trigger.** Is `issue_comment` containing `@<bot-handle>` a valid trigger event? Use cases: contributor wants the bot to re-review after manually pushing fixes that don't change CI. Open issues: spam-resistance (only allow trigger from PR author + maintainers?), comment-only-on-PRs (issues without an associated PR should be a no-op).
3. **Distinguishing "no CI configured" from "CI hasn't started yet."** With zero checks present, current spec says "no-op + wait for `workflow_run`." But a repo with NO CI at all will never fire `workflow_run` — and so the review never runs. Options: (a) add a fallback timer that fires the gate after N minutes regardless; (b) require the consumer to set an input `requires-ci: false` to opt out of the CI gate; (c) call GH API to enumerate workflows, and if the repo has zero workflow files, fall through. (c) is cleanest but adds an API call.
4. **Mention triggers on issues.** If we accept bot-mention as a trigger event (Q2), does it apply to plain issues (no PR) or only PR-bound issue comments? Plain-issue mentions are probably a "future skills" feature, not in scope here.
5. **Metrics schema versioning.** When the metrics file schema changes, how do consumer/receiver workflows know which version they're reading? Embed a `$schema` field? Or version-bump the plugin and lockstep the receiver?
6. **Multi-reviewer dispatch.** The decider sends to ONE target agent (`inputs.target-repo`). If we eventually want N reviewers (henry + a security-focused reviewer agent + …), do we (a) fan out N `repository_dispatch` events from one decider run, or (b) chain N separate consumer-side workflows each dispatching to one target? (a) keeps the dispatch atomic; (b) keeps consumers in control of which reviewers they invite.

## Phases (implementation, after spec review)

1. **Spec doc** — this file. (current PR)
2. **Revert in-process executor.** Restore `review-dispatch.yaml` to forwarder mode (drop the embedded `run-agent` step, restore `repository_dispatch`). Add the gate logic.
3. **Add `review-receiver.yaml`** to `nsheaps/agents`. Mirrors today's run-agent flow but driven by `repository_dispatch` payload + does the check-update + dismissal + metrics gate.
4. **Add `dispatch-receiver-review.yaml`** template + sync target list update. Land it on henry/main first, then via `nsheaps/.github` to ai-mktpl/alex/etc. (sync target list).
5. **Install `review-utils@nsheaps-agents`** in henry's `.claude/settings.json`.
6. **Wire the metrics emission** into the `review-code` skill (plugin update).
7. **Retire henry's local composites** (`./.github/actions/agent-setup`, `./.github/actions/run-agent`, `.claude/prompts/pr-review.md`). Folds in former task #347.
8. **End-to-end smoke test** on an open PR in a consumer repo.

## Footnote

The original handler dictation lives at Discord [1507422997261062214](https://discord.com/channels/1490863845252665415/1497431286661517353/1507422997261062214) → [1507423082040787106](https://discord.com/channels/1490863845252665415/1497431286661517353/1507423082040787106) → [1507423084699713829](https://discord.com/channels/1490863845252665415/1497431286661517353/1507423084699713829) (2026-05-22). This spec consolidates those three messages plus the [framing message](https://discord.com/channels/1490863845252665415/1497431286661517353/1507407855471563026) that triggered the rewrite.
