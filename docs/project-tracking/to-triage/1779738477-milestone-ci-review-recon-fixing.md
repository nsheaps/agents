---
type: milestone-request
created: 2026-05-25T19:47:57Z
created_epoch: 1779738477
state: to-triage
project: ai-agents
requester: contacts://heaps-group/byGithubUsername/nsheaps
source_doc: docs/project-tracking/MASTER.md
source_header: "CI review recon + fixing"
events:
  - {
      ts: 2026-05-25T19:47:57Z,
      by: alex,
      change: "created from MASTER.md milestone-extraction sweep (project-setup step 3, via sonnet subagent)",
    }
---

# Milestone request: CI review recon + fixing

## Original MASTER.md content

> - `I25`: Take note of what the state of the review bot is in nsheaps/agents and other repos and let me know. Test it if you don't know
>
> 10. 🆕 `C8`: Lets look through all those transcripts and items. it's a lot to look through and a lot to waste tokens on, which I don't want to quite yet, so we'll focus on dumping all the data, then targeted extraction of everything related to the henry review workflow _(related: [agents#117](https://github.com/nsheaps/agents/issues/117) — reusable review dispatch; substantial progress via [PR #160](https://github.com/nsheaps/agents/pull/160), [PR #164](https://github.com/nsheaps/agents/pull/164), and in-flight [PR #165](https://github.com/nsheaps/agents/pull/165))_
>     1. We'll do that by writing a script to dump an entire transcript from a discord channel and we'll dump all the channels and all the threads
>     2. We'll also write a script to dump files for all the issues and prs in every repo we've been working in
>     3. We'll use programatic tools to look for mentions in those transcripts, claude transcripts, issues, etc, to get a comprehensive view of what we actually want to do with henry. For each mention we'll note which file and where, then we'll use sonnet agents to go Read the files and extract any useful info into summary files (with access to more before/after), then more sonnet agents to compile those iteratively into a comprehensive spec for the CI Review bot (both with the scope of henry, but noting that I think long term it's gonna be independent and all logic and review data shared in every agent)
>     4. build a small toolset that takes those structured pieces of data that you extracted and allows you to query for the data, rather than reading the files directly.
>     5. ⏸️ `R1`: Lets get this working with henry's repo for now. Once it's working, we can move it to a private repo at a later step
>        1. do it based on what we learned from before from learning through transcripts and commit histories and pr comments etc. No leaf unturned for data found on this machine. Use haiku to find things with natural language, sonnet to evaluate them for meaning. NEVER use opus to read through transcripts. ALWAYS use query tools to read transcripts.
>           1. add note to archiecture_draft in agents repo root for arch mantras, always try to prevent an agent from directly reading a file that's structured of any sort.
>              1. js/ts, use a lang server and ast to query around
>                 1. maybe that's overkill?
>              2. markdown
>                 1. consider converting to html/toon/tron with query tools

## Triage notes

(empty — to be filled during triage)
