# Iterate Workflow — spec → local → iterate → extract → revalidate

**Status:** Draft. Source: Nate Discord [1505422829166919701](https://discord.com/channels/1490863845252665415/1497431286661517353/1505422829166919701) (2026-05-17 04:12Z).

This spec captures the iterative-improvement workflow that has emerged as the cheapest path from "idea" to "stable plugin in `nsheaps/ai-mktpl`". It is also intended as an input to the `agentic-behavior` plugin's planned self-improvement / "dream cycle" capability — the cycle by which an agent identifies a gap in its own behavior, drafts a fix, validates it locally, and pushes the fix back into shared infrastructure.

## Why this workflow exists

Two failure modes the workflow avoids:

1. **Plugin-first.** Drafting a behavior change directly inside a plugin in `nsheaps/ai-mktpl` means every iteration is a PR cycle: branch, push, install, restart-or-reload, observe, fix, push, install, restart, observe. Cycle time is minutes-to-hours per iteration, dominated by CI + review.
2. **Local-forever.** Drafting locally in an agent repo (`bin/hooks/`, `.claude/skills/`) is fast — single edit, hot-load, observe — but if the change is never extracted to a plugin, it lives in one agent's repo and the other agents can't benefit. Local drift accumulates.

The iterate workflow keeps cycle time short while the design is unsettled, and then pays the plugin-extraction tax exactly once when the design has stabilized.

## The 8 phases

### 1. Spec the desired behavior in a document FIRST

Open a markdown file in the relevant repo (`docs/specs/draft/<name>.md` for cross-agent specs, `.claude/specs/<name>.md` for agent-local specs). State the goal in 1-3 paragraphs, then list:

- The **trigger** (when does this behavior fire?)
- The **expected behavior** (what should happen?)
- The **observable signal** (how do we know it fired correctly?)
- Open questions

This forces design-before-code. The spec doc is also the artifact you point peer agents + the handler at when you want input. Don't skip this phase even when the change feels obvious — the _act of writing it down_ surfaces holes.

### 2. Make local changes in the agent repo

Implement against the spec inside the agent repo you happen to be running in. Edit `bin/hooks/`, `.claude/skills/`, `.claude/settings.json` directly. Commit frequently to your agent repo's `main` — small commits are recoverable; large ones are not.

The advantage of local: edits are visible immediately. Hooks reload on next tool call. Skills reload on next invocation. Settings re-read on next process spawn. You can be three iterations into refinement before a plugin PR would even reach the lint check.

### 3. See it work in the running agent

Hot-load wherever possible:

- `.claude/settings.json` — reloaded on next claude session start, often within the same session for hook settings
- `.claude/skills/<name>/SKILL.md` — reloaded on next `Skill(<name>)` invocation
- `bin/hooks/*.sh` — read fresh on each hook event
- `bin/agent` and `bin/lib/*` — require full session restart (see [deprecated-agent spec](../deprecated-agent.md))

If your change requires a restart and you cannot reasonably restart this session, validate on a peer agent first (see `feedback_launcher_changes_validate_on_nonself_first.md` in alex's memory).

### 4. Iterate on the process based on observed behavior

The spec is hypothesis; the running agent is the experiment. Expect the first implementation to be wrong in ways the spec didn't predict — that's the point of doing it locally first. Note divergences in the spec doc as you discover them; the spec evolves alongside the implementation.

Stopping condition: the local implementation produces the spec's observable signals reliably across the cases the spec enumerates, and any cases the spec didn't cover have been added.

### 5. Once stable, extract to a plugin in `nsheaps/ai-mktpl`

When the local implementation has stabilized:

- Open a worktree in `nsheaps/ai-mktpl`, create a feature branch
- Copy the local files into the appropriate plugin (`plugins/<plugin-name>/skills/<skill-name>/SKILL.md`, `plugins/<plugin-name>/hooks/scripts/<script>.sh`, etc.)
- Adjust paths and references to be plugin-relative (no hardcoded `~/.agents/...` paths)
- Update the plugin's `plugin.json` to declare new hooks/skills
- Open the PR

This is the only PR that needs review/CI. Everything before this was working code in your agent repo; the PR is just moving it into the shared marketplace.

### 6. Replace local changes with plugin reference

Once the plugin PR is merged and tagged (`@x.y.z`):

- In your agent repo's `.claude/plugins.json` (or equivalent), add the plugin at the new version
- Restart the agent — the plugin's hooks/skills/settings now load from the marketplace install dir
- Delete the local files that the plugin now supersedes — they would otherwise win per the local-overrides-plugin resolution order (see `.claude/rules/skill-resolution-order.md`)

This is the moment of truth: the plugin must work end-to-end without the local files to lean on.

### 7. Revalidate end-to-end via the plugin

Run the same observable-signal tests from Phase 3 against the plugin install. If they pass: extraction succeeded. If they fail: the plugin extraction is missing something the local copy had (often a hidden path, an env var, or a sibling file). Go back to Phase 4, but iterate _on the plugin branch_ this time — you've left the safe-to-iterate-locally zone.

### 8. Iterate until the plugin matches the desired functionality

Same as Phase 4, just inside the plugin. New cycle time is back to "minutes per PR" instead of "seconds per edit," so the design should be ~99% stable before reaching this phase. If you find yourself bouncing between Phase 7 and Phase 8 many times, that's a signal that Phase 4 ended too early — back to local iteration is cheaper.

## Worked example: `task-utils` plugin

The `task-utils` plugin in [nsheaps/agents PR #142](https://github.com/nsheaps/agents/pull/142) followed this workflow:

| Phase                | Artifact                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Spec              | `docs/specs/task-discipline-plugin.md` in `.ai-agent-alex` (then in nsheaps/agents)                                                                                        |
| 2. Local             | `bin/hooks/task-invariant.sh`, `bin/hooks/require-task-in-progress.sh`, `.claude/skills/manage-tasks/SKILL.md` in `.ai-agent-alex`                                         |
| 3. Observe           | Ran for ~3 weeks in alex with frequent rule additions as edge cases surfaced (background-agent prefix conventions, validation-steps parser, MONITORING(monitor-id) format) |
| 4. Iterate           | All edits committed to `alex/main` directly; coach text refined inline; SKILL.md rewrote multiple times                                                                    |
| 5. Extract           | Copied to `plugins/task-utils/{hooks,skills}/` in nsheaps/agents; adjusted `plugin.json` to declare the hook + skill                                                       |
| 6. Replace           | Once `task-utils@0.1.0` published, alex switched its `.claude/plugins.json` to reference the plugin and removed the local copies                                           |
| 7. Revalidate        | The same TaskCreate / TaskUpdate flow exercised continuously in this session — including this very task — uses the plugin, not the local code                              |
| 8. Iterate-on-plugin | Subsequent fixes (e.g., validation-steps parser tightening per [PR #143](https://github.com/nsheaps/agents/pull/143)) landed as plugin PRs in the regular review cycle     |

Total local iteration time: ~weeks. Total plugin-extraction PR cycle: ~1 day. Ratio of insight-per-hour during local vs. plugin phases: roughly 10:1 in favor of local.

## When NOT to use this workflow

- **Tiny one-off fixes** (typo, single-line bug fix): go straight to the upstream PR. The workflow overhead isn't worth it for changes that won't need to iterate.
- **Cross-agent state changes** (env vars, secrets, infra): cannot validate locally in one agent because the change crosses agent boundaries. Skip directly to the plugin PR and validate via peer-agent restart.
- **Changes the user wants merged urgently** ("fix this now"): the handler's tempo wins. Skip local iteration; ship to plugin direct; iterate post-merge.

## Cross-link: future `agentic-behavior` dream-cycle integration

The `agentic-behavior` plugin already documents anti-patterns and behavior corrections. A planned "dream cycle" capability is the agent's autonomous version of this workflow:

1. Agent observes its own behavior diverging from a memory rule or spec.
2. Agent drafts a corrected rule or skill update in the relevant local file (`.claude/rules/`, `.claude/skills/`).
3. Agent validates locally over the next several interactions.
4. Once stable, agent (or its handler-approved subagent) opens a PR to extract the fix to `agentic-behavior` or another shared plugin.

This is the iterate workflow with the agent itself in the Phase 4 driver's seat instead of the human handler. The trigger is internally generated ("I keep making this mistake") rather than externally directed ("fix this for me").

The spec, the local change, the observation, the extraction, and the revalidation are all the same 8 phases — only the source of the spec changes.

## Open questions

- **Where do local files live?** Some teams prefer `bin/hooks/` (where this draft assumes), some prefer `.claude/hooks/`. Need a convention.
- **Plugin-extraction PR descriptions**: should they always link to the local files they're extracting from, or is the spec-doc link sufficient?
- **How long is "stable" in Phase 4?** Days? Weeks? Number of edit-free interactions? Probably some per-plugin judgement, but a heuristic would help (e.g., "no edits in 5 consecutive agent sessions").
- **Iteration-on-plugin (Phase 8) cost recovery**: if iteration cost is 10× higher post-extraction, when is it worth going _back_ to local? Currently no rule — needs experience to codify.

## Definitions

- **agent repo** — One of `~/src/nsheaps/.ai-agent-{alex,henry,jack}/`. Each has its own `bin/`, `.claude/`, `mise.toml`. Files here load _only_ for that agent.
- **plugin** — A directory under `~/src/nsheaps/ai-mktpl/plugins/<name>/` with `plugin.json`, `skills/`, `hooks/`, etc. Published as a versioned tag and installed via `nsheaps/ai-mktpl`. Files here load for _any_ agent that declares the plugin in its `.claude/plugins.json`.
- **observable signal** — A concrete, automatically-checkable indicator that the behavior fired correctly. Hook firing, file modified, task lifecycle transition, Discord message format, etc.
- **dream cycle** — Future capability in `agentic-behavior`: agent autonomously runs this 8-phase workflow on itself when it detects a behavior gap.
