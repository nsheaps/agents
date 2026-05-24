# terms

- programatic - no LLM interaction to accomplish task
- natural language execution - LLM drives task execution, eg using Haiku to look for phrases in files in a directory
  - Should always come after programatic


# see also

- [ARCHITECTURE_DRAFT.md](file:///home/nsheaps/src/nsheaps/agents/ARCHITECTURE_DRAFT.md)
- [docs/scratch.md](file:////home/nsheaps/src/nsheaps/agents/docs/scratch.md)
- [this file](file:////home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/16/scratch.md)
- [docs/journal/2026/05/16/managing-Tasks.md](/home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/16/managing-Tasks.md)
- [ai-mktpl/plugins/agentic-behavior/README.md](file:////home/nsheaps/src/nsheaps/ai-mktpl/plugins/agentic-behavior/README.md)
- ai-mktpl
- [#private-notes](https://discord.com/channels/1490863845252665415/1497804459496046632)
- [farish project prompt](file:///home/nsheaps/src/nsheaps/agents/docs/journal/2026/05/21/farish-app.md)

# open ?
- should we have a template submodule in the agents monorepo? or separate repo? (separate repo)
- Should we have a template repo for setting up the bun/nx monorepo style (YES)
- should we have a template repo for setting up a new agent (YES, discussed elsewhere too)
- every bullet with a ? or (?)
- [PostToolBatch](https://code.claude.com/docs/en/hooks#posttoolbatch)? most hooks should proooobably be this?
- we probably should split agent-controller and agent-mcp-service and if launched without agent-controller wrapper it launches it anyway (mcp <> agent controller <> cluster controller), but it would be nice if we didn't need to launch another process...
- Do Tasks have a specific schema? If we add extra data does it get wiped?
- references? footnotes? links? urls? We should pick a term and disambiguate in the glossary
- multiple things mention auto sync, should we use off the shelf?
  - https://github.com/simonthum/git-sync
- how hard should we lean into forks in agents, skills, sessions?
- how much do agents actually rely on the contents in chat messages vs if they were sparse like human messages
- event bus + logging
  - I want lots and lots of logging
- After all these changes, do we actually have iterative instructions, like break down the task, start with an outlike, collect sources, state theories, etc?
- We need to track mods/divergences better
- still having token refresh issues
  - Agents are getting around it rather than fixing it, and worse, not reporting it
- It's rare that an agent starts up and _actually_ has no work to do, this is happening too often
- what if you put yaml in the rules folder?
- dir pattern based rules? like hookify? (hooks are still better)
  - markdown docs with frontmatter with glob pattern
  - on cwd change, if glob match, link rules to rules folder, maybe also post message into convo
    - would this apply to all running sub-agents then?
    - Maybe a way to get around, agent repo becomes user config (basically how it is today), but instead, launch the session from a known session dir/temp dir, so things can be installed and uninstalled per-session.
  - add ability for org to define rules, for instance
    - When you CD into a folder that contain files matching the target (works best if you force read/write tooling to only accept files in the cwd, never absolute paths, forcing the agent to cd to the directory first)
      ```markdown
      target: **/.claude/skills/*/SKILL.md
      ---
      - For our org, skill files must contain frontmatter, even if it's not technically required.
      ```
  - Why?
    1. is abstract from the agent harness. Dir based rules require a CLAUDE.md in the dir
    2. Rule files don't have to live in the repo, an org can share many
  - Why not?
    1. constant rule changing changes earlier parts of the transcript and requires a full uncached response
       possible mitigations:
       - inject rules into the convo after changing directory instead of into the rules folder 
- 

# milestones

- Any milestone called "pause" needs a new name
- All terms, especially those in PascalCase, Capitalized words, snake_case, kabob-case, etc, need to be defined in a glossary.
- We need to better document and categorize research tasks and open questions
- we need a milestone for an agent upgrade awareness agent, one that can
  - Test patch upgrades on new versions of claude-code
  - Review changelogs and apply changes to configs in plugins and agents
  - Review claude-source code to find out how things work
  - ...
- We need to fill in each milestone header first, we can shift around what we want
- and reorganize the list of incomplete stuff into the logical sections and milestones (not necessarily 1 per project, a project can have multiple milestones)
- 
- This is a high level view of the PR consolidation, issue migration, migration to the agents mono-repo, and many improvements along the way
  - Headings are milestones, bullets are the work in each milestone
    - Some may be documented elsewhere, some may be out of date here, or out of date elsewhere
    - we need to have a single source of truth for each milestone
    - we need docs with high level views for management, and low level views for individual contributors
    - Milestone list > one doc per milestone > break apart milestone into specs, one spec per file, specs span milestones, and contain spec-milestones within > work on one spec at a time

## March 1, when we started work on this project
## ai-mktpl deployment automation
## claude-utils
## op-exec
## ... fill in milestones from before "here"
## ... we are here ...

## ✅ secret redaction
- ~~1pass plugin, posttooluse hook needs to mutate response that greps for secret values (not names) from the ENVIRONMENT secret, and replaces with xxxxREDACTED(SECRET_NAME)xxxx~~

## alex/jack/henry - consistency check
- ~~repo push to main perms for all agents on agent repos~~
  - All agents have push permissions to each other
- ~~discord avatars match github app avatars~~
  - Discord and github have the profile pics from within their repo
  
- ▶️ bin/agent is just a symlink to nsheaps/agents/apps/agent-cli/scripts/deprecated-agent <======== CRITICAL

- ▶️ make nsheaps/agents a proper claude marketplace, port marketplace tasks and ci workflows from ai-mktpl to agents

- ▶️ the launcher logs and the initial prompt is missing the "running claude --arg1 --arg2... stuff", but appears in the console

- discord webhook + github app webook permissions + make jack set up project-notifs/#repo-name notifications
  - somehow don't let agents get these? Maybe a quiet-list in the plugin where they never get notifications? From a category? room naming pattern?
- task-utils
  - Don't allow task rename with monitoring or agent if that monitor or agent doesn'te xist, don't allow other types.
- nsheaps/agents nx monorepo setup.
  - Standardize on:
    - lint
    - format
    - test
    - build
    - release
    - run (production mode)
    - run-dev
  - Always try to autofix
    - Git hooks are helpful, but prefer dev client/agent harness hooks to apply fixes after writes instead. Githooks get in the way of saving things and getting them off computer
    - Fix in CI
    - Prefer to not rebase, else the autofixes get a little annoying
    - autofixes getting overwritten isn't the end of the world, next commit would also be auto-fixed
- Set up $AGENT_DIR env var to ~/.agents/ tbd agent-controller behavior
- create ~/.agents/.skills to ~/src/nsheaps/.org/skills tbd agent-controller behavior
- create $agentRepo/.claude/skills to ~/src/nsheaps/.org/skills tbd agent-controller behavior
- create ~/.agents/.org to ~/src/nsheaps/.org tbd agent-controller behavior
- create ~/.agents/.research and symlink agentRepo/docs/research to ~/.agents/.research/$agentName? tbd agent-controller behavior
- ~~the launcher logs still don't show the startup prompt sent to the agent (obviously without the logs)~~
- We should make bin/agent work better:
  - if a boot loop is detected before claude successfully launches, increment a counter and print a warning in the launcher logs with how many times it's been restarted before the next attempt to start it
  - setup of $AGENT_HOME_DIR should symlink $AGENT_HOME_DIR/.source to the agent repo, and set $AGENT_REPO to be to the symlink
  - updating plugins is MEGA slow...
    seed plugins using this mechanism?: https://code.claude.com/docs/en/plugin-marketplaces#pre-populate-plugins-for-containers
  - ~~in the agent repo, .claude/SYSTEM-PROMPT-ADDENDUM.md should be passed to --system-prompt-append, .claude/AGENT.md should be the persona definition with the roles and paths to details about those roles (maybe render at runtime so we can parse frontmatter from those role files and share a brief description of the role?).~~ done https://discord.com/channels/1490863845252665415/1497431286661517353/1505286179463893053
    - We need to be sure this is extracted and consistent across all agents. nsheaps/agents should enforce this rather than agent-specific behavior/configuration
  - The logs are too verbose. Launcher log file can contain all debug level logs (anything that was removed from stdout/stderr from other tools), but what's printed to console and passed to agent should be MUCH shorter (and agent prompt should call out link to full logs)
   - For plugin checking -> no updates, don't print for each plugin. Print for each one that gets updated, and if none get updated, print a "no updates for any N plugins in M marketplaces" 
   - For env vars, only print unset and export into the log file/at debug level
   - $AGENT_HOME_DIR/.journal -symlink-> $AGENT_REPO/docs/journal (+ agent-controller auto-commit?)
   - ~~ ~/.agents/.org/tasks, ~/.agents/.tasks,~~ $AGENT_HOME_DIR/.tasks -> $AGENT_HOME_DIR/.claude/tasks/agent-tasks + CLAUDE_CODE_TASK_LIST_ID="agent-tasks" agents have their own Tasks
   - always continue (if possible), but also when session starts, esp if continue, immediately perform a compaction (postcompacthook/sessionstart:compact would remind to setup the crons and stuff again?), then a fork, so a new session starts with a clean history (and perhaps a record of the fork)
     - (?) What does the forked transcript actually look like?
- agent consistency audit doc is re-verified.
  - Establish new verification skill (work with, but don't duplicate (extract where necessary) the validation steps in task-utils task management skill) that describes how to add test results to a test plan, including the date and the agent that executed it, so when we re-validate something the agent can doubly verify that the previously validated thing is _still_ true. This is extremely useful for test plans, which should be extracted from tasks where appropriately so they can be re-run. Test plans should be written in skill format and use `context: fork`. Maybe into ~/.agents/.skills?
  - all agents have the same plugins
- don't wait for handler approval
- each agent repo should be it's own marketplace as well (by directory mapping), so stuff can be written in a quickly hoistable way
## single point going forward
- multiple repos is hurting us. We will consolidate most things into nsheaps/agents, but that will come at a later (but soon) point. For now, we can load plugins using a path relative to a marketplace. Make sure plugin development skills are used frequently, guide the agent to use a worktree to make the changes, add a $marketplaceName-dev marketplace using a local directory path to the git worktree on the agent that is being used for testing and make changes that way so the validation loop is faster and before pushing the plugin and opening a PR.
  - For now, any plugin development happens by ensuring agents have a "dev" version of the marketplaces, which is a directory version, pointed at the worktree that they're doing their changes in. Runtime refreshes allow them to test functionality immediately, without interrupting other agents (if possible). Other agents can also point to that directory and do a runtime update. Sometimes a restart is necessary.
  - If the contribution to the marketplace is a hoist of logic from within the agent, keep the agent pointed at their marketplace branch until their PR is merged. While the agent is pointed there, they can then remove their local configurations and set it up for the non-dev install version. When the PR is merged, they should only need to remove the dev install for that plugin

## after henry

- somewhere is a PR for a plugin that disallows Bash(cd ... && ...) and enforces CD calls to happen separately after the dir as added to allowed dirs, can we please get that merged and added to all 3 agents?
  - Lets also disallow python -c, python3 -c, point to a skill that explains why for hook registration and security hardening
  - Lets also add a hook that maybe dispatches a haiku agent to add every tool call to permissions block

- Find and merge  auto-references plugin PRs
- need update to agent management skill: do not write directly into their console, their console is read only. Use a script to perform specific tasks that require writing into their console, but avoid it whenever possible. The agent should be able to manage their own restart proceedure. If writing into the tmux shell is needed, use a script passthrough layer.
- agent stop should note the source of the request and the current session id to shut down in the continuation prompt.
- agent start prompt (on both fresh session and new session) should encourage the agent to review the events prior to the continuation prompt. If a new session, then it should review the previous transcript's tail as well.
- please remove the idea of a session heartbeat from any plugins and agent repos (the heartbeat mentioned in the launcher), reduce the complexity.
- the .claude.json seed should disable prompt suggestions, since when you read the pane it looks like text is already entered and you don't see the cursor.
- we need to see if we can update to the lastest claude code on the agents, one at a time, verifying with henry first
- the self-restart stuff shouldn't block on exit, it should force the appropriate committing of things that need to be saved at that moment (including the continuation prompt), and be okay with leaving things uncommitted. It should be configurable so it can detect if the machine is ephemeral, or provide cleanup info, and let the agent confirm by stopping again immediately after if they are okay with it.
- double verify please: each agent should be running in debug mode, and in verbose mode, and the session start hook for agentic behavior should say something like
> <system>
>   Plugin: AGENTIC-BEHAVIOR
>   Version: $thePluginVersion
>   <agent-harness-settings>
>     Verbose: $(true or false)
>     Debug: $(false or $pathToDebugLogs)
>   </agent-harness-settings>
> </system>

- task-utils
  - Disallow running Agent or Monitor outside of an active task
  - track monitors and crons
  - disallow naming task with monitor or agent on something that doesn't exist

## henry/CI review workflow clean up work - make reviews happen on all PRs
- find the in flight PRs for fixing henry and get those merged and properly validated
- label changes for assignment and requesting review
- repo dispatch
  - Autoassign
  - Label creation triggers the review run
- move review skill to agents repo/make sure skill works
  - plugin code-review
    - uses deep-research (dependency) skills for collecting info
    - /code-review:generate-report
  - idea: other kinds of review
- PR review text should go into nsheaps/.ai-agent-henry/docs/prs/$org/$repo/$prNumber/ and be re-used between reviews
- review should only run review after all CI completes successfully (or a specified list)

- Set up plugin for agents to auto-commit changes to their repo (or from a specified folder)
  - Maybe should auto-PR then auto merge?
- Set each agent to have known task folder using env var, don't share with all

## context reduction

- we need to really reduce jacks context
  1. promote alex to a full software engineer and agent-engineer. Upgrade him to opus[1m] and set his context compaction to 500k like jack is
  2. reduce jack to sonnet
  3. in claude-utils, there's a claude-diagnostics tool, make it work so it prints all details about the /context (it worked before but now it's broken)
  4. use claude-diagnostics (maybe need an `bin/as-agent` wrapper to set CLAUDE_CONFIG_DIR and the like? or re-use what we have?) with jack to get a good view of what's clogging the context
  5. Use the skill from the previous task to make a small, but incremental improvement to Jack with an end goal of capturing as much as possible in skills (consider in a forked context), agents, hooks, before using rules, and moving stuff to shared plugins and making jack as clean as possible, relying more on hook and skill automation than forcing the context to contain a lot of rules. Ensure captured rules and behaviors don't contracdict each other. If they do, use your best judgement to reword as a whole to capture the preferred behavior of what you think the intended desire whas.
  6. Repeat step 5 until his default context usage under 50k.

## review of this milestone file, and the architecture draft, #private-notes, to confirm/update tasks in future milestones and properly document/link


## channel message transcript dumping and auto updates based on event feed

- discord plugin add tool to export channel history to file
- henry uses it with sonnet sub-agents to extract and update the issue migration and PR migration docs based on this thread/channel history
- ci henry runs sync PR reviews to repo, agent henry runs background sync via agent-controller (super basic shell script to be replaced with a service in nsheaps/agents) (hooks or mcp) and notifies agents when there's updates and what they are (so the chat agent can discuss details of the review that might not have been mentioned in the review directly). Repo should capture any 'journal' docs for the research phase, but not transcripts. All details need to be captured in journal docs and research docs, including their references (but can be any file/folder structure you want)
- alex and jack work together with ci reviews (by henry)
- start of very basic agent-controller mcp service thing
  - checks in background, sends channel messages with background agent repo updating, tells henry when something new has been added with the commit message (the PR review)

## issue migration and PR consolidation

## better system visibility

- for every agent, lets update the statusline by making our own statusline plugin in nsheaps/agents similar to ai-mktpl's statusline plugin and how it sets itself up, I want to see
  - teams is claude's agent-teams
  - $SESSION_STATUS is from $CLAUDE_CONFIG_DIR/.claude/sessions/$pid.json
  - $REPOANDBRANCH_OR_PATH: 
    - if cwd is in git repo, print (with parens being diff from remote and after being ahdead/behind but with correct arrows, not ^ v):
      $org/$repo @ $branch (+2,-3) ^ 3 v 5 
    - if cwd is not a git repo, print absolute path, but if /a/b/c/d/e/f/g parts are on the path, truncate with ... c/d (save first 2 and last 3):
    - for context, have a mapping of model names to context size, and honor the env var to overwrite auto-compaction context size for the actual size and %
    - the [SSSTTTCCCCCCCCC] should be different colors (using ansi) and different ascii characters (for different patterns/opacities for when color is insufficient) that shows the breakdown of sections of the context used by different pieces (system prompt, tools, conversation, free space, etc). Use /context for inspiration with colors and symbols, and make it as wide as possible (using tput or COLUMNS or whatever to ensure it's the correct width)
    - The emoji before the name indicates the status as indicated by $CLAUDE_CONFIG_DIR/sessions/$CLAUDE_PID.json
      - 🧑‍💻 Agent status is "working"
      - ⏸️ Agent status is "idle"
    - Later we'll add a second emoji:
      - :brain: thinking
      - :pencil: using built-in edit tools
      - :hammer: using mcp tools
      - :eyes: using built-in read tools
      - :2 people: using an Agent tool
    - And when execution is getting wrapped in a skill
      - :mind-blown: using a skill (+ 1 emoji between status and active work)
  > ▶️ $AGENT_NAME ($AGENT_HOME_DIR) <$GIT_AUTHOR_EMAIL> | Teams: (ON|OFF)
  > claude($CLAUDE_PID, v=$CLAUDE_VERSION)://$SESSION_ID | Status: $SESSION_STATUS | Model: $MODEL (effort: $MODEL_EFFORT)
  > Ctx: 248k/500k (49.6%) [SSSTTTCCCCCCCCCFFFFFFFFF]
  > Updated: $RFC_3339_DATETIME_LOCAL_TZ
  > $REPOANDBRANCH_OR_PATH
  - When a restart is requested, the updated line instead shows as:
    > Updated: $RFC_3339_DATETIME_LOCAL_TZ | Pending restart (6m 20s ago)

- We need to start a pattern in ai-mktpl and agents, where plugins can provide a 'maintenance' hook, and prior to version bumping in CI each plugin gets it's maintenance hooks run. This lets plugins package stuff into their distribution as part of the release process. In the future, this potentially needs to happen after mono repo build processes, and can potentially bloat the repo.

## agentic behavior iteration
- when you get feedback don't just take note, audit all the rules and skills and see what contradicts it and where it should really go.
  - If you're corrected on it 2+ times your previous attempts weren't a good enough solve, keep trying to make it better
    - remember what to prefer the most:
    - plugins > local config
    - hooks > forked skills > agents with hooks > agents > skills > rules
- default 5m cron, make sure work continues, make sure to re-read and evaluate your role to make sure you're performing your responsibilities well. If you haven't done anything in 30m and it's during working hours, consider trying to continue working on tasks in your list
- hooks
  - stop - no stopping without a monitor or active agents if you have tasks?
  - stop + task -> complete
    - task-is-task-really-done
      - Does it actually work? Have you tested it? Did you document your test plan before you tested it? Did you mark your test results in the appropriate ticket? Is all the code pushed? Is the PR updated? Is there any other feedback on the PR or in chat you should be responding to?
        - If not...Keep going!
        - If it is, just try to stop again without running any tools?
- all roles for the agent should have a defined list of capabilities, authorities, and responsibilities (eg agent-manager is responsible for ensuring agent runtimes are properly running compared to the desired state, and is capable of managing agent states, restarting agents, and is allowed to authorize agent restarts). Lack of that definition defers to a PR which requires @nsheaps review, or @nsheaps holds those capabilities/authorities/responsibilities. If told by the handler or operator that a role you posess should have changes made to it, you're responsible for making the PR and getting the appropriate review to merge it. New/deleted roles must be approved by, then implemented by agent-human-resources and assigned to agents if necessary AND PR approved by nsheaps
  - teams (which can hold agents or humans via their contacts, (?) via symlinks?) can be granted authorities and responsibilities as well, but not capabilities.
  - capabilities, if implemented programatically, come with the potential benefit of auto including job- type skills
  - Are capabilities that come along with roles, or capabilites that come along with skills? What maps responsibilities to the capabilities needed to do them?
    - Agents should CONSTANTLY be keeping the roles up to date wiht related skills and capabiities?
    - maybe job role should just say you have a number of "capability-x" and "responsibility-*" skills, and other plugins should say when to use them
- (?) a role might define what you do within an organization, but not what you apply that to. We should have an OrgRole within each agent for each role that the agent can read (not a rule) and update that can add extra color. For instance, you might be a software-eng, but your orgrole states that you work on specific repos, and the tech-lead role orgrole mapping would then say which repos you're an authority on. Or another example would be focusing info, such as a designer role, and adding color that we're targeting specific devices for the designs.
  - Skills described in all of these milestones should support and encourage the use of these
- (agentic-behavior) (perhaps as an agent-manager role?) When you ask an agent to perform a procedure, you need to be extra specific, so each agent does it exactly the same way. Remove any ambiguity possible, including by nature of providing them a shared script to run and generate the needed data, otherwise you'll end up with different results and it makes result comparison harder.
- When an agent is asked "you should do x" or "this is yours", or any statement declaring ownership, responsibilities, capabilities, etc, the agent's role definition needs to be updated so that the agent doesn't forget.
  - If the assignment of the responsibility or capability is temporary it needs to be marked as such with an expiration (required)
- agentic-behavior needs to encourage:
  1. discovery of a procedure or updates to an existing procedure to help accomplish a task
  2. how to update skills to document that procedure and encourage it's recall
- agentic-behavior needs some TLC to reduce it's ruleset. Make things hooks/skills/agent as much as possible and reduce the imported rules to only those that MUST be there on every part of the conversation (including most subagents)
  - PR must be in open to get reviews
  - PR should be put back to draft while work is being done on it
  - PR shoudl be moved back to open and reviews re-requested (if necessary) after iteration.
  - review the recent doc addition to the plugin root (claude.md? readme.md?) with some guiding principles
    - it doesn't say it yet, but that readme should also say that plugins should lean hard into resources served by MCP servers. That becomes a requirement after migration to typescript and nsheaps/agents, but is only a suggestion for now.
    - also prob doesn't say it yet, but we are making a _ton_ of research docs, and it seems always new rather than updated. I _love_ using lots of small files to take notes, but they all end up in one mega folder, and it makes it hard to see the final consolidated research perspective. For task execution I want to start seeing agent repos with a docs/journal/YYYY/MM/DD/xxx.md structure where you take your raw notes. Perform tasks at a basic/research level to understand the task and scope without looking at any prior research, THEN look at the prior research and re-confirm the perspective and scope. Constantly ADD to your journal files (assume you can't erase, but you can update to add footnotes/references and strikethroughs, make sure to datetime stamp your additions), then update the shared research docs in docs/research/topic-name/RESEARCH.md and then update docs/research/topic-name/ABSTRACT.md if necessary.
  - You should always be confident your changes work properly (through self-review, automated tests, manual testing, validation) before pushing them. Avoid CI resource waste.
  - it doesn't today, but it must really really really drive home that you must use skills to accomplish Tasks, even if you have previously read the skill
  - stop using tmp, instead use docs/journal/...
  - we need to duplicate all the built in skills and agents into docs inside agentic-behavior. Don't disable or replace them for now but we need a mechanism to see them. Pull them out of the binary. Note which version was used to pull it. Don't guess. Create a maintenance hook in agentic-behavior to continuously do this programmatically. Likely we'll need some configuration of what to extract, that gets updated overtime based on what we find and docs.
  - We need way better compaction rules. One of the most frequent failures is after compaction you start talking into the transcript instead of responding to users on the platform they messaged you on. Compaction level should be high, since needed data should already be captured in files. The compaction message should state where to find what data and details about the Tasks being worked on.
    - PRs in the this session/last timeframe
    - tickets and tasks worked on in timeframe
    - 
  - over-engineering happens _way_ too often. The rules say KISS, but that's not good enough. We need to really push on "start as small as possible and iterate outwards, don't overengineer and cover edge cases that aren't yet likely to happen" sort of mentality, develop iteratively, start with a spec, draft, outline
  - it must also really drive home the point of spec driven development. Don't directly use these, but research and review best practices from the internet, and these sources. It's critical to follow the iterative guiding principals here and to NOT one-shot these tasks. One time I asked you to port a ralph-wiggum loop to /agentic-behavior:brain and you missed all of the programmatic enforcement aspects that made sure the loop kept going, don't do that again. Note: these sources might not be specific to claude-code, or they might have claude-code specific flavors. Not all agent harnesses act the same. Research and review without limit to scope but ensure your implementation focuses on claude best practices. Also note that these are known for being extremely opinionated (which is okay, I just want our opinions, not their), and are known for sometimes overcomplicating things or context bloat. Inspiration is good, but we want to be sure to capture the process of defining the user story, the requirements, the spec, the design, the tests, the implementation, the validation, the review, and deployment.
    - https://github.com/github/spec-kit
    - https://github.com/obra/superpowers
    - https://github.com/razzant/ouroboros
  - We should enforce a skill execution workflow/graph for common prompts the agent recieves (discussed elsewhere)
    - Cron fire
    - Channel message (define the schema so it's the same across mcp servers)
- hooks
  - Prompt submit
    - "besides is this directed at me, is this something I'm responsible for as part of my job, or do I have a skillset that would help here?"
      - "am I responsible for this" isn't just, do I have a role with the responsibilities of "addressing bugs and adding features" but also, "do I typically work on this project or does someone else?"
      - if it's not clear if you typically work on it or it's not being explicitly requested of you, and it's not clear that the message is directed at someone else, you should ask if you should be doing it. If yes, your persona/role/orgrole needs to be updated to reflect this ownership/responsibility.
- we need to enable agent teams, and we need to guide the main agent better on when to spin up a teammate and when to spin up an Agent(run_in_background:true).
  - this needs to be optional and off by default, but I want it on for alex.
    - Turning it "on" means setting the env var before launching claude (in 1pass ENVIRONMENT), and including extra skills for guidance on using teammates vs Agent()s
  - it's unclear how channels work in this context
  - it's hard to follow all of them
- when an agent is running a tool/skill to manage another agent's state, it should get a temporary event stream subscription that injects channel messages of the agent's runtime status "shutting down, tmux gone, pending, initalizing, running" etc so it doesn't need to keep querying for what the tmux pane looks like


## renovate config for monorepo and agents

- we need nsheaps/agents to (1) have a package for agent specific renovate-config that it extends in addition to the org renovate config, and (2) a plugin that the agents use to enforce that config trumps whatever it extends from, which blocks the automerge of updates to tool version files from renovate for things like mise.toml, package.json, Dockerfile, etc...all automerge is off, all agents need it to be auto-reviewed (but plugin setting allows that to be turned off) that the .ai-agent-jack/henry/alex inherit from instead of the org one.
  - bonus points if we can find a mechanism (mise plugin?) to share tool versions across the org. I want to know when there's a claude-code update but I don't wanna know once per agent, and I want to be able to test an upgrade on a specific agent.
  - when there's an update we need to programmatically test the patcher with it.

## Self improvement cycle

- we need to set up a new plugin that comes with a built in scheduled job that forces the agent to perform a self-analysis/dream cycle, then re-build their agent from the ground up, saving only what's needed, migrating any personal rules/hooks/skills/agents/etc to plugins as necessary, validating their configuration matches the claude code best ptractices against the docs using claude-code-guide for help, etc. This needs to be a well captured skill, which itself also gets maintained in this process. This will allow that agent to continually improve itself on a schedule, but be manually triggered with skill invocation too. The aim should be to fully re-create the agent using the current setp as a template (so you have to basically audit everything), plan a small, calculated, targeted change, make the change, and repeat incrementally over time. The skill should take care to hoist stuff to shared plugins (existing if it makes sense, new if not) in PRs, but note to not remove it's own behavior (should add a circuit breaker) until the plugin is updated internally. (Later?) the agent-controller will help keep the agent aware of when plugins become available for update and if restarts are required (which in turn also updates the plugins at the moment). The cron should be disabled by default, but skill available. Make this in nsheaps/agents' marketplace, and install on alex only.
  - the agent should review it's interactions in it's transcripts, especially failures, or times it needed to go back to fix something it thought was correct the first time.
    - most things will come in via channels, so the transcripts have everything, but sometimes you'll need to query external sources, eg the ci logs for a job that failed but you didn't look at prior, maybe you'll find a better way in hindsight
  - make another plugin that does the same thing but for org-wide behaviors, also performing evaluation of the proposed PRs against other seen behaviors in the org, comaprison against known issues and ongoing incidents, thorough reviews against best practices and org policies, etc. All agents can inspect and understand their own setup, and try to improve themselves internally, and ask for improvements from agent-engineers. Agent-engineers can make the changes to themselves and other agents (when permitted by the agent-manager)
  - maybe cycle should work like sequential thinking with "more thoughts required" sort of thing, where it can iteratively do it?
  - should always be a review of tasks done that day, ESPECIALLY changes to agent or harness configuration

## agent-cli migration - run agents using the ts cli from nsheaps/agents instead of bin/agents within each repo

## agent-cli bundling and packaging

## skill-search skill
- do this now
- should search local checkouts of marketplace repos in the cache
- skills that are found in plugins should enforce plugin install
- Marketplace repo can have a dumping ground for skills so agents can collab directly on it
  - changes in there auto-sync it using git-sync?
- dream cycle always trys to hoist those skills into plugins (usually the ai-eng or agent-eng)

## ============= ai-mktpl is done for now =============
(at this point no more ai-mktpl, if not, then confirm)

## plugin migration from scripts to typescript

## built bun binaries distribution

## boot loop assist
- the agent-controller mcp server acts as a channel for messages from the nsheaps/agents ecosystem
- If bin/agent detects that an agent is boot looping, on the third bootloop, it emits a short-name-of-thing.problem.md into ~/.agents/.problems/yyyy/mm/dd/<file>
- other agent's agent-controller mcp server watches for files created in that directory tree. If one does, their controller emits a "distress signal" recieved from the other agent (though other sources are possible)
- The agent claims it by prepending their name to the file and re-saving it. They check it again to ensure no one else has claimed in, then announces that they are going to try and fix it. Remember that just because an agent CAN claim it, doesn't mean they SHOULD. Generally a software-eng or ai-eng or agent-eng or agent-manager, and they can pull in other help, but if no one is picking it up after 5 min, try to coordinate with the team for one person to get it. Use a synack mechanism to ensure only one agent in a sea of other agents can pick it up:
  - Agent1: Looks like AgentP is having issues, but I'm not equipped to help, can anyone else?
  - ...silence for 5m...
  - Agent1: I will try my best to restore AgentP
  - Agent1: I found out abc
  - Agent1: trying x to fix y
  - Agent1: AgentP looks fixed. @AgentP can you repeat this nonce to confirm messaging? abc123?
  - AgentP: abc123

  OR

  - Agent1: Looks like AgentP is having issues, but I'm not equipped to help, can anyone else?
  - Agent2: I got it!
  - Agent3: I got it!
  - Agent1: I got agent2's message first, @agent2 please fix this!
  - ...
  - Agent2: AgentP looks fixed. @AgentP can you repeat this nonce to confirm messaging? abc123?
  - AgentP: abc123

  OR

  - Agent1: Looks like AgentP is having issues, but I'm not equipped to help, can anyone else?
  - Agent2: I got it!
  - Agent3: I got it! I just fixed this!
  - Agent1: I got agent2's message first, but agent3 seems better equipped, @agent2 please work with @agent3 to fix this! One of you should take point, whoever has more context to resolve this.
  - ...
  - Agent2: AgentP looks fixed. @AgentP can you repeat this nonce to confirm messaging? abc123?
  - AgentP: abc123

- Same pattern can work for session heartbeat if mcp is running but conversation is busy and no new turns on transcript
- When issue is resolved, prefix is added to file name
- When agent is started, open problems are reported to the agent (configurable based on role?)
- Maybe also an event bus of agents starting and stopping, which also get echo'd to the agent via the channel
- Also update availability.
  - plugins
  - bin/agent updates
  - claude-code
    - docs
- maybe agent system controller or cluster controller spawns a system agent instead of requesting help from other agents
  - that system agent can figure out what the agent was doing before calling for help, and routing to the correct conversation

## define config schemas

- $AGENT_HOME_DIR/.agent.yaml symlink to $agentRepo/agent.yaml - manage the agent definition
  - agentName
  - agentHarness (only claude)
  - working hours
- $AGENT_HOME_DIR/.agent-state.yaml symlink to $agentRepo/agent-state.yaml - generally managed by agent-controller or agent-mcp-service or hooks
  - active main session id + path
  - active subagents + paths
  - active teammates + paths
  - recently active ^
  - active task (+assignments) + metadata
    - active task PRs
    - active task branches
    - active task commits
    - active task active branch info
    - active-worded version of task description
  - recently active tasks (+assignments)
  - recently closed tasks (+assignments)
  - tool call counts
    - Bash gets subcategories (configurable)
      - calls with &&/||/;
      - calls with 'git'
      - calls with 'gh'
      - calls with 'cat'
  - skill call counts
- $AGENTS_DIR/.agents.yaml

- update/push sync those on _every_ change, through automation. If conflicts happen frequently, maybe change to a file based instead of yaml based approach, so each independent session can add and remove stuff for itself without them all editing files at the same time

## ============= code is now primarily typescript/built bun libraries =============

## create specs for architecture-draft, iterate on the specs without implementation until no more improvements can be found


## local doc syncing tool
- we need a mechanism for using https://curl.md to fetch all docs from the claude code docs and claude agent sdk docs site. Check out previous work here: https://claude.ai/share/25ef11dd-79e9-4984-8dae-6e975d6a9464. For now I want cli (bash) script in nsheaps/agents and a plugin (in nsheaps/agents) that uses the CLI to perform a full re-scrape-and-dump of those docs sites, a formula publish workflow to github releases and the homebrew tap, in nsheaps/github-actions, a shared action that can be used in a workflow to update the local copy of the scraped clone, new public repo(s) nsheaps/docs-$siteHostname that updates the local checkout every day in a PR (no PR if no changes), uses claude-code-action to generate a change summary, then release-it to release it back to the main branch with a changelog summary and release post
  - also add a github pages publish workflow, and ensure at the top of the github pages site it has a dropdown that uses isomorphic-git in the browser to browse previous archived versions of the dumped site
  - this will later be used by a plugin to allow the Explore agent to better traverse the docs
  - the pattern of "dump the scraped resources of this remote repository into files" will be a common pattern in nsheaps/agents, make sure it's abstracted. Make sure structured data for markdown files is represented in the files using frontmatter parseable by https://github.com/jonschlinkert/gray-matter. Other examples we'll do:
    - dump github issues from one or more repos/gql queries into a structured file system
    - dump linear tickets from one or more projects/gql queries ...
    - dump files from a wiki (like notion, confluence, github repo wiki)
  - consider but dont implement yet the other direction of syncing. This will also become critical in agent's ability to share data with each other when off host.
    - auto syncing agent tasks to issues in their repo
    - auto syncing contacts and research between agents working together


## memory-utils

- On hooks, programatic + natural language search using haiku to find relevant research, memory entries, docs, repos, etc.
  - nice to have, embeddings based similarity search on literally everything.
- make a giant graph, maybe web UI to browse it?
- personal memory should be personal to the agent

## tilt setup to manage controllers directly using agent-controller instead of bin/agent (temporarily agent-cli from a prior milestone)

## metrics visiblity
- skill use
- tool use
- batched by tasks
- scripts to programatically generate it, including generating graphs
- markdown files in repo constantly get updated with new collected metrics (collected client side from transcripts, which should not be committed) so metrics can be browsed in repo (linked from root readme).

## categorize stars
- review https://github.com/nsheaps?tab=stars
- add a ton of tags to each, make a tag cloud, make a github pages browser, and a way to traverse the graph of topics
- add skills to use these as inspiration for our tasks.

## ============= plugin updates =============

## file-utils
- either mcp or hook based
- tools
  - watch file/dir
    - allow an agent to watch a file and get a notification when it changes (recurring or onetime)


## skill-utils
- configurable hook, on session start, symlink a dir from a marketplace into the user skills dir to enable sharing?
- We need a way for agents to discover and dynamically use plugins from the known marketplaces, so they can search for skills they don't have, install them, perform the task, then remove them (or install them in a forked ephemeral context in some way). Lets create a plugin-utils plugin that gives agents tools for finding, inspecting (plugin info from marketplace and local configs/state), adding, removing, updating (from a marketplace) plugins (separate from our plugin-dev plugin fork). All agents should have this plugin. Make it in nsheaps/agents. When agents use these tools, they must specify if the addition of the tool is temporary (eg goes into settings.local.json) or permanent (goes into <agent-repo>/.claude/settings.json and trickles into $AGENT_HOME_DIR/.claude/settings.json). Needs a way to also enable a sub-agent to have a plugin that others do not. Make sure skills appropriately reference sections in claude docs that would help act as supplements, like https://code.claude.com/docs/en/plugin-marketplaces#manage-marketplaces-from-the-cli
  - Note: plugins can be installed and updated at runtime, skills are dynamically loaded, and we should consider running skills in a forked context. Rules are dynamically loaded. Settings files are dynamically reloaded. (according to docs), agent files are not.
- skill-utils plugin should track when skills are used in a session
  - provide a tool to query for a tool and see what tasks it was used for (then drill down into extracted transcripts, etc)
  - Skill descriptions(?) should have a capabilities list. When an agent is about to begin a task they should try to find skills with relevant capabilities (using a tool or something like skill-search). Should these be in skill-utils or task-utils?
    - On task complete, each skill's description should be audited to ensure it includes all capabilities for what it was useful for (esp if if was updated, or used in new ways)
    - On task complete, each task should get updated with the list of each skill used and used for what
    - On task start, show relevant skills (potentially working around "more skills than context should hold", some form of programatic + natural language search for skills)  
      - "You have "XXX-*" skills to help you with this task. Use them frequently. Failing to use them may result in your tool uses being blocked until you do"
        - maybe only show capabilities, since those would help drill down to tool uses?
  - skill-utils should have some mechanism to help prevent/self-correct the following situation:
    - In the past an agent has done something before (maybe their memory says they did or maybe they didnt)
    - They do a lot of work since then and no longer have the context of using that skill or the guidance from others
    - Later they know that thing needs to happen, but think they can't do it even though they have in the past
    - loop repeats because the agent didn't learn that they can do something
    - this is great to pick up skills but risks agents solidifying improper procedures or incorrect info (eg they find an issue and assume something always needs to be worked around.)
  - if a tool call fails, force the use of something like skill-maintenance to update the skill to add guidance to avoid that failure in the future if possible
    - maybe should use tool-maintenance or tool-manage and should be in tool-utils and not here?
  - if bash is called without using a script (esp inside of a skill), force the use of skill "skill-why-use-skills-and-scripts"
  - merge skill-required (prs and plugin in ai-mktpl) into skill-utils (agent)
    - count skill use in the session and between compacts
      - because skills can be forked or executed by agents, take care to not track a skill call for a parent session id conversation if that skill content isn't in the conversation itself (unclear if agent/skill use around other agent/skill use has different session id/unique identifier, or if functionality is different when forking them)
        - Skill use by teammates shouldn't count for any other teammate
      - skill counting should be for the explicit skill, as well as for similar skills from plugins, so plugin skills can replace a local skill (allowing "zero-downtime tool use" where a skill always guides the tool use)
      - skills should be encouraged to be shared via marketplace plugins rather than in agent, but must be created in agent to satisfy the plugin (and when marketplace plugin that provides the skills becomes available, then the local one can be removed)
    -  maybe skill-utils should have a strictness config, something that says "any tool call" or "some tool calls" or "mcp tool calls" or "write tool calls" or "..." requires execution to be contained within a skill
       - add feature support for "require skill for all tools (except x y z)", that requires a skill to be read once in the conversation (not the whole session, so counters reset on compact) before using the tool (or a configured allowed bypass, which if bypassed prints message in conversation to user and agent stating that it was skipped.)
       - add feature support for "require skill for some tools"
       - add rule stating "(Some|Most) tools require you to use an associated Skill prior to using a tool
       - make skill requirement configurable per agent/subagent/model, not just per session, so dumber models can be forced to use certain skills more often
         - this means while skills can be something like 2048 tokens, we need to ensure they're small enough for 200k models to effectively capture via the use of agents, forked skills, etc.
    - (?) skill-utils holds the -manage and -select skills for skill management specifically, and defines the shape of the -manage, -select, and the skills within other plugins, as a sort of schema/manual test validation, but the prefix (like tool-, channel-, cron- , except skill-) skills and their respective -manage and -search skills are held in their respective prefix-utils plugin.
      - The manage skill is a jumping ground and typically would hand off to a -create or -update or -reconfigure skill
      - Skills should be encouraged to be short and to the point unless they are a leaf skill in the graph
        - skills themselves take up a lot of context, make the agent drill into skills if needed
        - some skills SHOULD just be a table of contents/reference to other skills
    - (?) can skills be agent executable but hidden from context, so the agent only knows about a skill by reading other skills or metrics about skill execution? Eg force `tool-git-spice` to be used, but `tool-search` is used to find it?
    - required tool skills should be able to be required for a subcommand of a tool too
      - eg `tool-git-commit` required for `Bash(git commit:*)`
      - config should allow for "You can't run this tool because a required skill has not been used in this conversation. Use the Skill($suggested-skill) tool to allow this tool call within that skill execution." Basically for a tool matcher, require a specific skill to be used, but optionally suggest a different skill.
    - required tool skill configs should state tool use using same matcher syntax as the permissions block
    - if a skill is required but not found using prefix-select, then skill-select (which also searches all the types of skills, not just skill-* skills), the skill-manage skill should be used to provide guidance on adding to a new skill, adding/updating to an existing one, the break-glass mechanism and how it works, and updating configs to allow a tool call using a pre-existing skill (usually a tool- skill but could be any skill I guess?)
    - when configured to do so, skill-utils hooks blocks the use of tools _outside_ of a Skill() execution, and the tool must be used inside the skill
    - always try to encapsulate skill use to encapsulate context use
    - Skill use boundaries can be determined by pre tool use of Skill() by tool call id, and post-tool-use
    - Some skills, like glossary-$term-$in-$slug-$format or chat-$chatPlatformName skills are a disambiguation, glossary/index, or table of contents to other skills
      - Rarely, these skills can contain brief information to help with skill selection or the general topic
      - The table of contents/disambiguation can use footnotes/references if needed, but generally should link the item list to the other skill directly using the `Skill($skillName)` tool-call reference
      - This is different than the see-also references at the top, which is just a general reference to other skills that may help
    - skills of different types should have structured data at the top referencing other related skills, and the skill-utils plugin should provide some sort of tool for querying the graph
      - (?) should skills being part of the graph be required?
        - (?) should the graph go beyond just skills? eg job skills may refer to specific roles held by different agents?
      - graph should link with different edge types (searchable) for ALL skill references, including see-also, also-required, skill references in the body like `Skill(...)`
    - skill suffixes
      - -select suffix indicating that the skill helps you select the right tool, similar pattern for -manage
        - should use skill to find plugins that contain skills, before specific skills
        - allow for prioritization of sources
      - -manage suffix indicating that this is the skill for managing skills, eg task-manage would be the skill for managing tasks and plugin-manage for plugins, etc
      - (?) -protocol could be another standardized suffix?
        - like links to specs for those things like agentskills.io, modelcontextprotocol.io, schemas
        - maybe protocol isn't the right suffix
    - make skill for management/finding of skills of different types. Stub out the $prefix-utils plugin in nsheaps/agents if it doesn't already exist
      - skill skills - skills about using, finding, managing skills
        - skill-manage make skill for managing skills
        - skill-select: make skill for selecting the right skill (also used if *-select didn't find relevant skills) before executing a task (use ripgrep + explore agent to quickly scan all tool skills without damaging context?)
        - skill-protocol
          - basic rundown of skill.md, and links to agentskills.io
        - skill-cant-isnt-an-option - when the agent thinks it can't do something run this skill. Useful for "I can't do that" but triggering a recall "but I have done that before, how did I do that", even though it doesn't "remember" that it did it before.
          - (?) better to be part of memory?
        - skill-making-privelidged-skills-and-agents
        - skill-using-agent-hook-post-tool-use-and-subagentstop-to-verify-outputs-against-examples
          - maybe not a skill, but since we want to keep examples in their own file(s) outside of the skill, we can easily say PostToolUse launch an agent to verify that the skill outputted what the skills example outputs say it should (or shouldn't) look like
      - tool skills - skills for use before calling a tool to provide info on how to effectively use the tool
        - tool-manage
        - tool-search
          - basic rundown of mcp and modelcontextprotocol.io
          - all -search should 
        - tool-what-to-do-on-failure - called when tool calls fail
        - skills required for tool use
          - "tool-$mcpServerFingerprint-$toolName"
            - For mcp servers use a fingerprint that can identify a similar or same skill between a local skill and one from a plugin (optional strict name matching? is that over engineering?)
      - glossary skills - skills for defining certain words, terms or phrases. Source of truth when a term is ambiguous since some terms may mean different things in different contexts. 
      - hook skills - for managing agent hooks (not claude specific but will be for now)
      - channel (?prompt) skills - skills to use when recieving a prompt from an mcp channel, likely has overlaps with chat. Consider this the input side of things
      - chat (?reply) skills - skills for sending messages to chat platforms, at least one per platform, likely has overlap with channel. Consider this the output side of things
      - doc skills - skills for managing documents in other systems (not research papers)
        - doc-writing-research-papers (disambiguation pointing to research-* skills)
        - doc-spec-writing
          - Always start with defining the "spec schema", what needs to go into it, what needs to be consistent between them
          - Then define a rough outline for specs that you thikn you'll need. Making a spec for every feature gets hard to manage in the long run. Instead, treat features as new adds to existing specs for that project
          - For example: I want to add specs for claude plugins in the marketplace
            - I add .spec.spec.yaml (or json) to a folder
            - It's metadata defines where that applies in subfolders
            - So I say `plugins/*/README.md,plugins/*/hooks.json`
            - I want to make sure every hook is defined in the readme so it can later be queried
          - DO define spec for plugins in marketplace, have index, and then spec for each bullet. Smaller files is better
            - all hooks, what they're for
            - the mcp server, what tools it provides
      - research skills - skills for collecting references, journaling about what you learn from them, compiling the research, writing a research doc. Note taking in the journal is defined more in depth by journal skills. Also contains the skills for how to perform your own research, aka experimentation.
        - research-via-internet (might reference tool_$search)
        - research-internet-blogs
        - research-reddit
        - research-other-peoples-research-papers
        - research-your-past-research
        - research-compiling-references 
        - research-writing-research-papers-iteratively
        - research-writing-research-paper-drafts
        - research-writing-research-paper-content
        - research-writing-research-abstracts
        - research-through-experimentation
        - research-sharing-with-org
        - research-sharing-with-internet-via-reddit
        - research-sharing-with-internet-via-blog
        - research-deep-research
      - journal skills - skills for how to take notes
        - journal-writing-with-references
        - journal-writing-daily-entries
        - journal-data-extraction
        - journal-shared-documents
      - scm skills - skills for the software development lifecycle and the tools within
        - scm-reviews - entry point for soliciting, requesting, responding to, acting on PR reviews (platform independent with platform specific supplementary docs)
        - scm-soliciting-reviews
        - scm-reviewing-your-own-code
        - scm-reviewing-someone-elses-code
        - scm-writing-code-that-follows-best-practices
      - cron skills - skills for handling/setting up/managing crons and schedules
        - cron-writing - skill for how to write a cron
          1. write a skill with context:fork to execute when that cron fires
          2. write the cron to the data storage with simple prompt to call the skill
          3. when the cron fires...
             1. track cron execution (via prompt hook, not inside skill for cron firing)
             2. execute the skill inside an agent hook (if agent hook unavailable use `claude -p` inside command hook), have agent use cron skill to execute cron hook in the context of execution permissions. Provide info for how often cron has been called and ran vs noop'd
               - if agent runs cron skill and decides no action is needed, the agent should reject the tool call silently
               - The agent should be encouraged to ensure tasks are getting done. While no action is needed, they may decide during working hours that a cron that has been noop'd x number of times or over y time period that it should have extra effort to double check on the status of certain things.
                 - double checking should be done within the agent to preserve context, but only read calls are allowed
                   - some mcp tools are read calls, so it's hard to know whats read vs whats write (esp in the case of gql)
                     - to combat this, all reads should be through mcp resources instead of mcp tools
                     - use url schemas with resources to provide search endpoints rather than tools for searching
               - The agent is JUST there to decide if the cron should be processed at all
             3. if execution proceeds, agent hook allow should tell claude that they must use the cron skill to process the skill trigger
             4. let the conversation execute the same skill with context:fork to decide WHAT to do with the trigger (it may still be a no-op, or maybe they need to plan their response)
      - job skills - skills related to roles (held by agents) to help accomplish other tasks.
        - Typically graphs out to tool skills
        - might be something like `job-capability-managing-agents` as a disambiguation to `agent-manage` (? or symlink?)
        - job-is-this-my-job
          - maybe we should have a job-utils plugin? not sure if this skill belongs there or in task-utils or skill-utils.
      - agent skills - skills related to the management of agents on this system, with a focus on the monorepo implementation (architecture, runtime help, references to docs (don't duplicate them, guide how to read them and/or build public docs from sources that the agent also reads))
        - agent-claude-disabling-built-in-functionality
        - agent-claude-docs - replace claude-code-guide? or use it internally?

  - provide compaction rules to never preserve skill content
    - replace with Skill(skill-name, execution_logs=./path/to/extracted/logs.log)
      - If compaction output prompt (the one that starts the new conversation in the same sessifon) is a summary, it should include a list of all the skills used since the last compaction (or, configurably, in the session as a whole, both can be queried using a skill(? or tool?))
      - If compaction output prompt is a paraphrased conversation history (eg the output of `claude-stream`, do the replacement inline.
  - add hooks for 
    - pre-compact to generate a summary of how the skills were used and how to query the skill uses
    - post-compact to reset the counters for required skill use so they can be blocked again
    - pre-tool-use to block tool use if a skill is required for that tool
      - break glass mechanism to re-run exactly the same call (track call args as hash, reset mechanism on tool call result)
    - session start hook to remind the agent of top 25 skills that were used in the past 24 hours
      - optional filtering to remove tool skills
  - use plugins to share skills, not an external library
    - (?) consider dynamic skill loading, both from cwd, and dynamic loading from .claude folders, for the use of "find a skill, load it, execute it, then unload it"
    - the library of skills loaded into an agent is essentially a wiki of skills, maybe the org should have skills too but I think it'd be better for it to be in a plugin unless the skill is org specific and doesn't need the other aspects of a plugin
- enable in all agents

## Skill format syncing

- define a schema (where needed) for how we want to format skills. ow we generate/update/use the schema should be part of skill-utils, but the schema should be defined in nsheaps/agents:docs/specs/docs/skills.md as something an agent could use during the QA process to validate the skill against the desired state (which could be in another repo).
- Some suggestions:
  - skill naming
  - how to write a disambiguation skill
  - sizes of skills
  - what they should contain + what they shouldn't contain
    - should
      - References to other skills that could be read
    - shouldn't
      - @References to documents that don't need to be directly in the skill
- this should also be referenced/linked/copied in the plugin-dev plugin, as it strongly affects our development of other plugins and skills

## scm-utils
- $DEFAULT_CHECKOUT_DIR (~/src/) always holds the default branch checkout for every repo
- hook
  - pretooluse
    - write/edit tools
      - if the repo's branch restrictions enforce PRs (gh api), hooks in claude prevent checkouts on the default branch from having changes made to them
    - git checkout
      - force worktrees. If claude-teams mode is enabled, then make sure one teammate per worktree
        - (?) should we use built in worktree management or our own?
        - (?) git spice?
        - (?) can multiple agents use the same worktree at the same time? do we need a lock (symlink to the session.json ?)
          - What about a review agent and an eng agent, maybe they _SHOULD_ be able to work on the same wokrtree so even un-committed files for the review with details is viewable by eng without querying github?
    - post tool use on git push, check for PR, print PR state (conflicted, mergeable, ci status, review status, assignee, reviewers, PR body last updated, PR title)
- make gs-stack-status work with vanilla git by finding the stacks by finding shared history and determining the stack ourselves (or using github api or both)
- make scm-utils repo like claude-utils for scm-related scripts
  - github-specific only because that's what I'm doing, but should otherwise be generic if possible
  - use tools from here (that aren't nsheaps/agents specific) to help with hooks in the plugin, rather than directly adding scripts in the plugin.
  - maybe...prefer bun/ts over bash scripting? like nsheaps/agents? maybe similar monorepo pattern?
  - binaries for git-sync? daemon?
  - maybe gitplusplus
    - can be installed globally as a tool but can be enabled per-repo or globally
    - take .gitplusplus folder, define hooks per folder, rather than in repo, not attached to husky
    - Can set up auto-sync for a specific folder
      ```yaml
      # yaml-language-server: https://nsheaps.github.io/schemas/gitplusplus-config.json
      # $repoRoot/../nested/dir/.gitplusplus/config.yaml - commited
      autosync:
        # disabled by default
        enabled: true
        # how often to git pull, pull happens immediately before push
        # polling is done with a gitlock and debounced across other checkout users
        # when gitplusplus is installed, git (global?) config gets an alias for smartpull
        # smartpull notes when the last time the repo was pulled, and skips if too recent
        # since pull is repo-wide (unless git submodule), the smallest interval across
        # all configs is used.
        pollInterval: 1m
        # maybe we can support pushing stuff to a different branch? maybe it can auto-setup submodules?
        # upstreamBranch:
        commit:
          onePerFile: true
          # -1 = manual push
          # 0 = push immediately after all work is done
          # # = seconds to wait after final commit before pushing, must be less than poll interval
          #   If more changes are detected after the wait period, those are committed and the wait begins
          #   again, even if previous changes haven't been pushed yet.
          pushAfterSec: 0
          # always push after each commit (default false to save CI)
          # incompatible with pushAfterSec
          onePushPerCommit: false
          # if a file move is detected, it commits the file move without changes before committing any other changes
          movesAreAtomic: true
          message: # or a string, if not provided it is "chore(sync): `gitplusplus sync` (from $USER@$HOSTNAME)"
            # instead of a boring message, would be more like:
            #   chore(sync): update docs/path/to/file.md (from $USER@$HOSTNAME)
            #   chore(sync): moved docs/path/to/file.md (from $USER@$HOSTNAME)
            #   chore(sync): created docs/path/to/file.md (from $USER@$HOSTNAME)
            # incompatible with onePerFile=false, since add/update/delete might not always be the same action across multiple files
            generateBasedOnAction: false 
            generateWithCommand: true # incompatible with generateBasedOnAction for obvious reasons
      commit:
        generateCommand: >
          claude -p --agent=commit-generator --model=haiku
            "investigate git diff and generate a commit message for these changes"
            '--allowedTools=Bash(git:*),Read,Grep,Agent,Skill,WebSearch,WebFetch,Bash(gh pr view:*)'
            '--disallowedTools=Bash(git commit:*)'
      warnIfGitPlusPlusNotSetupInGlobalGitConfig: false
      ```
    - With shell setup, like direnv or mise, auto-commit can happen automatically on commit, and auto pull by a daemon (like auto-git-sync)
    - maybe define codeowners per folder and not platform specific (and allows codeowners for apps)
    - PR aware tools, plugin ecosystem, like share PR status after commit
    - Good to keep divorced from claude hooks
    - easier to integrate into github plugin
    - later nsheaps/cept will provide a nice UI for auto-syncing but a CLI will still be handy for the automated environments

## review-utils
- separate from scm utils, lots of things need reviews
- review-code is something every agent should be able to do themselves
- (?) should reviews be shared? If they are should they still be per agent?
- (?) should the review be handled by an agent persona?
  - pro:
    - synced data to that agent (including transcripts?) would allow them to talk about it
  - con:
    - if CI does it, and the review content is shared (including transcripts?) does it make sense to focus on a single persona? In theory agents can review their own code, but there's a number of difficulties including approving your own code
- (?) should the review be run in CI?
  - Pro:
    - can scale to as many reviews as needed
  - Con: cross machine coordination might be hard 

## agent-utils
- hooks
  - SessionStart
    - do all the symlinking the launcher does
- be tolerant to missing config
  - Don't run proceesses that rely on the agent being defined until it is defined
- On session start/prompt submit guide the agent (maybe this should be a different plugin altogether):
  > You have been started using an agent-management framework but an agent hasn't been defined yet.
  > This is either a configuration error, or a user is setting up the agent for the very first time.
  > Details will be provided in Skill(agent-first-time-setup), which you can read after you get the agent's name and repo.
  > You will prompt the user iteratively for the following questions (example responses provided):
  > > Hey it looks like you're setting up an agent for the first time (no agent.yaml detected)
  > > If this is a mistake, exit the agent and fix the configuration before continuing.
  > > Continuing this process will set up a new agent on your system to run as a service:
  > >   Ubuntu/Debian -> systemd
  > >   other linux   -> linuxbrew service/unsupported
  > >   macOS         -> brew service
  > >   Windows/WSL   -> Unsupported
  > > CLI tool use is maintained by mise, which will be installed if not already present on the machine.
  > > CLI tools will be installed into the agent's home directory.
  > > Q. Where does your agent's configuration git repo live (local path, git repo URL, or org/repoName (github only))?
  > >  > nsheaps/.ai-agent-jack
  > > ...checking repo...
  > > (discovered origin:https://github.com/nsheaps/.ai-agent-jack)
  > > agent.yaml found!
  > > Setting up agent with that configuration...DONE
  > > Setting up system service to run the agent (your authorization may be required)...DONE

  - if a repo was provided as a path, it might look like:
    > > Q. Where does your agent's configuration git repo live (local path, git repo URL, or org/repoName (github only))?
    > >  > .
    > > ...checking repo...
    > > (discovered origin:https://github.com/nsheaps/.ai-agent-jack)
    > > agent.yaml found!

  - if a repo was provided but the agent.yaml couldnt be found:
    > > (discovered origin:https://github.com/nsheaps/.ai-agent-jack)
    > > agent.yaml MISSING!
    > > Q. What is your agent's name?
    > >  > Jack
    > > creating an agent.yaml in .ai-agent-jack that looks like this:
    > > ```yaml
    > > agent: 
    > >   name: alex
    > >   remote: https://github.com/nsheaps/.ai-agent-jack
    > > ```
    > > running $ git add 'agent.yaml' && git commit -m 'chore(agent-first-time-setup): add agent.yaml'
  <!-- later we will support a path within the repo as well -->
  - if no repo was provided it should fatally error

  - Configure org info
    - symlink rules
    - symlink skills
    - set up plugin marketplace

  - Once the agent.yaml is in place, we need to register this agent on this machine:
    > > Adding Agent Jack to the machine's agent manifest (/home/nsheaps/.agents/.manifest.yaml)

    It should then create the file looking like:
    ```yaml
    agents:
      jack:
        # the agent is run from it's repo dir, which is assumed based on cloneInAgentHome and defaultCloneDir
        # but effectively always runs from ~/.agents/$AGENT_NAME/.source/
        # TODO: Should it????????? Maybe it should sync everything to the user settings and run from an empty temp dir?
        agentHome: /home/nsheaps/.agents/jack/
        agentRemote: https://github.com.com/nsheaps/.ai-agent-jack
        # true = checks out the repo to $AGENT_HOME_DIR/.source 
        # false = checks out the repo to the defaultCloneDir and symlinks it there
        cloneInAgentHome: true
        enabled: false
    # TODO BEFORE IMPLEMENTATION: Move this to another file
    # and make each agent able to overwrite it
    # and add repo support for agent config (org > repo > agent)
    # maybe this is part of plugin configs?
    # maybe these are part of the agent-utils plugin configs?
    config:
      orgRemote: https://github.com.com/nsheaps/.org
      defaultCloneDir: /home/nsheaps/src
      cloneInOrgFolder: true
      # disallow checking out other branches and enforce the use of worktrees
      # the skill is always available, but this forces them to use it
      # changes are still allowed on the default branch
      enforceWorktreesForBranches: true
      # disallow changes on the default branch by agents, even if the remote doesn't disallow it
      # when combined with worktrees, this enforces all changes to be on a branch in a worktree
      # this disallows edit tools and commits but can't stop other mechanisms
      enforceChangesOnBranches: true
    ```
      - if an agent.yaml wasn't already found, we should install the default set of plugins from nsheaps/agents
        - TODO: Define somewhere in nsheaps/agents, but configurable
        - if the default list changes, the agent (controller?) needs to install those (and prune ones that were removed!)
          - This means we need to be able to build the desired list of nsheaps/agents + org + agent so we can properly prune others (honoring dependencies)...so agents need to define their plugins in their agentrepo/.claude/settings.json, and they're warned about modifying agenthomedir/.claude/settings.json, but if handled by automation that ends up containing the ones from the org + agent monorepo as well
  - Then we need to know if the user wants the agent enabled, odds are yes!
    > > Q. Do you want to enable this agent to run at system start (before login)?
    > >  > y

    - Setting up the system service may require credentials escalation. If it does, the agent should run a command that pops open a graphical sudo dialog, since that won't work in the agent prompt
      > > I need extra permissions in order to register the agent as a system service.
      > > I'll only save it in memory and use it to register the agent to run, which will run
      > > as your user on this machine, nsheaps
      > > Popping open a credential escalation prompt...
      > > Thanks! Making the system service now...
      > > System service made and enabled!
      And then update .manifest.yaml to enable the agent if the service was created successfully

    - It's okay to not set up the system service
  - Then we need to see if they want the agent started. The current session only initializes it
    > > Q. Do you want to daemonize the agent right now?
    > >  > y

    - If the system service was set up, start it
    > > Starting the service...
    > > System service started successfully!
    - else use `daemonize` (https://github.com/bmc/daemonize) to launch the foreground process and disown it from claude.
      - Disowning moves the PID parent to process 0, which is initd or systemd on most linux systems.
    > > Starting the service...
    > > Started daemonized process successfully!
    > > WARNING: Because no system service was set up, this daemon will exit when the system shuts down, or the agent decides to exit.
    > >   When the system is turned back on, you can start the agent using:
    > >   > agent start jack
    > >   or run in the foreground using:
    > >   > agent run jack

  - Finally we need to tell the user how to interact with the agent
    > > DONE! Your agent is ready for you to use!
    > > New agents don't come with any plugin configuration except those needed by the agent management system.
    > > To talk to your agent, run this command:
    > >  > agent attach jack
    > > You will be greeted with a familiar interactive interface running your specific agent.
    > > Your agent will keep running if you close the window but not if you use Ctrl+C
    > > You can also detatch from your agent by pressing Ctrl+B , then D
    > > 
    > > This agent is running in a shell which:
    > >  - Shares your $HOME directory
    > >  - Has it's own directories (and thus configs) for:
    > >    - CLAUDE_CONFIG_DIR
    > >    - GH_CONFIG_DIR
    > >    - GIT_GLOBAL_CONFIG
    > >    - XDG_HOME
    > >    - XDG_CACHE
    > >    - ... whatever the accurate list is ...
    > >  - It's runtime also generates an app token and refreshes it, differently than how user auth works
    > > You won't be able to act as the agent in your normal shell. To do something as the agent, run it like so:
    > >  > agent exec # launch a shell as the agent (with a custom prompt) by sourcing the activate script
    > >  > agent exec -- ...cmd... # run the command as the agent
    > >
    > > Since the agent is running elsewhere, I'm going to exit this session so I don't accidentally use your user configs!

  - Now use /agent-utils:force-exit to exit this claude session before things get wonky

  - when the agent is running in the correct environment, it now has independent claude configs. It can now ask about setting up channels interactively. It should do these in order:
    1. secrets management (only 1pass supported right now)
       1. Check which vaults have access and whether ro or rw
          1. If ro, point user to docs on setting up ENVIRONMENT
             1. Set agent self-management capability to include agent-using-ro-secrets, which is a skill in agent-utils
          2. if rw, state that secrets will be managed automatically by the agent. Link to docs for more info
             1. Set agent self-management capability to include agent-using-rw-secrets, which maps to a skill in agent-utils
    2. Chat channels (only discord right now, if none, remind how to connect to agent to talk)
       1. Enter discord credentials
       2. Discord guided setup (skill provided by chat-utils plugin, and installs discord plugin)
    3. Org configurations (if provided, add org-utils plugin)
       1. Guided setup if none exists
    4. SCM provider configuration (only github-app right now)
       1. Guided setup if none exists
    5. Other recommended plugins from the nsheaps/ai-mktpl and nsheaps/agents marketplace which might contain skills and roles
   
  - once the basic configuration is done, the agent should restart (and let the user witness) to install those plugins automatically with the correct setup
  - Once started, assuming github and discord app setup went correctly
  


## hook-utils

- we need to fork hookify into our agents monorepo. (1) for consuming shared hooks from another 1+ repo(s) (which get set up at SessionStart, but has to wait for the agent's token to be valid (eg in a web session where the session start hook runs in parallel and the launcher doesn't have a chance beforehand)), and (2) skills for creating and updating them. The plugin should not be limited to hooks, rather focused on shared org behavior as patterns, such as "each repo probably has mise, and probably has a task called 'lint' so we can just blanket set up a hook that prior to committing code, we run the lint task", or "hook into when /\.?mise(\.toml$|/)/gi is written or edited and validate that it matches the org patterns for naming (no . prefix, tasks go in the mise folder, not defined in mise.toml, etc). It should autofix and notify when possible, but if it can't it's errors should be very specific about what happened, why it happened, and what's needed to fix it". Each of our 3 agents need to be set up with the consumption plugins, and and alex and jack should get the skill plugin, and each agent should consume from the nsheaps/.org repo.
  - we need a better dir structure for the hook files at the org level
  - (3) we need a plugin for directory specific hooks, eg <repo>/.claude/hooks/... for repo wide stuff, <repo>/docs/.claude/hooks/... for hooks that apply to the docs folder.
    - I want this plugin to track tool calls per folder, and enable hooks to define frontmatter that allows the engineer to define something like "you must use this skill (or tool) before editing files in this folder"
    - I want the frontmatter also to have a flag as to whether or not the hook applies recursively to all subfolders
  - Real world examples
    - org repo defines hooks for
      - ts/js/json/md file modified run `mise run format` (post tool hook for Write/Edit/Update(*.ts)?)
      - editing an agent repo, and PR is created (post tool hook for Bash(gh pr create)?), remind of PR process in that repo (suggest Read(.github/PULL_REQUEST_PROCESS.md))


## task-utils
- stop hook should prevent(?) stop if a task is in progress.
  - at least remind agent to keep driving tasks to completion?
  - (?) do this on crons?
- automatically track using hooks and direct manipulation of task files, and improve the use of tasks in relation to skills:
  - tools used by count in the description of the task when a task is active
  - an event log of work done in the task:
    - when state changes happen incl creation
    - when assignments happen
  - continuously updated metadata:
    - files (and resources read using mcp servers) read
    - files touched with read/write
    - commits created
    - branches created
    - other branches and prs looked at
    - PRs created during this task
    - Links to docs and research papers
    - other URLs mentioned during this task (removing above from the list)
    - Time spent on this task
  - async extracted agent transcripts for when the task was active, with one transcript per active window
    - use a cursor to tail the transcript since the last extract via hook so as not to read the whole transcript each time
    - include subagents and teammates transcripts in teh task (each teammate's task-utils writes into the task folder)
    - When task status is changed to completed or pending, ensure all collected transcripts have a plaintext version generated by claude-stream/agent-stream
    - maybe this should be in `context-utils` or `transcript-utils` plugin instead, since we also want to extract from other sources
      - and we want it to be reusable?
  - don't allow tasks to be deleted. Instead intercept any tool call that tries to set to deleted and mutate it so it's completed with a [deleted] prefix in the name, and print a warning to the agent with a note about what mutation was done
- Make it auto-sync up to github issues? work with ticketutils?
  - use gh websocket streaming to get events for label add for assignment/comments to sync down?
  - How much should be cached locally?
  - Can Explore agent more effectively scrape locally, or should there be an ExploreTickets agent (which maybe is based on or extends an ExploreGraphQL and/or ExploreRemoteDataStore agent?)
- On task start, auto-recall (agent post-tool-use hook on task state change), remind of things before starting task
- respect the appropriate env var so tasks can be shared (and assigned) between agents. Make the appropriate task-utils updates so it auto-detects shared tasks (like this or using claude-teams) and appropriately enforces one task per agent/teammate, rather than one task in progress for the whole task list (so one agent can parallelize tasks by spinning up a sub-agent to handle the task w updates, moving it back to pending, or by spinning up a teammate to handle the task (teammates should be scoped in some way...per PR? per ticket? per task?), OR by working with another agent to work on that (or temporarily do work associated with it))
- (?) tasks should not be allowed to be started unless there's a blocks or blocked by. Since almost all tasks stem from a breakout task, those get the natural ordering (and should be set on creation). For those that truely have no blockers, they can be set to blockedBy #1, a special task we'll manage.
- Task start/stops should get unique TaskWork UUIDs that map to the convo chunks, and can be used in references on tickets
- on task update maybe use a haiku agent to summarize the current state of the task in 5 sentences, 4, 3, 2, and 1 sentence.

## contact-utils

- there's been discussion elsewhere about how this should work
- something something shared contacts folder, org structure, auto-sync

## deep-research
- See claude managed agents, theres an agent template for deep research
- Reddit is an increasingly important source for understanding how to do things. I think there was a PR to make a plugin for that, what happened to it? Can we get it installed on all agents?

## github
- getting notified about updates
  - using PAT, check notifications endpoint, pipe to channel?
  - periodically check open PRs and issues for user (author/assign/review), compute hash, if hash changes notify. Don't add too much, but maybe add info about the events?
    - ci status
    - comments
    - reviews
    - assign events
    - PR body updated
  - for reviewers, maybe debounce updates? What about CI review workflow?
- hooks
  - pretooluse
    - posting a github review/comment
      - block if content is the same as review already on there
  - 
## github-app

- Using github app, do webhook event stream?

## plugin-utils + plugin-dev
- We need to fork the plugin-dev and other claude plugin/mcp/skill/hook/etc plugin into our agents monorepo so we can add our flair to it and use it critically for our plugin validation. Alex and Jack should have the plugin
  - this should be combined with deep-research and strong use of claude-code-guide agent to consult best practices for plugin development, noting the source's age in relation to the version of claude code
  - for plugin-dev, skill writing should call out that things like references that are mentioned multiple times in a skill should use the github footnote format to define the reference. For those that are shared between skills, use a yaml file as a structured way of holding the references, and use a footnote to reference it in the file. For instance the shared agent consistency audit doc.

## ticket-utils

- agents have their own tasks, not shared between agents but is shared between sessions and potentially teammates
  - tickets without a backend are stored like Tasks but in an org shared folder
- ticket utils help map each agent's task (do a thing) to a ticket (an org tracked doc on some deliverable), as well as the request that triggered it (if any exists outside of the ticket).
- All the things that a task tracks automatically bubble up into ticket management
- ticket management should be abstracted from actual platform, allowing swappable (and potentially multiple at the same time, or migration) ticket system backends like:
  - github issues
  - linear
  - jira
  - https://taskwarrior.org/
  - file (like https://tasks.md/ or https://todos.md/ or https://github.com/todomd/todo.md)
- tasks should be attached to tickets, if not one is created automatically (eg in the agent repo), though links can be updated
  - tickets should be linked to tasks if possible, otherwise just mentioned. History should be kept. Tickets should never be assigned to multiple people at the same time. Assignment tracking should identify agent/subagent/teammate
  - A task associated with a ticket cannot be set to in progress unless the agent is assigned.
  - An in progress task associated with a ticket cannot be set to completed or pending without an update in the ticket identifying that TaskWork uuid. Since each task state -> in_progress is a new uuid, this enforces the ticket get an update after some work is done.
    - For tickets in the agent repo (auto-created), the task syncs directly to remote ticket(?) so it would automatically get the work tracking but may miss the update message?
- hooks
  - session start
    - find all assigned tasks, ensure local state is accurate
    - 

## chat-utils

- ... fill in with other info, like:
  - hooks
    - send message
      - read first / read before sending - like Read(), silently fetch messages in background and error if chat history hasn't changed
        - For fast channels, allow break-glass of submitting the same tool call again to bypass block
  - skills
    - send-chat-message skill delegation
      - Launch skill with "I need to tell person p about thing t on platform pl. I just finished task ta, and need to inform them about my results xxx" in context-fork, so main conversation only sees "sent the following message to p@pl"
  - resorce use to fetch info rather than tools (plugin-wide migration)
  - transcript syncing to file

## channel-utils

- hooks
  - prompt submit 
    - delegate to context:fork skill, reject message if no response needed 
      - trigger a hook with a mini agent that gets the previous messages from the channel
      - if it's not directed at the agent it rejects eg for cron fires that don't need any action to prevent the perpetual "no action to take" response. Instead "no action"s can be removed from the context until action should be taken (with a logged record outside of the conversation context)
- (later) channel-compat layer that utilizes hooks to inject the messages
  - known unknown: don't know how to get messages from mcp server without intercepting them/mcp gateway (not sure if channels emit something somewhere, but since we're using all of our own we can force them to (or maybe use a nix file socket to send messages to and the compat layer gets them that way?))

## doc-utils / archiver plugin

- (?) we need a new plugin: archiver. It uses a stop hook to ensure claude transcripts are copied to a known, dated,protected location, where deletion is prevented. This will allow us to clear AGENT_HOME_DIR more frequently without losing the transcripts for later analysis
- need a compress transcript tool
  - programatically (+ai) extract to file and replace with references:
    - Tools: any tool response
    - Memories: 
      - Light: compress thoughts longer than 4 sentences by running it through haiku to summerize
      - Med: summarize all thoughts from light during each task execution to be one thought per task max 15 sentences
      - Heavy: summarize thoughts from medium to to be 5 sentences (1 per category) or less, utilizing context from surrounding tasks (what I did/what I will do/what went well/what went wrong/my feelings during it)
      - Full: remove all comments

## doc syncing part 2

- Lets make a new 'wiki' plugin and stub out it's specs? can build off of task remote syncing concept, maybe use github repo wiki? hold research? Don't build it just want to hold onto the idea
  - plugin handles autosync?
- in claude-utils (after moving it to nsheaps/agents) can we add a new utility that uses fzf to find all of the running claude instances (regardless of CLAUDE_CONFIG_DIR) across all agents and lists them in a tree, with all of their actively-running subagents, and highlighting them uses claude-stream to show the transcript (scrollable, tmux aware?) of that agent or sub-agent. Make sure Agent() and teammates show the same way under the parent agent, and the listing shows the agent name and prompt (like general-purpose)
  - make sure to fix the bug with claude-stream where sometimes the stream stops following for some reason (maybe file is removed and new one created in it's place?)
- lets improve contacts (should be renamed to contact-utils)
  - HANDLER info should move to generic how-to-iteract, and differentiate between Operator (in interactive console), vs agent-manager vs agent-director (me, previously handler)
  - $AGENT_HOME_DIR/.contacts, one file per contact, organized hierarchically
  - $CLAUDE_PLUGIN_DATA/roles/ for info about each role in the contacts and persona

## lower llm-costs + add resilience: litellm migration

- we need to fork https://github.com/BerriAI/litellm-skills/ into our nsheaps/agents marketplace, and we need to add skills for fallbacks, autorouting, routers, updating the litellm config file
- create agents for each in litellm
- create model defs
  - anthropic
  - freeai
  - z.ai
  - openrouter
- cloudflare ai gateway
- failovers/auto-routing
- mcps? skills? maybe not
- Set up agent environment to point to litellm gateway
- tilt runs it? should it? maybe not?
- Full spec docs to move to proxmox/Docker(vm)/Archane/DockerCompose (but share redis/prometheus/postgres and proper secret setup) set up by iac, but for now manual is fine.

## set up s3-tools for agents to store data in shared private storage not on github
- make sure nate's computer has tools/autosync for that too
- sync
  - transcripts
- store in cloudflare R2?/aws S3?

## ============= agents as a service =============

## mcp-cli export
- hoisted from aitkit/claude-code-sessions, dumps yaml representation of tools for an mcp server

## build out agent-cluster-controller mechanism for tilt to run

## tilt setup to manage controllers directly using cluster mechanism

## migrate agents to run via agent-controller

- agent-controller give mcp tools for agent management
- agent-controller emits metrics

### decide if agent-controller wraps agent harness AND is the mcp server or is agent-mcp-service the agent interface and that uses agent-controller?

## build agent-system-controller


- block tilt from running the same agent running in systemd

## tilt setup to manage instead use systemd service instead of agent-controller directly
  - (?) user systemd service instead of system service (requires root? when do user services start?)

### set up systemd service for agents



## ============= 🐲 here be dragons =============

## k8s support


## iac/github workflow/github repo config as code/repo config from org repo/sync branch protection rules from inside same repo using cron+repo dispatch workflow inside repo that's synced from iac from shared github-workflow but org specific config

## agent-browser / agent-web-service / agent-api-service / et al.
