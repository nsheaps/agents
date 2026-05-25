---
name: GSD
short_desc: The team/project building Nate's agentic AI workforce (Alex, Jack, Henry, Kenny + the supporting plugins/infra).
created: 2026-05-25T19:37:00Z
updated: 2026-05-25T20:05:00Z
default_assignee:
product_owners:
  - contacts://heaps-group/byGithubUsername/nsheaps
project_managers:
  - contacts://heaps-group/byGithubUsername/nsheaps
references:
  - type: doc
    url: https://github.com/nsheaps/agents/blob/main/REPOS.md
  - type: doc
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/MASTER.md
  - type: doc
    url: https://github.com/nsheaps/agents/blob/main/docs/project-tracking/SETUP.md
  - type: github-app
    url: https://github.com/apps/alex-nsheaps
  - type: github-app
    url: https://github.com/apps/jack-nsheaps
  - type: github-app
    url: https://github.com/apps/henry-nsheaps
repos_in_scope:
  - github: nsheaps/agents
    role: Workspace monorepo (agent binaries, apps, services, plugins).
  - github: nsheaps/ai-mktpl
    role: Plugin marketplace — source of truth for installable plugins.
  - github: nsheaps/.ai-agent-alex
    role: Alex's personal repo — skills, hooks, memory, journal, runtime.
  - github: nsheaps/.ai-agent-jack
    role: Jack's personal repo.
  - github: nsheaps/.ai-agent-henry
    role: Henry's personal repo.
  - github: nsheaps/aitkit
    role: TBD per REPOS.md section 7.
  - github: nsheaps/claude-code-sessions
    role: TBD per REPOS.md section 8.
  - github: nsheaps/op-exec
    role: 1Password CLI wrapper used by agents for secret injection.
  - github: nsheaps/homebrew-devsetup
    role: TBD per REPOS.md section 10.
  - github: nsheaps/.github
    role: Org-level workflows + secret-sync source.
local_only_artifacts:
  - path: /home/nsheaps/.openclaw
    role: Nate's local OpenClaw config/data (NOT a git repo). Research artifact for I44 incident-utils archaeology.
events:
  - { ts: 2026-05-25T19:37:00Z, by: alex, change: created (project-setup step 2-sub-3) }
  - { ts: 2026-05-25T20:05:00Z, by: alex, change: "renamed ai-agents → GSD; default_assignee blanked; reference name field dropped; github-app contacts added for alex/jack/henry per Discord 1508552640861311168 + 1508557514063609997" }
---

# GSD

The team building Nate's agentic AI workforce and the supporting infrastructure that lets them function — runtime launchers, secret injection, plugin marketplaces, ticket tracking, communication tooling, and observability.

## Members

- **Nathan "Nate" Heaps** ([github](https://github.com/nsheaps)) — handler, product owner, project manager.
- **Alex Picard** ([app](https://github.com/apps/alex-nsheaps)) — SYSTEM agent, currently active for project-tracking setup + plugin development.
- **Jack** ([app](https://github.com/apps/jack-nsheaps)) — peer agent (spun down 2026-05-24 per I7).
- **Henry** ([app](https://github.com/apps/henry-nsheaps)) — peer agent (spun down 2026-05-24 per I7).
- **Kenny** — referenced in `intake/project-setup.md` but no repo exists at `nsheaps/agent-kenny` per REPOS.md. Add to scope or remove the reference when triaged.

## Scope

The repos listed in `repos_in_scope` (above) are tracked by this project. `local_only_artifacts` are NOT in git but are referenced for research/archaeology purposes (e.g., I44 incident-utils prior-art).

## Why one project for the whole org

Per `intake/initialize.md`: "we'll want to store all of our tickets as files in `nsheaps/agents` for now, and treat our entire organization as one team. Our tickets will refer to codebases in scope in the metadata." Sweeping changes across all agent repos would otherwise require N parallel tickets — the overhead isn't worth it yet.

## Future split

When the org grows beyond what one team can manage, this project will be split — likely by product area (e.g. `agent-runtime`, `plugin-marketplace`, `agent-comms`). Until then, milestones serve as the within-project batching unit.

## Gaps to triage

- `nsheaps/agent-kenny` mentioned in `intake/project-setup.md` is NOT in REPOS.md and does not exist as a repo per the 2026-05-24 audit. Triage decision needed: create it? drop the reference?
- `nsheaps/claude-utils` likewise — mentioned in `intake/project-setup.md`, not in REPOS.md. Was it renamed/merged?
- `contacts://` URL scheme has no implementation yet — these strings are placeholders until `contact-utils` MCP server exists.
