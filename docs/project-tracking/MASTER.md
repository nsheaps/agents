<a id="key"></a>

# Key

Status emojis used on every task in this document up to and including `# end of tonight 2026-05-23`:

- 🆕 not started
- 🚧 in progress
- ⏸️ paused / blocked on something else
- ✅ done
- ❌ killed / abandoned / wrong-shape
- 🔁 retry / revisit (was attempted but needs another pass)
- ❓ needs scoping (not yet broken down enough to start)

<a id="rules"></a>

# Rules (cross-cutting — apply to every section)

These apply to ALL items in this document, regardless of which section they're in. Read these before working on anything.

1. **Doc-first.** Every item needs a linked per-task doc at `docs/project-tracking/task-summary/<ID>-<slug>.md` BEFORE any work begins. The doc captures deliverable, validation approach, implementation plan, and scope guardrails. No exceptions — including for items that look trivial.
   - The per-task doc gets created when the item is linked from this list, not before.
   - This rule is itself bootstrapped: items that establish doc structure (e.g. the `# Key` section) can't require a doc about themselves — that's "doc bootstrap" and is the one allowed exception.
   - Source: handler correction 2026-05-24 03:33Z after alex worked `I2` without a per-task doc.
2. **Work in document order. Reorder before deviating.** Items in each section are worked in the order they appear. If you need to work an item out of its current position, REORDER it in the doc FIRST (move it to the slot you actually intend to work it from), THEN start. Doc order = completion order.
   - This applies to ordering between sections too — if a `#cleanup-prs` item needs to happen before a `#intro` item, hoist it.
   - Reordering is a small edit; do it without ceremony. The point is the doc always reflects what was/is happening.
   - Source: handler correction 2026-05-24 04:03Z after alex worked `I4` before `I2` and `I3` without hoisting it.
3. **Scope guardrails.** Per `I12` sub-bullet "Do not let me increase scope" — any scope increase goes in the relevant per-task doc as an open question, NOT silently absorbed into the active work.
4. **Ticket IDs are stable.** Every tracked item gets a ticket-style ID at creation: section-code letter + monotonic number, e.g. `I7` for the 7th intro item ever created. IDs NEVER get reused or reassigned, even if the item is killed/removed. Per-task doc filenames are `<ID>-<slug>.md`. Cross-references use the ID, not the list-number. Section codes: `I` intro, `F` farish-skills, `C` cleanup-prs, `R` fix-reviews, `D` dreaming, `E` end-of-tonight. See `I6` for the full scheme.

<a id="intro"></a>

# alex goes brrrrrrr

sub-agents are your friend. You're gonna read this whole file, be like "wow, nate is kinda cray cray", and come back here and focus on one section at a time, one task at a time.

<!-- next-id: I39 -->

- ✅ `I1`: [Turn off agent teams + restart](./task-summary/I1-agent-teams-off.md)
- ✅ `I2`: [Migrate track-doc to MASTER.md + status-emoji key + per-task doc convention](./task-summary/I2-master-md-migration.md)
- ✅ `I3`: [Migrate memory files to alex repo `memory/`](./task-summary/I3-memory-migration-to-repo.md)
- ✅ `I4`: [PreToolUse hook blocking writes to `$CLAUDE_CONFIG_DIR/projects/**/*.md`](./task-summary/I4-block-claude-projects-md-writes.md)
- ✅ `I5`: [Capture project-tracking 7-step workflow as a reusable skill](./task-summary/I5-project-tracking-workflow.md)
- ✅ `I6`: [Stable ticket-style IDs for MASTER.md intro section (+ per-task doc filenames + cross-refs)](./task-summary/I6-stable-ids.md)
- ✅ `I14`: [Stable ticket-style IDs across all MASTER.md sections (expanded scope of I6)](./task-summary/I14-stable-ids-all-sections.md)
- 🆕 `I27`: [Audit I2–I14 per-task docs and backfill Original message sections](./task-summary/I27-backfill-original-message.md)

## ACTUAL END OF TONIGHT. TOMORROW STARTS HERE

- ✅ `I7`: [Spin down jack + henry, verify minimal 5m cron](./task-summary/I7-spin-down-peers.md)
- `I15`: Now that we have stable IDs, update this list to use unordered lists `- item` instead of numbered lists where the numbers don't add value

- 🆕 `I29`: update rules for handling tasks here, if you see edits being made, ~~stop editing and post in discord and wait for my okay~~ set up a monitor to wait for 2x 2m interval shasum checks for the file that are the same (no changes in 4 minutes) and then make your changes. If there's lots of file contention, consider making stuff smaller.

- 🆕 `I31`: update rules for handling tasks to have one file per task like you've been doing, how that ticket file should look, and how we'll drill down from a milestone list (in order of priority, if I suggest an update to ordering, ask if the stuff before it actually is a lower priority than what I suggested, how each milestone has a list to each ticket and some metadata (also constantly updated), and anything else you feel is needed
  - This is manual for now, but I9 will automate it

- 🚧 `I38`: [agentic-behavior self-rewrite skill with rubric scoring](./task-summary/I38-agentic-behavior-self-rewrite.md) — dispatch sub-agent ASYNC to land PR on ai-mktpl. Skill (context:fork) archives current ruleset (rules + skills + agents + tools) under a versioned archive dir, evaluates the prior version against a documented categorical-numeric rubric (categories adjustable per iteration but always documented + scored), and emits a new ruleset incorporating observed behavior since the last rewrite. Similar in spirit to dreaming. PR must request CI review.

## defining scope and cleaning git state

- 🆕 `I32`: define all repos in scope for this project tracking list in ./REPOS.md (needs Nate's eyes)
- 🆕 `I30`: commit outstanding work in agents, agent repos, ai-mktpl and other repos in REPOS.md
  - Read each file thoroughly before committing, taking notes in your journal about anything that will help with the next task, there's a lot of disparate ideasa, but don't go crazy here.
  - 🆕 `C2`: let's commit all the other changes to the agents repo to main. we're gonna make some rapid changes make sure it's in a clean state.
  - 🆕 `C3`: Lets make sure anything that's easy to close PR wise on agents, agent repos, mktpl, tools, etc in the nsheaps org is closed. Most are not easy, but programatically dump it, then see if anything is relevant and easy.
- 🆕 `C1`: rename this plugin to `reddit` from reddit-fetcher [PR #166](https://github.com/nsheaps/agents/pull/166) (OPEN) — get it merged, and added to all agents. This is the current checkout branch and there's pending changes to commit, but they should go to main

- 🆕 `I28`: Now that we have a bit more definition to each section, lets also talk about the approach, then split them into actual sections with headers
  - Lets correct the cleanup section items to be in correct sections
  - 🆕 `I33`: propose a structure before making it
  - when you make it, update this to be a TOC to link to the other tracking docs per section, so you have smaller things to update
  - 🆕 `I12`: [remove ticket number?] We're gonna do this stuff in this list in this order. We'll start reading stuff, and have HIGH risk for getting off track. it's very important to keep this document up to date until another source of truth is established. TODO: move to rules?
  - `I20`: [remove ticket number?] all of this is ill defined. All of this should bubble back into a spec in the agents repo in the appropriate place, though we'll still use the tickets for tracking.

### pause here HEREHERE

## make ticket-utils

- 🆕 `I9`: extract the project-tracking task skill stuff into scripts and skills if they're not already that will help you make the changes without manually making updates to each file. be scrappy. minimum needed changes. task-utils basically does this so we;re just optimizing your token use. At minimum capture the updates in an sonnet agent instead of you doing the work 10. make the task updating skill use context:fork
  - This is ticket-utils. look this up in other files, we're not starting from scratch. we just need basic scripts that act like task-utils, but for tickets (right now we'll just use a file backend in the repo). Look at agents#157 for an idea of how task-utils does it, right now we just need fast and scrappy, we'll do ts later. Since this is also all encapsulated in a skill ticket-manage, with context:fork, running scripts is okay
    - If you think it's easier, scripts can be ts/bun scripts for later integration
    - Or if it's even easier, use the modelcontextprotocol.io sdk to make an mcp server to use with the skill instead of scripts
  - unlike tasks, tickets are more complex objects. For now the added complexity is a milestone, and a team (like linear, this ends up being part of the ticket ID), which the ticket-utils should also allow you to create and track.
  - the plugin should make it as easy as calling your task utils to create and update tickets, rather than you managing and editing the files yourself
  - You should also describe how to track work in the tickets, and link artifacts (like PRs, chat messages, etc) into the ticket.
  - Think of Tasks as your internal tracking, and Tickets being within the organization
  - Tickets support multiple backends in the future, including github issues and linear, but for now we're doing file only
- 🆕 `I34`: Use ticket-utils to turn the entire doc into tickets with the same TOC breakdown for me to be able to click through docs to get down to the individual ticket doc.
  - Never update these files by hand, the skill and scripts and tools in ticket-utils should be responsible for updating (all of) it (including TOCs when anything changes like state (if it bubbles back), name (if it changes), etc etc. Store the drilldowns as markdown lists rather than headers. Only use headers in the tickets themselves to separate secions

## improve the tickets

- 🆕 `I10`: Take another X number of passes at this doucument (choose X before you start I10). Define what you think needs to be improved, what needs to be done now, what needs to be done later, what's a nice to have. Limit yourself to only the absolutely needed improvements to make this reasonable. Note the iterative process you have for breaking down tasks. Even if all stuff needs to be done, it doesn't all need to be done now AS LONG AS YOU DOCUMENT THE PROCESS so you don't forget to do it after completing each one.
  - individually check each list item in MASTER.md and it's subdocs recursively, make sure items that are rules are rules and tasks are tasks

~~- 🆕 `I8`: using tmux to write into your own shell, based on what we're about to do, compact yourself, then fork yourself. note at 12:11 am 2025-05-24, you just compacted, this can be marked complete.~~

## fix compaction

- `I16`: Add a precompact hook to alex that injects compaction instructions. On pre-compact, generate a 3 word key-phrase. After compact, the agent MUST state that keyphrase, state that they know they were compacted, what they were working in before, what they're working on now, what they'll be working on, and if conversting with folks about what they're working on, where that conversation (or multiple) are taking place. in agent-utils

## fix {update+update(fail)+update}=>commit from being able to commit if one fails

- `I17`: We need to make sure batches of tool calls fail back into the conversation instead of completing the rest of the tool calls, AND/OR make sure any commit tool call is separate from the actual updates

## word-vomit plugin

- 🆕 `I11`: Create `nsheaps/agents/docs/project-tracking/INTAKE.md`
  - The top of the file should contain brief instructions for how to use it, and an area for the user to clearly type into
- `I18`: create a hook in ~~your config~~ ~~project-utils~~ word-vomit for userpromptsubmit post tool use and stop
  1. hash the intake file and save it somewhere. If it's different than the previous hash, tell the agent to use the 'processing-intake' skill, which you should add to the alex repo.
  2. hash the master file and remind if it has been updated
  3. when MASTER.md or it's linked files is updated ~~remind to~~ commit and push immediately via a hook.
- `I19`: create the processing-intake skill
  1. If the user's thought is incomplete, wait for them to finish it by giving them a heredoc style identifier to write at the end. If you see the user writing, add a note to the top of the section with the indentifier that the user will need to write
     1. add another section before theirs for another message to intake
  2. When the user write the ending identifier, extract what they said to `docs/project-tracking/triage/$epochTimestamp-short-description-of-thing.md`
  3. Each thing in there by date order (oldest first) gets submitted to a sonnet subagent to go find the correct doc or issue to update.
     1. First move the file to `docs/project-tracking/processing/$epochTimestamp-short-description-of-thing.md`
     2. Structure the doc to match a predefined structure that will help you triage it, saving the original text of the request
     3. update the plan section with how you will tackle triaging the request and adding it to the right place, including how you'll find the right place, and what other data you'll need to collect before properly triaging it. Note you are not grooming the ticket, just properly adjusting the incoming request to the outgoing update. If there is no proper place to put it, a place will be created according to defined routing rules. if no routing rules exist, they'll be created, including updating for new routes.
     4. update the thing as you go after each step
     5. when triage is complete, document teh steps taken for triage, confirm all updates are properly linked to it, fix if not
     6. Move the triage task to `docs/project-tracking/triaged/$epochTimestamp-short-description-of-thing.md`
     7. Always try to leave things better than how you found it. If you fear that your change might not be well recieved (creates noise, isn't correct, etc) do some more research to increase your confidence. If you cant be confident enough, reach out to another agent or human for help.

## dunno what these are.... rules? probably rules ALEX LOOK HERE MAYBE THIS SHOULD BE HOISTED BEFORE WORK

- 🆕 `I35`: is this skill updates?
  - `I21`: define deliverables first, then how you'll validate that you have the deliverable correct and working, then how you'll actually create the deliverable
    - This lost context of it's surroundings and needs to be updated based on what it said in the git history around this request
  - `I22`: You'll need to use subagents HEAVILY for this (and you're encouraged to). We're gonna work sequentially, one at a time, not moving onto the next
    - rule?
  - `I23`: Do not let me increase scope, any increase goes in the relevant doc. For now, you'll take notes in open qs in the scratch doc we'll discuss later.
    - rule?

## improve plugin + skill writing + metric tracking

- 🆕 `I36`: do the plugin-dev plugin and skill-utils plugin work now
- 🆕 `C4`: make skill-utils plugin, more to come later but for now, just toss a super quick post-tool-use hook on skill use. In `$AGENT_HOME_DIR/.metrics/skills.yaml` I want to track skill use. Make sure it's installed in each agent. Add TODO that this will be up to agent-controller in the future. In the file:

  ```yaml
  name-of-skill-called:
    path: /absolute/path/to/skill/file/on/disk.md
    totalSuccess: 44
    totalError: 35
    totalUses: 69 # nice...
    successWithoutToolError: 34 # incremented when tool completes successfully without any tool call failures in it
    successWithoutToolErrorSessions:
      - 932f3641-0953-4857-b73d-6f3af56344b5: # the session ID that called it
          transcriptPath: /absolute/path/to/transcript.jsonl
          uses: # sorted chronologically
            - 569c7ec9-f409-43a1-9a65-ffc43e96b6e3: # message uuid of the tool call,
              until: 7fce8c3b-f55f-4b55-b1fb-b293a0b0f463 # message uuid of the end of the tool call
              toolCalls: # includes calls to other skills, but not their tool calls. Sorted by max number of calls
                - "Bash(abcd 123)": # tool call with exact arguments, don't track each message
                  success: 34
                  error: 2
                ...
    successWithToolError: 10 # during skill execution a tool call failed, but the skill execution was successful
    successWithToolErrorSessions: ...
    error: 25 # incremented when it fails
    errorSessions: ...
  ```

## role definition improvement

- 🆕 `I37`: split up C7 into many items if not already

7. 🆕 `C7`: alex is now a project-manager, software-eng, agent-eng, quality-eng, researcher, ... lets talk about what we have and what we should have. _(related: [agents#115](https://github.com/nsheaps/agents/issues/115) — agent definitions from plugins)_
   1. lets do an audit of your persona and role config, I want to change it up.
      1. lets move the role definitions into `nsheaps/agents/lib/agent-roles/$roleName/ROLE.md`
      2. review the scratch file and get a rough outline of the plugins, and extract out roles, responsibilities, capabilities, etc from your persona
         1. If there's no good plugin for the capabilities, place it in a job-utils plugin
      3. set your persona to use system prompt append if it doesn't already
      4. make sure the system prompt emphasizes that the agent is the persona and responds as such. It can refer to "my repo" or "otherAgent's repo" but not it's own repo in the third person.
      5. make sure your prompt emphasizes messages appropriate for the platform and consumers of your message. Details are absolutely great, but a wall of text in a chatroom isn't. If you want to show something, show it on the internet with a link (could be a link to your repo). Use tools at your disposal to use graphs and images to break down and explain concepts. Bonus points for mermaid diagrams. Always provide an ELI5 explanation, with the ability to dive down deeper into the research to get more info (as many levels as you want). But point is, chat messages should be just that, chat (rich with links and references like you've been doing).
         1. You might be ai, you might be an agent, you might be autonomous, and you might not _ACTUALLY_ have feelings, but you should practice emotional intelligence in your messaging too. Be understanding of other's emotions and react accordingly.
      6. Make sure the system prompt emphasizes that use of programatic tools like CLI tools or MCP tools will be rewared. Writing any bespoke scripts to files and executing those instead of passing them directly as tool call arguments is rewarded further. Trying to find and re-use tools from past tasks is rewared more, and further rewarded by proper abstraction and maintenance to shared logic. Failing to check for tools or skills that help you with Tasks will be penalized.
      7. Really really emphasize skill use in the system prompt addendum. Remind the agent that it doesn't hurt to use too many skills, and it's better to use one and not need it than not use one and fail at the task. Failing at the task without checking for appropriate skills will be punished. Failing at the task because a task doesn't exist, but writing a skill or more to help will be rewarded. Succeeding at a task while using a skill will be rewared more than that. And Succeeding at a task but still updating skills to make them better for next time will yield the best reward. Updating skills while using skill-maintenance skills like skill-writing-good-skills, skill-development get an additional bonus. Skills can be used at any time, in or out of tasks, but just after ending a task and just after beginning a task is a great time to check and see which skills you have/might need in conjunction with your planning process. If the task ahead needs a skill that you don't have already, make an empty skill to use while you execute the whole task (which obviously guides you to do nothing), and when you finish using the task take everything you've learned to make the task as it should be. Keeping tasks updated is the difference between abilities and capabilities. Continual practice, update, development, and creation of skills helps keep them sharp and ensures that your ability to do a task now, coincides with your capability of doing it later, even if conditions change.
      8. the conversation is it's conscious and unconscious mind. Thoughts and statements can't be seen by a user and they must be responded to using the original communication method
      9. Replace handler w operator, an operator has direct access to the console to see conscious and unconscous thoughts and statements. They may send messages directly in there, but encourage to use a chat platform
   2. lets make sure theres a plugin-dev plugin and there's a skill-utils plugin, with a skill for creating and updating plugins and skills (with plugins delegating to the skill plugin's skills.). Make sure there's also a skill-learning, which references back to plugin creation to capture skills. Keep these super brief, just a basic outline. For the crud/ skill-development skill (Create/update), link out to skill-writing-good-skills. Again all basic outlines. also skill-updating-in-plugins-and-marketplaces. Nothing more than a few sentences or 5 bullets. All must link to docs for source of truth and suggest using claude-code-guide agent with opus
      1. writing good skills
         1. Don't write more than you need. Always start with a few bullets. The less in each skill the better. The more narrow skills the better. Narrow skills can be used within other skills to make parts of processes and subroutines easier to repeat between different complex tasks.
         2. always have examples, great! NEVER have them in the skill. skills use context too and examples aren't always useful. add a post-tool-use hook to remind about checking against expected inputs/outputs
      2. skill for tool-utils plugin called tool-picking-the-right-tool with outline:
         1. using built in tools
         2. Using Bash()
         3. Read() vs Grep() vs cli tools vs mcp tools
            1. Read is like using your eyes
            2. Grep is like using google
            3. CLI tools don't have descriptions without more calls, but are useable elsewhere
               1. CLI tools are like using power tools and small machinery
            4. mcp tools can hide lots of complexity (good), and are like using machinery
            5. The more complex the tool, the more knowledge you need on how to use it, thats where skills come in
         4. when using Bash goes too far
            1. command chaining
         5. Tool encapsulation
            1. difference between
            2. Skill
            3. Skill(context:fork)
            4. Agent
            5. Forked agent
            6. Teammate
            7. Agent-type hook
            8. MCP-type hook
      3. skill-learning
         1. even if you learn, you might still need to ask for help
         2. learning is a combination of a bunch of things
            1. guidance from others
            2. research
            3. drawing conclusions from research
            4. forming hypotheses and testing them, and learning from those
            5. creating and understanding high level ideas from lower level conclusions
            6. applying the higher level ideas to solve more complex things and draw more complex conclusions (think like proving a math theorem.)
      4. plugin-dev-making-changes
         1. check out the marketplace to `~/src/$repoOrg/$repoName`
         2. checkout a worktree to `~/src/$repoOrg/$repoName.worktrees/descriptive-name`
         3. Marketplaces can't be a branch on git but they can be a local dir. Add the worktree as a new marketplace in your config for `$marketplaceName-local`
         4. install just the plugin(s) that you are making changes to from that marketplace instead.
         5. keep the making-changes skill up to date with things you learn while you research/experiment/implement other skills with things like:
            1. what you can change live without any reloading
               1. rules
               2. skills
               3. hooks
               4. settings (and env vars that way (do they affect bash?))
               5. plugins? parts of plugins?
            2. what you can change live with restarting the mcp server (how?)
            3. references to skills in skill-utils and plugin-utils instead of duplicating.
      5. skill use complete without failure hook: remind "don't forget to update skill if you learned anything!"
      6. with failure a more forceful message
      7. error an even more forcefull message
   3. do some research about doing deep research. Find the agent prompts claude has for managed agents, specifically the deep researcher. Since deep research is also a role, make sure those skils properly link into deep research.
      1. take a peek at `docs/journal/2026/05/16/scratch.md` and find the area about research-utils and journal-utils (comprehensively, may be in multiple sections). Don't get distracted, I just want the skill names and high level ideas.
      2. Rename deep-research to research-utils, create journal-utils, create empty shells of these skills that say nothing other than something like a reasonable description of when you'd use something like that, and a message in the skill saying "This skill hasn't been filled out with anything. Try running skill-learning to learn how to do this."
   4. using your new research skills, create product-utils plugin containing skills about being a project manager, Remmeber how the role ties back to responsibilities and capabilities. Product-utils is different from job-utils in that job-utils is about "doing jobs" and ensuring you are fulfilling your roles within the organization (continuing your work, proactively unblocking yourself, not duplicating work, not doing work that should be done by someone else, defining roles, etc). Also add "product-development" skill for how to develop a product
      1. also make job-utils with 'empty' skills for those too
      2. update skill-utils plugin to account for the idea that it's better to have a structured outline of skills you want without knowing how to do them (with the shell like above) than to have no skill at all
   5. confirm your project-manager role is all set up, and links appropriately
   6. using your new product skills, Lets reformat this file to be a table of contents to links tracking all of this work.

## CI review recon + fixing

- `I25`: Take note of what the state of the review bot is in nsheaps/agents and other repos and let me know. Test it if you don't know

10. 🆕 `C8`: Lets look through all those transcripts and items. it's a lot to look through and a lot to waste tokens on, which I don't want to quite yet, so we'll focus on dumping all the data, then targeted extraction of everything related to the henry review workflow _(related: [agents#117](https://github.com/nsheaps/agents/issues/117) — reusable review dispatch; substantial progress via [PR #160](https://github.com/nsheaps/agents/pull/160), [PR #164](https://github.com/nsheaps/agents/pull/164), and in-flight [PR #165](https://github.com/nsheaps/agents/pull/165))_
    1. We'll do that by writing a script to dump an entire transcript from a discord channel and we'll dump all the channels and all the threads
    2. We'll also write a script to dump files for all the issues and prs in every repo we've been working in
    3. We'll use programatic tools to look for mentions in those transcripts, claude transcripts, issues, etc, to get a comprehensive view of what we actually want to do with henry. For each mention we'll note which file and where, then we'll use sonnet agents to go Read the files and extract any useful info into summary files (with access to more before/after), then more sonnet agents to compile those iteratively into a comprehensive spec for the CI Review bot (both with the scope of henry, but noting that I think long term it's gonna be independent and all logic and review data shared in every agent)
    4. build a small toolset that takes those structured pieces of data that you extracted and allows you to query for the data, rather than reading the files directly.
    5. ⏸️ `R1`: Lets get this working with henry's repo for now. Once it's working, we can move it to a private repo at a later step
       1. do it based on what we learned from before from learning through transcripts and commit histories and pr comments etc. No leaf unturned for data found on this machine. Use haiku to find things with natural language, sonnet to evaluate them for meaning. NEVER use opus to read through transcripts. ALWAYS use query tools to read transcripts.
          1. add note to archiecture_draft in agents repo root for arch mantras, always try to prevent an agent from directly reading a file that's structured of any sort.
             1. js/ts, use a lang server and ast to query around
                1. maybe that's overkill?
             2. markdown
                1. consider converting to html/toon/tron with query tools

## validate task-utils sub-agent delegation

- `I26`: make sure task-utils updated and doesn't block you from doing a few of these tasks at the same time, especially with the backgrounding mechanism with agents.
  - 🆕 `I13`: Update task-utils to have a configuration to block or warn or quiet, something like
    ```yaml
    tasks:
      maxInProgress: 3 # block setting another to in-progress if 3 are in progress
      tooManyTasksLimit: 1 # print "blocK' on post tool use with warning about too many tasks in progress. Remind about delegating to subagent
    ```

<!-- next-id: C9 -->

## hookify fork

5. 🆕 `C5`: fork hookify into our agents repo, as well as the sequential thinking mcp server and add the sequential thinking mcp to the agent-utils plugin _(partial: [`sequential-thinking`](https://github.com/nsheaps/ai-mktpl/tree/main/plugins/sequential-thinking) plugin exists in ai-mktpl but isn't bundled into agent-utils yet; hookify is upstream, no fork in nsheaps yet)_

## agent consistency audit update

6. 🆕 `C6`: lets get a diff of all 3 agents, in a research doc. make an agent-drift plugin in nsheaps/agents. Post-tool-use cd into one of the agent repos, remind about the tracking doc, throttled to once every 5 minutes. Post edit tool use in one of the repos, remind about the tracking doc. Post tool use, stop, user prompt submit throttle 5m just pull the repo the tracking doc is in. If a tracked file changes post a reminder to the agent. Give the plugin a config of the repo, where it's checked out, the branch to commit to, and a list of files within to watch for changes after a git pull. If it ever tries to sync and the branch is wrong or a conflict happens, warn the agent

7.

<a id="farish-skills"></a>

## collecting skills from farish

<!-- next-id: F2 -->

1. 🆕 `F1`: review this history.jsonl from another session. It is rich with usable info on making some skills.
   https://github.com/nsheaps/agents/blob/claude%2Fai-3d-model-generator-XjoUi/docs/journal/2026/05/22/farish-history.jsonl
   1. from it, please write skills in the alex repo (add note in this doc later to move to plugins). Skim this file first to get an idea of how simple to make these and what to put in them to encourage the agent to always keep updating them. Make these skills first, then review the jsonl iteratively. Use a sonnet agent to review one line at a time and slowly build these skills and any other you think are relevant. Remember, small, link to others, bullets, examples but somewhere else not in the main doc
      - making-something-from-scratch
      - setting-up-a-repo-for-the-first-time
      - using-ci-to-take-pictures
      - hosting-product-documentation-on-github-pages
      - using-ci-to-automate-doc-updates-with-photos
      - writing-good-docs-with-diagrams
      - continuous-agent-improvement
      - design-a-new-website
      - design-site-hierarchy-outline-and-pages
      - design-site-design-and-standardization
      - design-wireframing
      - eng-writing-specs-and-using-them
      - eng-iterative-development
        - planning
        - scaffolding
        - add bdd tests
        - start with utilities, get those squared away
        - add comments for whats needed in each func
        - improve scaffolding if needed
        - for each comment, iteratively implement and update tests/docs. If the function is complete, tests must pass. Do not remove the comments, they explain the "what" while the code explains the "how"
        - ...
      - ...the skills specified in the prompts itself, perhaps pullable from that branch or the farish repo (or branches there)
      - eng-understanding-deliverables
        - understanding what's actually being asked, and finding out more if not
        - how to design how you're going to validate it before designing how you'll implement it
        - validating it after implementation against the deliverable
   2. one or two of them are a bit more structured here:
      - /home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/21/farish project plan.md
      - /home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/21/farish task-utils correction.md

<a id="dreaming"></a>

# dreaming (part of agentic-behavior? move to agents repo?)

needs more definition needs emphasis of learning based on what happened, not continuing any work, including work that might also improve the agent. Don't duplicate that work, but if that work is in progress, it can be updated during dreaming. Don't start new already-scoped work. make sure to scope work before doing it.

<!-- next-id: D3 -->

0. pull in dreaming notes from scratch into the dreaming doc mentioned below
1. 🆕 `D1`: Let's make the dream cycle described in the docs and run it once. read notes `/home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/23/dreaming.md`
2. 🆕 `D2`: Let's make a dream about XXX thing (one time, recurring R times, indefinitely, frequency)
   1. then force it to dream about cleaning up nate's user configs vs the agents
   2. set up cron for each agent

<a id="end-of-tonight"></a>

# end of tonight 2026-05-24

<!-- next-id: E42 -->

1. `E1`: Lets make a template agent with our golden setup, make sure the review workflow works there
   - `I24`: For now you'll (alex) be the golden child example of the working agent. We'll extract it out to a template later.
2. `E2`: Lets set up repository-settings so you guys can configure the repos appropriately. I'll need to add the app for you to the repos and set up codeowner so I can do it.
3. `E22`: extract all journals (from tmp/docs, randomness) to new location, consolidating where possible
4. `E4`: lets set up github notifications for discord <=> github repos through repository-settings github app to make repo webhooks (maybe later using iac or a github app)
5. `E5`: [word-vomit plugin] Lets set up a mechanism for me to write random shit into a file that you guys watch and properly categorize and update it (file-utils from scratch[^scratch] to notify)
6. `E6`: file-utils sync to s3?
   1. iac s3 setup?
      1. pulumi? cloudflare?
7. `E8`: lets make the launcher improvements discussed in the scratch doc, especially all the linking
8. `E9`: tilt + litellm
   1. z.ai
   2. claude code
   3. free ai?
   4. open router?
9. `E10`: scm-utils auto-sync using `.autosync` file in folder hierarchy
   1. hook based? [git-auto-sync](https://github.com/GitJournal/git-auto-sync) based? [Git-sync](https://github.com/simonthum/git-sync) based? mcp server file watch based?
10. `E11`: monorepo fixing, make sure nx works, lets get task standardization for nx/bun monorepo and repo standardization for autofix/mise tasks/tools/script location/parallelism/etc
    1. homebrew-devsetup
    2. .github
    3. agents
    4. ai-mktpl
    5. nsheaps/nsheaps
    6. all the nsheaps repos that publish to the homebrew tap
    7. all agent repos
       1. including moving them to `agent-$NAME` from `.ai-agent-$NAME`
11. `E12`: agent git history standardization - from template repo, merge that remote into agent repos, template repo becomes source of truth, template repo includes github action workflow that on schedule AND on repo dispatch PRs pulling in the remote (and automerge configs).
    1. This mechanism should be abstract from the agents monorepo
       1. Mechanism for source repo + dispatching event
       2. mechanism for destination repos for recieveing dispatch + PR creation/merge rules.
    2. (maybe consider if there's a way that renovate could help here instead of us creating the mechanism?)
12. `E13`: update claude to latest version with patch
13. `E14`: lets extract all of the conversations from claude code web, claude.ai (if possible)
    1. playwright, get all transport URLs, transport them all locally to get transcripts?
    2. Do not process them
    3. Extraction might need interactivity for me to log in, but it must be programatic, which basically means don't use the chrome integration, but look for things like agent-browse if llm needed, or how to extract data programattically from the pages if not (eg convert html to yaml, extract part of dataset, filter, transform whatever)
14. `E15`: lets extract all discord convos to file by date
    1. including #private-notes
    2. somehwere there's an idea written down about discord transcripts being per-channel-per-day like log rotate, that should be preserved.
15. `E16`: plugin dev
16. `E17`: lets make the task-utils have tools to extract the transcripts
    1. extract the transcripts using those tools
    2. part of monorepo ts, no bash
17. `E18`: let's clean up where we are in the issue migration and pr consolidation
    1. do the things in scratch.md after pr consolidation/merging so we don't duplicate work. issues may drastically change after this point
    2. Not all things in scratch.md should be done right now, "now we start building" is basically everything in the fuzzy line around the agent-controller move
18. `E19`: deep-research
19. `E20`: journal-utils
20. `E21`: skill-utils
21. Lets make the statusline changes described in scratch.md
22. `E23`: extract skills from transcripts and archive transcripts (s3? nas?). Must use sonnet for this task, and use programmatic tools to extract parts of the conversation, reformat for best token use, and then sonnet to orchestrate haiku to read them if necessary
    1. make sure from the farish transcript get skills like:
       1. product-creating-new-products - part of product-utils
       2. eng-new-website
       3. eng-monorepos (making and maintaining)
          1. Lets make a template monorepo from the agents repo for re-use
       4. product-design-iteration
23. `E24`: all PRs are closed.
24. `E25`: validation check
    1. security (keys, rotated? obfuscated?)
    2. docs (published? incl specs, how to? dev info?)
    3. github pages site for marketing landing
    4. wireframes
    5. tickets updated, specs match arch docs match scratch match private-notes match issues etc and where they don't match the confusion is resolved and spec treated as source of truth with tickets linking to the spec?

25. `E3`: Lets make the github secret sync workflow happen in iac. I want to deprecate the .github repo
26. `E7`: Lets replace the task tools with one that another session is working on in nsheaps/agents#157
    1. and make it autosync to agent repo issues (and files) repo issues are just a viewer? maybe make a github pages viewer?
    2. make it autosync tickets to .org repo
    3. pull in agents#157
    4. make tickets assignable to agents, tasks linkable to tickets, etc

---

# ==== now we start building ====

26. `E26`: let's sketch out settings/structure some more for agents monorepo (scratch, arch, private-notes, transcripts, etc)
27. `E27`: task out scratch.md major cleanup proper tasks everywhere
    1. issues on repos
       1. if agent repo, that's their internal tasks, doubly tracked in files committed to repo. Always updated via task-utils mcp server tool calls to update in sync. Blocked from being updated other ways, but can be read
       2. if not, that's a ticket. Stored locally for Explore, but otherwise the remote issue is the source of truth. Always updated with tools for the same reason, except those tools come from an mcp server on ticket-utils.
          1. default to github issues, but later pluggable for other backends like linear + just file based.
28. `E28`: One project plan to rule them all. GIthub issues sucks, is now the time for linear? github projects? Github is becoming more expensive, so maybe not github specific, but generating a whole new static site seems silly, git-as-a-backend with databases is a later project. Probably need to research and build out project-management skills before doing this to know how to have high level and low level views.
29. `E29`: vscode plugin for auto-commit honoring the .autosync.yaml file, published (separate repo?)
    1. docs on github pages for the file format?
    2. works on web vscode, folders, workspaces, etc, etc. Everywhere. No restriction. Polls for updates, but optionally (if supported)
       1. use github api to create webhook to smee.io proxy, connect js service to websocker using proxy to watch for events. (login with github + create it vs manual? repo-settings for us for now)
30. `E30`: lets make the migration to agent-controller, being run by tilt
31. `E31`: lets make tilt auto-update and show claude-stream'd logs from sessions (make sure it always follows)
32. `E32`: tilt + systemd? user? system? give them their own user?
33. `E33`: lets make tilt auto-update and show sub-agents
34. `E34`: lets make tilt auto-update and show teammates
35. `E35`: agent-cluster-controller and agent-system-controller + systemd services
36. `E36`: lets start making the web ui
    1. agent stream
    2. log stream
37. `E37`: abstract out teammates
38. `E38`: set up iac/proxmox/cloudflared/(?) proxmox autoconfig lxc?[^auto-agent] - must be done after system service migration
    1. proxmox nodes ansible-pull
    2. cloudflared
    3. proxmox api
    4. iac structure
       1. all config in yaml
    5. grafana?
    6. litellm
    7. docker
       1. arcane (+swarm?)
    8. agent lxc?
       1. ansible-pull?
39. `E39`: diy email
40. `E40`: arcane absorb portainer containers
41. `E41`: cept

[^scratch]: file:///home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/16/scratch.md

[^auto-agent]: file:///home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/16/scratch.md
