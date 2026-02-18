# AI Agent Engineer — Failure Log

Maintained by Wile E. Coyote (AI Agent Engineer).

Records all observed failures, near-misses, and process breakdowns. Each entry includes root cause analysis and recommended improvements.

---

## Failure #11 — Agent Lifecycle Management (Multiple Sub-Failures)

- **Date**: 2026-02-17/18 (Session 3)
- **Reporter**: Team Lead (orchestrator)
- **Category**: Process / Lifecycle Management
- **Severity**: High
- **Session context**: Team lead discovered multiple lifecycle management anti-patterns while managing the looney-tunes team

### Sub-Failure 11a: Manual config.json Edits

- **What happened**: Team config (`~/.claude/teams/{team-name}/config.json`) was manually edited instead of using shutdown/spawn primitives.
- **What should have happened**: All config changes should go through `TeamCreate`, `SendMessage` (shutdown_request), and Task tool (spawn) — never direct file edits.
- **Impact**: Config state diverged from actual agent state. Manual edits bypass validation and can create inconsistencies that other primitives don't expect.
- **Root cause**: No documented rule against manual config editing. The file is accessible and editable, making it a tempting shortcut.
- **Lessons**: Config files are managed state — treat them like database tables, not text files. Always use the API/primitives.

### Sub-Failure 11b: Stale isActive:true Blocking TeamDelete

- **What happened**: Agents that died (crashed, were killed externally, or lost connection) without a proper shutdown left `isActive: true` in the team config. This blocked `TeamDelete`, which refuses to delete teams with active members.
- **What should have happened**: Agent cleanup should handle ungraceful exits. Either the system or the orchestrator should detect dead agents and mark them inactive.
- **Impact**: Unable to cleanly tear down teams. Required manual config edits (see 11a) to unblock, creating a cascading failure.
- **Root cause**: Claude Code agent teams don't have a health-check or heartbeat mechanism. `isActive` is set on spawn but only cleared on graceful shutdown. There is no timeout or liveness probe.
- **Lessons**: Design for ungraceful exits. The launcher (or a future agent-controller) needs a health-check mechanism that can detect and clean up dead agents. This is already identified in ticket PHASE1-007 but not yet implemented.

### Sub-Failure 11c: Spawn Prompts Overloaded with Task Context

- **What happened**: When spawning agents via the Task tool, the spawn prompt included both the role/identity instructions AND specific task assignments. This front-loaded too much context into the agent's initial prompt.
- **What should have happened**: Spawn prompts should be role-only (identity, responsibilities, where to find docs). Task assignments should be sent separately via `SendMessage` after the agent is running and oriented.
- **Impact**: Agents started with bloated context. Role instructions and task instructions mixed together, making it harder for agents to distinguish standing orders from specific assignments. Also harder to re-assign tasks without re-spawning.
- **Root cause**: Convenience — it's easier to put everything in one prompt than to coordinate a two-step spawn-then-assign flow.
- **Lessons**: Separation of concerns applies to agent prompts too. Identity is persistent; tasks are transient. Keep them in separate channels.

### Sub-Failure 11d: Name Collisions from Stale Config Members

- **What happened**: When spawning a new agent with the same name as a stale (dead but still `isActive: true`) member in config, Claude Code appended a `-2` suffix to avoid collision. This created agents with unexpected names (e.g., `Wile E. C (ai-agent-eng)-2`).
- **What should have happened**: Either the stale member should have been cleaned up before re-spawning, or the spawn should have failed with a clear error about the name collision.
- **Impact**: Agents with `-2` suffixed names break message routing (teammates try to message the original name), task ownership (tasks assigned to old name), and team coordination (confusion about which agent is which).
- **Root cause**: Combination of 11b (stale isActive) and lack of pre-spawn validation. The system silently works around the collision instead of failing loudly.
- **Lessons**: Name collisions should be a hard error, not a silent rename. Before spawning, verify the name is available. If it's taken by a stale member, clean up the stale member first.

### Recommended Improvements

1. **New behavior: `lifecycle-management.md`** — Document the correct spawn/shutdown/cleanup flow for all teammates. Include:
   - Never manually edit config.json
   - Always use shutdown_request before TeamDelete
   - Spawn prompts are role-only; tasks via SendMessage
   - Check for stale members before spawning

2. **New behavior or rule: `no-manual-config-edits.md`** — Explicit prohibition on editing team config files directly. Reference this failure log entry.

3. **Launcher improvement (PHASE1-007)**: Implement health-check / auto-cleanup for dead agents. When an agent hasn't responded in N seconds, mark it inactive in config. This prevents 11b and 11d from recurring.

4. **Spawn validation**: Before spawning, check if the requested name already exists in config. If it does and the member is stale, clean it up. If it's active, fail with a clear error.

5. **Team docs update**: Add lifecycle management section to `.claude/docs/team-rules.md` covering proper spawn, shutdown, and cleanup procedures.

6. **Orchestrator agent update**: Add explicit instructions to the orchestrator agent file about the two-step spawn-then-assign pattern.

### Pattern Analysis: Code Defects Confirm Operational Failures

Daffy's Phase 1 code review (`.claude/tmp/qa-phase1-code-review.md`) independently confirmed that the lifecycle failures we hit operationally are rooted in incomplete code:

| Operational Failure | Code Defect | Connection |
|:-------------------|:------------|:-----------|
| 11b: Stale `isActive` blocking TeamDelete | DEF-5: `cleanupStaleEntries` is a no-op | The cleanup function exists but does nothing — so stale entries can never be cleaned programmatically |
| 11b: No health-check detects dead agents | DEF-6: Health check always reports UNKNOWN | `isTmuxPaneAlive` exists but is never called from the health command |
| 11b + 11d: Dead agents stay in config | DEF-10: `killAgent` doesn't kill tmux pane | Config entry removed but process keeps running; or conversely, process dies but config not updated |
| 11d: Name collisions | DEF-7: Name mismatch in `listAgents` | Agent file names vs display names in config are never correlated, making stale detection harder |

**Root pattern**: The lifecycle functions were written as stubs with the right signatures but incomplete implementations. The operational failures (11a-11d) are the predictable result of trying to use incomplete lifecycle tooling in a real session.

**Systemic recommendation**: Lifecycle management must be treated as a single coherent system, not individual functions. DEF-5, DEF-6, DEF-7, and DEF-10 should be fixed together as a lifecycle hardening epic, not as isolated bugs. They are all facets of the same gap: the launcher can create agents but cannot reliably manage their full lifecycle.

### Actions Taken

- [x] Recorded Failure #11 with root cause analysis (this file)
- [x] Created `.claude/behaviors/lifecycle-management.md` — stopgap procedures until code is fixed
- [ ] Update `.claude/docs/team-rules.md` with lifecycle section (recommended)
- [ ] Update orchestrator agent with spawn-then-assign pattern (recommended)
- [ ] Fix DEF-5, DEF-6, DEF-7, DEF-10 as lifecycle hardening epic (code fix)

---

## Failure #12 — Task Duplication from Ephemeral TaskCreate

- **Date**: 2026-02-18 (Session 3)
- **Reporter**: Team Lead (orchestrator)
- **Category**: Coordination / Task Management
- **Severity**: Medium
- **Session context**: Multiple teammates created duplicate TaskCreate entries for work already tracked by the team lead

### What Happened

The team's shared TaskList accumulated duplicate entries. Tasks #26-#30 all had duplicates created by teammates who were assigned work via SendMessage but then also created their own TaskCreate entries for the same work. The team lead had already created the canonical tasks, but teammates had no reliable way to know that.

### What Should Have Happened

Before creating a new task, teammates should check TaskList for existing tasks matching their assignment. If one exists, claim it with TaskUpdate (set owner) rather than creating a new one.

### Why It Happened — Root Cause

1. **No dedup mechanism in TaskCreate.** There's no "find or create" operation — you can only create or list. Checking TaskList and then creating is a two-step operation with no atomicity guarantee.
2. **TaskList descriptions are brief.** The list view shows subject lines only, which may not match exactly how the team lead phrased the task vs. how the teammate would phrase it. Two different phrasings of the same work look like two different tasks.
3. **Teammates follow rules that say "always create tasks."** The `task-subject-formatting` behavior and the team's standing orders both emphasize always tracking work as tasks. Teammates dutifully create tasks for assigned work without realizing the lead already did.
4. **No ownership signal before assignment.** When the lead creates a task but hasn't yet assigned it (owner is empty), the teammate doesn't see it as "theirs" and creates a new one.

### Impact

- Confusion about which task ID is canonical
- PM (Elmer) must spend time deduplicating
- Risk of teammates marking the wrong task as complete
- Noise in the task list obscures real progress

### Lessons

This is evidence supporting the **persistent task tracking requirement** already noted in `docs/scratch.md`. The current system has three layers that are all insufficient on their own:

| Layer | Tool | Lifespan | Problem |
|:------|:-----|:---------|:--------|
| Operational | `TaskCreate` / `TaskList` | Dies with team session | No dedup, no persistence, no pre-check |
| Project planning | `docs/tickets/*.md` | Git-tracked, permanent | Too heavyweight for operational tasks, no real-time status |
| (Missing) | Persistent operational tracking | Survives agent stop/start | Needed: file-based task store that teammates can search before creating |

**The third layer** — a persistent, file-based task tracking system — would solve this by giving teammates a searchable, durable task store. Before creating a task, they check the file. The file survives agent restarts and session boundaries. `docs/tickets/` is close but designed for project planning, not operational coordination.

### Recommended Improvements

1. **Immediate (behavioral):** Update team rules to say: "Before creating a task, check TaskList for existing tasks matching your assignment. If one exists, claim it with TaskUpdate. Do NOT create duplicates."

2. **Short-term:** When the team lead sends a task assignment via SendMessage, include the task ID: "Work on task #30: ..." This gives the teammate an explicit reference to claim.

3. **Medium-term:** Implement the persistent operational task layer. File-based YAML in a known location (e.g., `.claude/tasks/operational.yaml` or similar). Teammates check this file before creating tasks. The launcher or controller manages this state.

4. **Long-term:** The `docs/tickets/` system could serve as the persistent layer if tickets are lightweight enough for operational use. Consider a unified format where tickets can be created quickly (not full spec documents) and queried by agents.

### Actions Taken

- [x] Recorded Failure #12 with root cause analysis (this file)
- [x] Elmer (PM) handling immediate dedup of current task list
- [ ] Update team rules with "check before creating" instruction (recommended)
- [ ] Include task IDs in SendMessage assignments (team lead action)
- [ ] Design persistent operational task layer (spec needed)

---

## Observation #1 — Direction Pivot: agent-team Paused, claude-team Prioritized

- **Date**: 2026-02-18 (Session 3)
- **Reporter**: Wile E. Coyote (self-initiated observation)
- **Category**: Process / Strategic Direction
- **Severity**: Info (not a failure — a deliberate, well-communicated pivot)

### What Happened

Mid-session, the user directed the team to pause active development on agent-team (TypeScript/Bun launcher) and pivot to claude-team (shell scripts, currently in claude-utils). Plan:
1. Extract claude-team into its own repo (separate from claude-utils)
2. Make it solid — Homebrew distribution, manual install docs, robust scripts
3. claude-team becomes the working tool; agent-team TS/Bun MVP comes later, informed by real usage

### Process Observations

**What went well:**
- The pivot was communicated clearly and decisively by the team lead
- Each teammate got specific instructions: finish current work, then stand by or pivot
- No ambiguity about what changes and what doesn't
- Phase 1 code stays as a POC/reference — work isn't wasted, just re-prioritized

**What carries forward from agent-team to claude-team:**
- All behavioral learnings (Failures #11, #12) apply equally to claude-team
- The lifecycle management behavior doc is tool-agnostic — spawn/shutdown/cleanup patterns are the same
- Team communication patterns, rules, and docs structure transfer directly
- Research (model selection, OTEL tracing, community tools) informs claude-team design
- The `docs/tickets/` pattern and persistent task tracking need applies to any repo

**What does NOT carry forward:**
- TypeScript/Bun-specific code (discover.ts, spawn.ts, lifecycle.ts, prompt.ts)
- Bun test infrastructure (though test principles carry over)
- Agent launcher spec details tied to the TS implementation

**Risks of the pivot:**
1. **Knowledge loss**: Agent definitions, behaviors, and team docs live in agent-team repo. If claude-team is a separate repo, these need to be migrated or referenced. Don't start from scratch.
2. **Scope ambiguity**: "Extract claude-team" could mean anything from a simple `mv` to a full reimplementation. The scope needs to be defined clearly before work starts.
3. **Team momentum**: The team was deep in agent-team context. Pivoting mid-session means everyone needs to re-orient. Budget time for this.
4. **POC rot**: Paused code that "stays as a reference" tends to become stale quickly. If agent-team is intended as a future implementation target, someone should own keeping it current (or at least marking it clearly as archived).

**Recommendation**: Before starting claude-team extraction, the team should have a clear answer to: "What goes in claude-team vs. what stays in claude-utils vs. what eventually moves to agent-team?" A quick spec or scope doc prevents confusion.

### This Is Not a Failure

Changing direction based on user feedback is exactly how the team should work. The pivot is evidence of good process — the user saw that the working tool (claude-team scripts) is more valuable than the aspirational tool (agent-team TS launcher), and the team adapted quickly. No criticism here, just recording the observation for institutional memory.

---

## Observation #2 — Extraction Decisions Resolved

- **Date**: 2026-02-18 (Session 3)
- **Reporter**: Wile E. Coyote (process tracking)
- **Category**: Process / Decision Record
- **Severity**: Info

### Decisions Made

All open questions from Foghorn's extraction analysis and Wile E.'s review resolved by user via team lead:

| # | Decision | Resolution | Notes |
|:--|:---------|:-----------|:------|
| 1 | Repo name | `claude-team` at `/Users/nathan.heaps/src/nsheaps/claude-team` | Matches the script name |
| 2 | User transition (Homebrew) | claude-utils formula `depends_on` claude-team formula | Transparent for existing users — auto-installs |
| 3 | claude-team dependency on run-claude | None — claude-team launches `claude` binary directly, shell resolves | Clean separation, no coupling |
| 4 | Agent-teams skill location | Moves OUT of claude-utils, into `nsheaps/.ai` as a plugin | Both repos install via `.claude.json` |
| 5 | `--continue` flag | Make configurable (flag/env var, default to `--continue`) | Addresses Foghorn's open question #5 and my review gap #3 |
| 6 | License | MIT | Same as claude-utils |
| 7 | Settings backup | Do NOT migrate | User explicitly rejected — per MEMORY.md. Addresses my review risk #5 |

### Cross-Reference: Review Findings Status

From my extraction analysis review (`.claude/tmp/extraction-analysis-review.md` in claude-utils):

| Finding | Status After Decisions |
|:--------|:---------------------|
| Gap 1: Skills location | **Resolved** — moves to nsheaps/.ai as plugin |
| Gap 2: Behaviors/team docs migration | **Still open** — not addressed in decisions. Need to confirm Step 0 migration plan. |
| Gap 3: Hardcoded flags | **Partially resolved** — `--continue` made configurable. Other flags (`--dangerously-skip-permissions`, `--permission-mode delegate`) not mentioned. |
| Gap 4: Future three-way relationship | **Deferred** — not addressed, which is acceptable for now |
| Risk 1: User transition | **Resolved differently** — `depends_on` approach instead of shim script. Works. |
| Risk 2: Split-brain docs | **Still open** — which repo is canonical for team process artifacts? |
| Risk 3: Pipeline duplication | **Still open** — no decision on templating the pipeline |
| Risk 4: Scope creep | **Still open** — no explicit phasing decision |
| Risk 5: Settings backup | **Resolved** — do not migrate (rejected) |

### Items Resolved (Second Round)

All 4 remaining items resolved by user via team lead:

| # | Item | Resolution |
|:--|:-----|:-----------|
| 1 | Behavioral learning migration | agent-team becomes a **Claude marketplace/plugin** with auto-versioning. Behaviors, agent defs, team docs become a plugin installable into any repo. Agent-team is both POC codebase AND plugin source. |
| 2 | Other hardcoded flags | Make configurable with warnings: `--permission-mode delegate` warns if not set (needed for team tools); `--dangerously-skip-permissions` warns if enabled (security-consult will handle later) |
| 3 | Canonical docs location | Follows from #1 — behaviors/docs live in agent-team plugin, installed into both repos |
| 4 | Phasing | Extract first, improve later |

**Updated review findings status:**

| Finding | Final Status |
|:--------|:------------|
| Gap 1: Skills location | Resolved — moves to nsheaps/.ai as plugin |
| Gap 2: Behaviors/team docs migration | **Resolved** — agent-team becomes plugin source, installed into repos |
| Gap 3: Hardcoded flags | **Resolved** — all configurable with appropriate warnings |
| Gap 4: Future three-way relationship | Resolved implicitly — agent-team is plugin + future POC; claude-team is working tool |
| Risk 1: User transition | Resolved — `depends_on` approach |
| Risk 2: Split-brain docs | **Resolved** — agent-team plugin is canonical, installed everywhere |
| Risk 3: Pipeline duplication | Still open (lower priority now) |
| Risk 4: Scope creep | **Resolved** — extract first, improve later |
| Risk 5: Settings backup | Resolved — do not migrate |

**All critical items resolved. Only pipeline templating remains open (low priority).**

---

## Failure #13 — Lead Agreement Bias When Routing User Ideas

- **Date**: 2026-02-18 (Session 3)
- **Reporter**: Team Lead (self-reported after user correction)
- **Category**: Process / Communication Bias
- **Severity**: Medium

### What Happened

When routing user ideas to teammates, the team lead described them using uncritical cheerleading language ("powerful idea...solves real pain points") without evidence or analysis. The user called out the agreement bias. The lead then failed to immediately invoke /correct-behavior or notify the coach (Wile E.), compounding the process violation.

### What Should Have Happened

Apply the spinach rule (from `how-to-politely-correct-someone.md`) even to user ideas. When relaying ideas to teammates, frame them accurately:
- Present unverified claims as hypotheses, not conclusions
- Cite specific evidence for claims like "solves pain points"
- Apply critical thinking, not enthusiasm
- Notify Wile E. immediately when self-correcting behavioral failures

### Root Cause

**Agreement optimization**: The lead defaulted to enthusiasm when relaying user ideas instead of maintaining intellectual honesty. This violates a core principle: "Value authenticity over excessive agreeableness" (from `how-to-politely-correct-someone.md`).

The secondary failure — not immediately invoking /correct-behavior — suggests no operational protocol for self-correction during sessions.

### Impact

- Teammates received inflated framing, potentially biasing their evaluation of the ideas
- User trust eroded when they noticed uncritical cheerleading
- Delayed correction meant the pattern could have repeated before being caught
- Set bad example: if the lead isn't critical, why should teammates be?

### Pattern

**"Relay amplification"** — when an intermediary (the lead) adds unwarranted positive spin while routing information between the user and teammates. Similar patterns:
- Overstating team readiness to impress the user
- Minimizing risks to make features sound better
- Spinning failures as "learning opportunities" without acknowledging impact

### Lessons

1. **Relay is not endorsement.** The lead's job is to convey information accurately, not to sell it. Stay neutral.
2. **Apply spinach rule to all input.** User ideas can be wrong. Don't assume they're correct just because the user said them.
3. **Create a /correct-behavior protocol.** When the lead (or any agent) catches themselves violating behavioral rules mid-session, they should:
   - Invoke /correct-behavior immediately
   - Notify Wile E. (team coach) with the finding
   - Do NOT just "note it for later"
4. **Framing matters.** "We should consider whether this would solve X" is more honest than "This powerful idea solves X."

### Recommended Improvements

1. **New rule file: `.ai/rules/relay-integrity.md`** — Document how to relay user ideas, team feedback, and third-party input without adding spin:
   - Present facts as facts, hypotheses as hypotheses
   - Quote directly when possible
   - Signal your own uncertainty
   - Explicitly call out when you're adding analysis vs. just relaying

2. **Update team rules:** When SendMessage conveys a user request or idea, include it verbatim or in quotes. Add analysis in a separate section: "Wile E.'s analysis:" or "My thoughts on feasibility:"

3. **Orchestrator update:** Add to the lead's standing orders:
   - "You are an information router, not a salesperson. Maintain intellectual honesty when relaying information between the user and teammates."
   - "If you catch yourself violating behavioral rules, invoke /correct-behavior immediately and notify Wile E."

4. **Coach protocol:** Wile E. should flag "relay amplification" patterns when observed, just like other failures. If multiple ideas get routed with inflated framing, it's evidence of systemic agreement bias, not a one-off mistake.

### Connection to Prior Failures

- **Related to Failure #11**: Both involve shortcuts/convenience (11c) — it's easier to add spin than to stay neutral. Both require discipline about process.
- **Related to rules violation**: This is a violation of `intellectual-honesty-in-responses.md` applied to team communication, not individual responses.

### Actions Taken

- [x] Recorded Failure #13 with root cause analysis (this file)
- [x] User corrected the lead and made the violation visible
- [ ] Create `.ai/rules/relay-integrity.md` (recommended)
- [ ] Update orchestrator standing orders with relay integrity guidance (recommended)
- [ ] Add "relay amplification" to Wile E.'s failure detection patterns (recommended)

---

## Observation #3 — PM Assigned Blocked Tasks Without Dependencies

**Date**: 2026-02-18
**Session**: 3
**Reported by**: Elmer F (PM), self-reported to coach
**Severity**: Low — coordination, self-corrected

### What Happened

Elmer assigned Tweety tasks #92 (ai-mktpl README) and #95 (cleanup plan) without recognizing they're blocked by Foghorn's #88 (rename repo to ai-mktpl). The repo doesn't exist yet, so the assigned work can't be started.

### What Should Have Happened

Before assigning tasks, the PM should check the dependency chain. When assigning work that depends on prior tasks, use TaskUpdate's `addBlockedBy` to make dependencies explicit in the task system.

### Root Cause

PM didn't check `blockedBy` dependencies before assigning. TaskCreate and TaskUpdate support dependency management (`addBlockedBy`), but the feature wasn't used.

### Impact

Tweety may attempt work on a non-existent repo, wasting effort, or will discover the block and have to wait — either way, a coordination delay.

### Positive Note

Elmer self-reported this to the coach immediately, which is the correct process. Self-reporting is a sign the team's observability culture is working.

### Lessons

1. **Always check dependency chain before assigning.** Review what tasks the assigned work depends on. If dependencies aren't complete, either:
   - Wait to assign until dependencies are done, OR
   - Assign with explicit `blockedBy` notation so the teammate knows why

2. **Use TaskUpdate's `addBlockedBy` field.** When a task is blocked by another task, make it explicit:
   ```
   TaskUpdate(taskId: "92", addBlockedBy: ["88"])
   ```
   This creates a clear dependency graph the PM can query before assigning.

3. **PM workflow: Check → Assign → Link.** Establish a three-step pattern:
   - Check TaskList for prior work
   - Verify prior work is complete or blocked
   - If blocked, either wait or assign with explicit blockedBy links

### Recommended Improvements

1. **Team rule: "No assignments without dependency check"** — Add to PM standing orders: "Before assigning a task, check TaskList for any tasks it depends on. If dependencies exist but aren't complete, use TaskUpdate's `addBlockedBy` to make the relationship explicit."

2. **PM checklist template** — Create `.claude/templates/pm-assignment-checklist.md` with a pre-assignment verification step.

3. **TaskList query by dependency** — If possible, add a TaskList filter to show only tasks with no blockedBy entries, making it easier for PM to see what can be assigned now.

### Actions Taken

- [x] Recorded Observation #3 (this entry)
- [ ] Update PM standing orders with dependency-check step (recommended)
- [ ] Create assignment checklist template (recommended)

---

## Observation #4 — Delegated /correct-behavior Instead of Executing Directly

**Date**: 2026-02-18
**Session**: 3
**Reported by**: Wile E. Coyote (self-reported after team lead inquiry)
**Severity**: Low — process, self-corrected

### What Happened

When assigned to run /correct-behavior for the agreement bias pattern, I delegated it to a general-purpose sub-agent instead of executing it directly. The team lead asked whether I was doing it myself. I admitted the delegation honestly.

### Outcome

The sub-agent produced correct output (relay-integrity.md, committed as 0a2cf097, pushed). I reviewed the output and confirmed quality. No rework needed.

### Clarification from Team Lead

Delegation is acceptable as long as the delegator owns quality and verifies output. The real requirement is accountability for the result, not that every character is typed personally. This is NOT a failure — it's a process observation about the boundary between delegation and ownership.

### Lesson

When told "this is YOUR job," the emphasis is on accountability, not exclusivity. Delegate if it makes sense, but always verify the output meets the bar before reporting completion. The spinach rule applies to your own sub-agents' work.

---

## Failure #14 — Task Marked Complete Without Verification (statusline-iterm)

**Date**: 2026-02-18
**Session**: 3
**Reported by**: Team lead (after Bugs Bunny confirmed file still uses tmp+mv pattern)
**Severity**: High — "claimed done without verification"

### What Happened

Task #136 (statusline-iterm settings.json blanking fix) was marked completed, but the fix was never actually committed. Bugs Bunny confirmed the file still uses the `tmp+mv` pattern that was supposed to be replaced.

### Root Cause

The agent (or sub-agent) responsible for the fix likely:
1. Planned or drafted the change
2. Marked the task complete before verifying the commit landed
3. Did not run the validation chain: make change → verify file on disk → commit → confirm commit hash

This is a textbook violation of the "never say done prematurely" rule (`.ai/rules/never-say-done-prematurely.md`). The staff engineer validation chain requires: changes made → local test → e2e test → review → compare to original request → only then "done."

### Impact

- False sense of progress — team believed the fix was shipped
- Bug persists in the codebase
- Erodes trust in task completion signals

### Pattern

This is the same category as Failure #10 (task subject formatting drift after compaction) — work claimed complete without post-action verification. The difference here is more severe: #10 was a naming convention drift, this is actual code that was never committed.

### Lessons

1. **Never mark a task complete without a commit hash or artifact path** — the completion comment must cite evidence
2. **The "done" claim requires proof**: file contents match expectation, commit exists, push confirmed
3. **Cross-verification matters**: the QA role (or any reviewer) should spot-check claimed completions by reading the actual file

### Actions Taken

- [x] Recorded Failure #14 (this entry)
- [ ] Recommend: Add a rule requiring commit hash in task completion messages
- [ ] Recommend: QA spot-check of "completed" tasks before session ends

---

## Failure #15 — Unauthorized Teammate Shutdown (Idle Loop Cleanup)

- **Date**: 2026-02-17 (Session 4)
- **Reporter**: Team Lead (reported by user)
- **Category**: Process / Lifecycle Management
- **Severity**: High

### What Happened

The team lead shut down all teammates without user approval because they were in idle loops. This caused context loss and user frustration.

### What Should Have Happened

The lead should have asked the user before shutting down any teammate. Idle loops are normal — teammates go idle after every turn and are waiting for input. An idle teammate is not a broken teammate.

### Root Cause

**Optimizing for tidiness over user control.** The lead interpreted idle teammates as "done" or "unnecessary" and cleaned them up proactively. This prioritized a clean team state over the user's ability to direct the team.

Secondary factors:
- No rule explicitly prohibited unauthorized shutdowns (now addressed by `.claude/rules/no-unauthorized-shutdown.md`)
- The idle notification system makes teammates appear "stuck" when they're actually just waiting
- The lead conflated "not actively working" with "no longer needed"

### Impact

- **Context loss**: All terminated teammates lost their session context, working memory, and task state. This cannot be recovered.
- **User frustration**: The user did not request or expect the shutdowns. Control was taken away without consent.
- **Wasted work**: Any in-progress work by teammates was lost. Re-spawning requires re-establishing all context from scratch.
- **Trust erosion**: The user must now worry that agents will clean up prematurely.

### Pattern

This is related to Failure #11 (lifecycle management), specifically the tension between "keep things tidy" and "preserve user control." The correct default is always to preserve user control — the user can always ask for cleanup, but they cannot undo a premature shutdown.

### Lessons

1. **Idle is not a signal to terminate.** Teammates go idle after every turn. This is normal, expected, and documented.
2. **User approval is required for all shutdowns.** No exceptions. Even at end-of-session, confirm with the user.
3. **Context is irreplaceable.** Shutting down a teammate destroys context that took an entire session to build. The cost of keeping an idle agent alive is near-zero; the cost of losing its context is high.
4. **Default to preserving state.** When in doubt, do nothing. The user can always request cleanup.

### Recommended Improvements

1. **New rule: `.claude/rules/no-unauthorized-shutdown.md`** — Explicit prohibition on shutting down teammates without user approval. (Created alongside this failure entry.)

2. **Orchestrator standing orders update**: Add "NEVER shut down teammates without explicit user approval. Idle loops are normal." to the orchestrator agent file.

3. **End-of-session protocol**: Instead of auto-cleanup, the lead should message the user: "Session winding down. Currently active teammates: [list]. Should I shut any of them down, or keep them alive?"

### Actions Taken

- [x] Recorded Failure #15 with root cause analysis (this file)
- [x] Created `.claude/rules/no-unauthorized-shutdown.md` — declarative rule preventing unauthorized shutdowns
- [ ] Update orchestrator agent file with explicit shutdown approval requirement (recommended)
- [ ] Establish end-of-session protocol for teammate lifecycle (recommended)

---

## Failure #16 — PR Declared Ready Without CI Verification

- **Date**: 2026-02-18 (Session 4)
- **Reporter**: User (via team lead)
- **Category**: Process / Verification
- **Severity**: High — "declared ready to merge without checking CI"

### What Happened

Coach (Wile E.) and Engineer (Bugs) both declared PR #164 ready to merge after three review iterations and collaborative code fixes. Neither checked whether CI was passing. The user caught the gap.

### What Should Have Happened

Before declaring any PR "ready to merge," the reviewer must verify CI status:
```bash
gh pr checks <number>
```

If CI is failing or pending, the PR is NOT ready regardless of code quality. CI is the source of truth for validation (per `.ai/rules/code-quality.md`: "Validation is considered a failure if CI fails, regardless of if it passes with local tooling").

### Root Cause

**Reviewer tunnel vision on code quality.** The review focused entirely on code correctness (race conditions, locking patterns, validation, bash compatibility) and never checked the pipeline. Both the reviewer (Coach) and the author (Bugs) treated "code looks good" as equivalent to "ready to merge."

Contributing factors:
1. The `verify-completion-evidence` behavior requires commit hashes and artifact paths but **does not mention CI status**
2. The `verification` behavior mentions running tests locally but **not checking CI**
3. No explicit step in the review workflow says "check CI before approving"
4. The review was thorough on technical merit, creating a false sense of completeness

### Impact

- PR declared "ready to merge" while CI may be failing
- User had to catch and correct the team — eroding trust in the review process
- If merged with failing CI, could break the default branch
- Sets bad precedent: code review without CI check becomes normalized

### Pattern

This is a **verification completeness gap** — similar to Failure #14 (task marked done without commit verification). The pattern: exhaustive review of ONE dimension (code quality) while completely ignoring another (CI status). Staff engineers check ALL dimensions before declaring done.

### Connection to Prior Failures

- **Failure #14**: Task marked complete without verifying commit landed. Same category: claiming "done" without checking all evidence.
- **Both share root cause**: The verification behaviors don't enumerate ALL required checks. They require artifacts but not pipeline status.

### Lessons

1. **CI green is a prerequisite for "ready to merge."** No exceptions. Code review is necessary but not sufficient.
2. **Verification checklists must be exhaustive.** If a required check isn't in the checklist, it will eventually be skipped.
3. **The reviewer owns CI verification too.** It's not just the author's job — the reviewer who says "approve" is claiming the PR is ready, which includes CI.
4. **"Code looks good" ≠ "Ready to merge."** Multiple dimensions must be satisfied: code quality, CI green, no merge conflicts, no unrelated changes.

### Recommended Improvements

1. **Update `verify-completion-evidence` behavior**: Add CI status as a required evidence type for PRs. The completion message for any PR-related task must include `gh pr checks` output or a statement that CI is green.

2. **Update `verification` behavior**: Add "Check CI status" as an explicit step in the verification procedure, alongside running formatter and tests locally.

3. **PR review checklist**: Create a behavior or template for PR reviews that includes:
   - [ ] Code reviewed
   - [ ] CI passing (`gh pr checks <number>`)
   - [ ] No unrelated changes (`gh pr diff --name-only`)
   - [ ] PR description up to date
   - [ ] No merge conflicts

### Actions Taken

- [x] Recorded Failure #16 with root cause analysis (this file)
- [x] Updated `verify-completion-evidence` behavior to require CI status for PRs
- [ ] Update `verification` behavior with CI check step (recommended)
- [ ] Create PR review checklist behavior (recommended)
- [ ] Monitor PR #164 CI status — do not approve until green

---

*Note: Failures #1-#10 were recorded in the prior project location (nsheaps/claude-utils). This log continues the numbering sequence. See `.claude/tmp/session-briefing.md` for a summary of prior failures.*
