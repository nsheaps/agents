---
type: feature
id: GSD-74
legacy_ids:
  - FXP/1.6
created: 2026-05-28T03:15:00Z
state: done
project: GSD
priority: 3
requester: contacts://heaps-group/byGithubUsername/nsheaps
references:
  - id: fixprompt-source
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L26
  - id: commit-6b8df10
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/6b8df10
  - id: commit-b10bb8f
    type: github-commit
    url: https://github.com/nsheaps/.ai-agent-alex/commit/b10bb8f
  - id: skill-developing-plugins-locally
    type: doc
    url: https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/skills/plugin-dev/SKILL.md
  - id: fixprompt-dashboard
    type: github-issue
    url: https://github.com/nsheaps/.ai-agent-alex/issues/20
events:
  - {
      ts: 2026-05-28T03:15:00Z,
      by: alex,
      change: "backfilled — work shipped 2026-05-26, ticket created retroactively per Nate Discord 02:30Z directive to GSD-link existing Phase-1 done items",
    }
---

# FXP/1.6 — developing-plugins-locally skill

## Original ask

From [fixprompt.md L26][^fixprompt-source]:

> PDITID Recall in the files, look for plugin-dev, it suggests a mechanism for you to do plugin development locally. Write that skill directly into your agent repo. Ignore tickets for now, just use your tasks.

## Status

**state=done** — shipped 2026-05-26 in two commits:

- [commit `6b8df10`][^commit-6b8df10] — initial skill creation as `plugin-dev`
- [commit `b10bb8f`][^commit-b10bb8f] — renamed to `developing-plugins-locally` per naming convention

Skill lives at [`.claude/skills/plugin-dev/SKILL.md`][^skill-developing-plugins-locally] in the alex repo. Provides guided end-to-end workflow for creating and iterating on plugins locally before upstreaming to ai-mktpl.

## Related

- [GSD-64](./GSD-64-fxp-1-10-host-alex-local-plugins.md) — FXP/1.10 (host alex local plugins, related local-dev workflow)
- [Fixprompt dashboard][^fixprompt-dashboard] (issue #20)

[^fixprompt-source]: https://github.com/nsheaps/.ai-agent-alex/blob/main/docs/journal/2026/05/25/fixprompt.md#L26

[^commit-6b8df10]: https://github.com/nsheaps/.ai-agent-alex/commit/6b8df10

[^commit-b10bb8f]: https://github.com/nsheaps/.ai-agent-alex/commit/b10bb8f

[^skill-developing-plugins-locally]: https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/skills/plugin-dev/SKILL.md

[^fixprompt-dashboard]: https://github.com/nsheaps/.ai-agent-alex/issues/20
