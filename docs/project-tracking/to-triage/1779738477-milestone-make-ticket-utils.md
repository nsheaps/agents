---
type: milestone-request
created: 2026-05-25T19:47:57Z
created_epoch: 1779738477
state: to-triage
project: ai-agents
requester: contacts://heaps-group/byGithubUsername/nsheaps
source_doc: docs/project-tracking/MASTER.md
source_header: "make ticket-utils"
events:
  - { ts: 2026-05-25T19:47:57Z, by: alex, change: "created from MASTER.md milestone-extraction sweep (project-setup step 3, via sonnet subagent)" }
---

# Milestone request: make ticket-utils

## Original MASTER.md content

> - 🆕 [`I9`](./task-summary/I9-ticket-utils.md): extract the project-tracking task skill stuff into scripts and skills if they're not already that will help you make the changes without manually making updates to each file. be scrappy. minimum needed changes. task-utils basically does this so we;re just optimizing your token use. At minimum capture the updates in an sonnet agent instead of you doing the work 10. make the task updating skill use context:fork
>   - This is ticket-utils. look this up in other files, we're not starting from scratch. we just need basic scripts that act like task-utils, but for tickets (right now we'll just use a file backend in the repo). Look at agents#157 for an idea of how task-utils does it, right now we just need fast and scrappy, we'll do ts later. Since this is also all encapsulated in a skill ticket-manage, with context:fork, running scripts is okay
>     - If you think it's easier, scripts can be ts/bun scripts for later integration
>     - Or if it's even easier, use the modelcontextprotocol.io sdk to make an mcp server to use with the skill instead of scripts
>   - unlike tasks, tickets are more complex objects. For now the added complexity is a milestone, and a team (like linear, this ends up being part of the ticket ID), which the ticket-utils should also allow you to create and track.
>   - the plugin should make it as easy as calling your task utils to create and update tickets, rather than you managing and editing the files yourself
>   - You should also describe how to track work in the tickets, and link artifacts (like PRs, chat messages, etc) into the ticket.
>   - Think of Tasks as your internal tracking, and Tickets being within the organization
>   - Tickets support multiple backends in the future, including github issues and linear, but for now we're doing file only
> - 🆕 `I34`: Use ticket-utils to turn the entire doc into tickets with the same TOC breakdown for me to be able to click through docs to get down to the individual ticket doc.
>   - Never update these files by hand, the skill and scripts and tools in ticket-utils should be responsible for updating (all of) it (including TOCs when anything changes like state (if it bubbles back), name (if it changes), etc etc. Store the drilldowns as markdown lists rather than headers. Only use headers in the tickets themselves to separate secions

## Triage notes

(empty — to be filled during triage)
