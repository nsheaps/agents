---
type: milestone-request
created: 2026-05-25T19:47:57Z
created_epoch: 1779738477
state: to-triage
project: ai-agents
requester: contacts://heaps-group/byGithubUsername/nsheaps
source_doc: docs/project-tracking/MASTER.md
source_header: "validate task-utils sub-agent delegation"
events:
  - {
      ts: 2026-05-25T19:47:57Z,
      by: alex,
      change: "created from MASTER.md milestone-extraction sweep (project-setup step 3, via sonnet subagent)",
    }
---

# Milestone request: validate task-utils sub-agent delegation

## Original MASTER.md content

> - `I26`: make sure task-utils updated and doesn't block you from doing a few of these tasks at the same time, especially with the backgrounding mechanism with agents.
>   - 🆕 `I13`: Update task-utils to have a configuration to block or warn or quiet, something like
>     ```yaml
>     tasks:
>       maxInProgress: 3 # block setting another to in-progress if 3 are in progress
>       tooManyTasksLimit: 1 # print "blocK' on post tool use with warning about too many tasks in progress. Remind about delegating to subagent
>     ```
>
> <!-- next-id: C9 -->

## Triage notes

(empty — to be filled during triage)
