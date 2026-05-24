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

1. **Doc-first.** Every item needs a linked per-task doc at `docs/project-tracking/task-summary/<slug>.md` BEFORE any work begins. The doc captures deliverable, validation approach, implementation plan, and scope guardrails. No exceptions — including for items that look trivial.
   - The per-task doc gets created when the item is linked from this list, not before.
   - This rule is itself bootstrapped: items that establish doc structure (e.g. the `# Key` section) can't require a doc about themselves — that's "doc bootstrap" and is the one allowed exception.
   - Source: handler correction 2026-05-24 03:33Z after alex worked `#intro#2` without a per-task doc.
2. **Scope guardrails.** Per `#intro#7` sub-bullet "Do not let me increase scope" — any scope increase goes in the relevant per-task doc as an open question, NOT silently absorbed into the active work.

<a id="intro"></a>

# alex goes brrrrrrr

sub-agents are your friend. You're gonna read this whole file, be like "wow, nate is kinda cray cray", and come back here and focus on one section at a time, one task at a time.

1. ✅ [turn off agent teams and restart.](../../project-tracking/task-summary/agent-teams-off.md)
2. 🆕 spin down jack and henry. Alex, make sure your 5m cron is still set up and the cron is nothing more than telling you to run idle-5m skill (might already be done).
3. 🆕 using tmux to write into your own shell, based on what we're about to do, compact yourself, then fork yourself.
4. 🚧 fix the numbering in here before I go crazy. numbers don't matter, make them all have emoji for status. Define a key at the top level. Don't work on more than one. Move this entire thing to `nsheaps/agents/docs/project-tracking/MASTER.md`. You must start a doc for each one and link it from this list before doing anything, including work. Each of these gets a doc at `nsheaps/agents/docs/project-tracking/task-summary/TASK.md` TO BE CREATED ONLY WHEN YOU LINK IT.
5. 🆕 Take another X number of passes at this doucument. Define what you think needs to be improved, what needs to be done now, what needs to be done later, what's a nice to have. Limit yourself to only the absolutely needed improvements to make this reasonable. Note the iterative process you have for breaking down tasks. Even if all stuff needs to be done, it doesn't all need to be done now AS LONG AS YOU DOCUMENT THE PROCESS so you don't forget to do it after completing each one.
6. 🆕 Create `nsheaps/agents/docs/project-tracking/INTAKE.md`
   1. The top of the file should contain brief instructions for how to use it, and an area for the user to clearly type into
   2. create a hook in your config for userpromptsubmit post tool use and stop
      1. hash the intake file and save it somewhere. If it's different than the previous hash, tell the agent to use the 'processing-intake' skill, which you should add to the alex repo.
      2. hash the master file and remind if it has been updated
      3. when master is updated remind to commit and push immediately.
   3. create the processing-intake skill (later this will be part of word-vomit)
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
7. 🆕 We're gonna do this stuff in this list in this order. We'll start reading stuff, and have HIGH risk for getting off track. it's very important to keep this document up to date until another source of truth is established.
   1. all of this is ill defined. All of this should bubble back into a spec in the agents repo in the appropriate place.
   2. define deliverables first, then how you'll validate that you have the deliverable correct and working, then how you'll actually create the deliverable
   3. You'll need to use subagents HEAVILY for this (and you're encouraged to). We're gonna work sequentially, one at a time, not moving onto the next
   4. Do not let me increase scope, any increase goes in the relevant doc. For now, you'll take notes in open qs in the scratch doc we'll discuss later.

   For now you'll be the golden child. Take note of what the state of the review bot is in nsheaps/agents and let me know.

8. 🆕 Update task-utils to have a configuration to block or warn or quiet, something like

   ```yaml
   tasks:
     maxInProgress: 3 # block setting another to in-progress if 3 are in progress
     tooManyTasksLimit: 1 # print "blocK' on post tool use with warning about too many tasks in progress. Remind about delegating to subagent
   ```

   make sure it's updated and doesn't block you from doing a few of these things at the same time.

<a id="farish-skills"></a>

## collecting skills from farish

1. 🆕 review this history.jsonl from another session. It is rich with usable info on making some skills.
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
      - ...the skills specified in the prompts itself, perhaps pullable from that branch or the farish repo (or branches there)
      - eng-understanding-deliverables
        - understanding what's actually being asked, and finding out more if not
        - how to design how you're going to validate it before designing how you'll implement it
        - validating it after implementation against the deliverable
   2. one or two of them are a bit more structured here:
      - /home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/21/farish project plan.md
      - /home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/21/farish task-utils correction.md

<a id="ball-rolling"></a>

# lets get the ball rolling

<a id="cleanup-prs"></a>

## cleanup easy open PRs

1. 🆕 rename this plugin to `reddit` from reddit-fetcher https://github.com/nsheaps/agents/pull/166 get it merged, and added to all agents. This is the current checkout branch and there's pending changes to commit, but they should go to main
2. 🆕 let's commit all the other changes to the agents repo to main. we're gonna make some rapid changes make sure it's in a clean state.
3. 🆕 Lets make sure anything that's easy to close PR wise on agents, agent repos, mktpl, tools, etc in the nsheaps org is closed. Most are not easy, but programatically dump it, then see if anything is relevant and easy.
4. 🆕 make skill-utils plugin, more to come later but for now, just toss a super quick post-tool-use hook on skill use. In `$AGENT_HOME_DIR/.metrics/skills.yaml` I want to track skill use. Make sure it's installed in each agent. Add TODO that this will be up to agent-controller in the future. In the file:

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

5. 🆕 fork hookify into our agents repo, as well as the sequential thinking mcp server and add the sequential thinking mcp to the agent-utils plugin
6. 🆕 lets get a diff of all 3 agents, in a research doc. make an agent-drift plugin in nsheaps/agents. Post-tool-use cd into one of the agent repos, remind about the tracking doc, throttled to once every 5 minutes. Post edit tool use in one of the repos, remind about the tracking doc. Post tool use, stop, user prompt submit throttle 5m just pull the repo the tracking doc is in. If a tracked file changes post a reminder to the agent. Give the plugin a config of the repo, where it's checked out, the branch to commit to, and a list of files within to watch for changes after a git pull. If it ever tries to sync and the branch is wrong or a conflict happens, warn the agent
7. 🆕 alex is now a project-manager, software-eng, agent-eng, quality-eng, researcher, ... lets talk about what we have and what we should have.
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
8. 🆕 Lets look through all those transcripts and items. it's a lot to look through and a lot to waste tokens on, which I don't want to quite yet, so we'll focus on dumping all the data, then targeted extraction of everything related to the henry review workflow
   1. We'll do that by writing a script to dump an entire transcript from a discord channel and we'll dump all the channels and all the threads
   2. We'll also write a script to dump files for all the issues and prs in every repo we've been working in
   3. We'll use programatic tools to look for mentions in those transcripts, claude transcripts, issues, etc, to get a comprehensive view of what we actually want to do with henry. For each mention we'll note which file and where, then we'll use sonnet agents to go Read the files and extract any useful info into summary files (with access to more before/after), then more sonnet agents to compile those iteratively into a comprehensive spec for the CI Review bot (both with the scope of henry, but noting that I think long term it's gonna be independent and all logic and review data shared in every agent)
   4. build a small toolset that takes those structured pieces of data that you extracted and allows you to query for the data, rather than reading the files directly.

<a id="fix-reviews"></a>

# lets fix reviews...for real, y'all need reviews

1. ⏸️ Lets get this working with henry's repo for now. Once it's working, we can move it to a private repo at a later step
   1. do it based on what we learned from before from learning through transcripts and commit histories and pr comments etc. No leaf unturned for data found on this machine. Use haiku to find things with natural language, sonnet to evaluate them for meaning. NEVER use opus to read through transcripts. ALWAYS use query tools to read transcripts.
      1. add note to archiecture_draft in agents repo root for arch mantras, always try to prevent an agent from directly reading a file that's structured of any sort.
         1. js/ts, use a lang server and ast to query around
            1. maybe that's overkill?
         2. markdown
            1. consider converting to html/toon/tron with query tools

<a id="dreaming"></a>

# dreaming

needs more definition needs emphasis of learning based on what happened, not continuing any work, including work that might also improve the agent. Don't duplicate that work, but if that work is in progress, it can be updated during dreaming. Don't start new already-scoped work. make sure to scope work before doing it.

1. 🆕 Let's make the dream cycle described in the docs and run it once. read notes `/home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/23/dreaming.md`
2. 🆕 Let's make a dream about XXX thing (one time, recurring R times, indefinitely, frequency)
   1. then force it to dream about cleaning up nate's user configs vs the agents
   2. set up cron for each agent

<a id="end-of-tonight"></a>

# end of tonight 2026-05-23

1. Lets make a template agent with our golden setup, make sure the review workflow works there
2. Lets set up repository-settings so you guys can configure the repos appropriately
3. Lets make the github secret sync workflow happen in iac. I want to deprecate the .github repo
4. lets set up github notifications for discord <=> github repos through repository-settings github app to make repo webhooks (maybe later using iac or a github app)
5. [word-vomit plugin] Lets set up a mechanism for me to write random shit into a file that you guys watch and properly categorize and update it (file-utils from scratch[^scratch] to notify)
6. file-utils sync to s3?
   1. iac s3 setup?
      1. pulumi? cloudflare?
7. Lets replace the task tools with one that another session is working on in nsheaps/agents#157
   1. and make it autosync to agent repo issues (and files) repo issues are just a viewer? maybe make a github pages viewer?
   2. make it autosync tickets to .org repo
   3. pull in agents#157
   4. make tickets assignable to agents, tasks linkable to tickets, etc
8. lets make the launcher improvements discussed in the scratch doc, especially all the linking
9. tilt + litellm
   1. z.ai
   2. claude code
   3. free ai?
   4. open router?
10. scm-utils auto-sync using `.autosync` file in folder hierarchy
    1. hook based? [git-auto-sync](https://github.com/GitJournal/git-auto-sync) based? [Git-sync](https://github.com/simonthum/git-sync) based? mcp server file watch based?
11. monorepo fixing, make sure nx works, lets get task standardization for nx/bun monorepo and repo standardization for autofix/mise tasks/tools/script location/parallelism/etc
    1. homebrew-devsetup
    2. .github
    3. agents
    4. ai-mktpl
    5. nsheaps/nsheaps
    6. all the nsheaps repos that publish to the homebrew tap
    7. all agent repos
       1. including moving them to `agent-$NAME` from `.ai-agent-$NAME`
12. agent history standardization - from template repo, merge that remote into agent repos, template repo becomes source of truth, template repo includes github action workflow that on schedule AND on repo dispatch PRs pulling in the remote (and automerge configs).
    1. This mechanism should be abstract from the agents monorepo
       1. Mechanism for source repo + dispatching event
       2. mechanism for destination repos for recieveing dispatch + PR creation/merge rules.
    2. (maybe consider if there's a way that renovate could help here instead of us creating the mechanism?)
13. update claude to latest version with patch
14. lets extract all of the conversations from claude code web, claude.ai (if possible)
    1. playwright, get all transport URLs, transport them all locally to get transcripts?
    2. Do not process them
    3. Extraction might need interactivity for me to log in, but it must be programatic, which basically means don't use the chrome integration, but look for things like agent-browse if llm needed, or how to extract data programattically from the pages if not (eg convert html to yaml, extract part of dataset, filter, transform whatever)
15. lets extract all discord convos to file by date
    1. including #private-notes
    2. somehwere there's an idea written down about discord transcripts being per-channel-per-day like log rotate, that should be preserved.
16. plugin dev
17. lets make the task-utils have tools to extract the transcripts
    1. extract the transcripts using those tools
    2. part of monorepo ts, no bash
18. let's clean up where we are in the issue migration and pr consolidation
    1. do the things in scratch.md after pr consolidation/merging so we don't duplicate work. issues may drastically change after this point
    2. Not all things in scratch.md should be done right now, "now we start building" is basically everything in the fuzzy line around the agent-controller move
19. deep-research
20. journal-utils
21. skill-utils
22. extract all journals (from tmp/docs, randomness) to new location, consolidating where possible
23. extract skills from transcripts and archive transcripts (s3? nas?)
    1. make sure from the farish transcript get skills like:
       1. product-creating-new-products - part of product-utils
       2. eng-new-website
       3. eng-monorepos (making and maintaining)
          1. Lets make a template monorepo from the agents repo for re-use
       4. product-design-iteration
24. all PRs are closed.
25. validation check
    1. security (keys, rotated? obfuscated?)
    2. docs (published? incl specs, how to? dev info?)
    3. github pages site for marketing landing
    4. wireframes

---

==== now we start building ====

26. let's sketch out settings/structure some more for agents monorepo (scratch, arch, private-notes, transcripts, etc)
27. task out scratch.md major cleanup proper tasks everywhere
    1. issues on repos
       1. if agent repo, that's their internal tasks, doubly tracked in files committed to repo. Always updated via task-utils mcp server tool calls to update in sync. Blocked from being updated other ways, but can be read
       2. if not, that's a ticket. Stored locally for Explore, but otherwise the remote issue is the source of truth. Always updated with tools for the same reason, except those tools come from an mcp server on ticket-utils.
          1. default to github issues, but later pluggable for other backends like linear + just file based.
28. One project plan to rule them all. GIthub issues sucks, is now the time for linear? github projects? Github is becoming more expensive, so maybe not github specific, but generating a whole new static site seems silly, git-as-a-backend with databases is a later project. Probably need to research and build out project-management skills before doing this to know how to have high level and low level views.
29. vscode plugin for auto-commit honoring the .autosync.yaml file, published (separate repo?)
    1. docs on github pages for the file format?
    2. works on web vscode, folders, workspaces, etc, etc. Everywhere. No restriction. Polls for updates, but optionally (if supported)
       1. use github api to create webhook to smee.io proxy, connect js service to websocker using proxy to watch for events. (login with github + create it vs manual? repo-settings for us for now)
30. lets make the migration to agent-controller, being run by tilt
31. lets make tilt auto-update and show claude-stream'd logs from sessions (make sure it always follows)
32. tilt + systemd? user? system? give them their own user?
33. lets make tilt auto-update and show sub-agents
34. lets make tilt auto-update and show teammates
35. agent-cluster-controller and agent-system-controller + systemd services
36. lets start making the web ui
    1. agent stream
    2. log stream
37. abstract out teammates
38. set up iac/proxmox/cloudflared/(?) proxmox autoconfig lxc?[^auto-agent] - must be done after system service migration
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
39. diy email
40. arcane absorb portainer containers
41. cept

[^scratch]: file:///home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/16/scratch.md

[^auto-agent]: file:///home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/16/scratch.md
