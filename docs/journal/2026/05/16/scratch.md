## after henry
- noting to confirm fixed with henry, jack and general process later, after jack is brought up to speed errors in launcher for unknown plugins
- 1pass plugin, posttooluse hook needs to mutate response that greps for secret values (not names) from the ENVIRONMENT secret, and replaces with xxxxREDACTED(SECRET_NAME)xxxx
- the launcher logs still don't show the startup prompt
- the launcher logs and the initial prompt is missing the "running claude --arg1 --arg2... stuff".
- (agentic-behavior) (perhaps as an agent-manager role?) When you ask an agent to perform a procedure, you need to be extra specific, so each agent does it exactly the same way. Remove any ambiguity possible, including by nature of providing them a shared script to run and generate the needed data, otherwise you'll end up with different results and it makes result comparison harder.
- setup of $AGENT_HOME_DIR should symlink $AGENT_HOME_DIR/.source to the agent repo, and set $AGENT_REPO to be to the symlink
- We should make bin/agent work better:
  - updating plugins is MEGA slow...
    seed plugins using this mechanism?: https://code.claude.com/docs/en/plugin-marketplaces#pre-populate-plugins-for-containers
  - ~~in the agent repo, .claude/SYSTEM-PROMPT-ADDENDUM.md should be passed to --system-prompt-append, .claude/AGENT.md should be the persona definition with the roles and paths to details about those roles (maybe render at runtime so we can parse frontmatter from those role files and share a brief description of the role?).~~ done https://discord.com/channels/1490863845252665415/1497431286661517353/1505286179463893053
  - The logs are too verbose. Launcher log file can contain all debug level logs (anything that was removed from stdout/stderr from other tools), but what's printed to console and passed to agent should be MUCH shorter (and agent prompt should call out link to full logs)
   - For plugin checking -> no updates, don't print for each plugin. Print for each one that gets updated, and if none get updated, print a "no updates for any N plugins in M marketplaces" 
   - For env vars, only print unset and export into the log file/at debug level
- need update to agent management skill: do not write directly into their console, their console is read only. Use a script to perform specific tasks that require writing into their console, but avoid it whenever possible. The agent should be able to manage their own restart proceedure. If writing into the tmux shell is needed, use a script passthrough layer.
- agent stop should note the source of the request and the current session id to shut down in the continuation prompt.
- agent start prompt (on both fresh session and new session) should encourage the agent to review the events prior to the continuation prompt. If a new session, then it should review the previous transcript's tail as well.
- please remove the idea of a session heartbeat from any plugins and agent repos (the heartbeat mentioned in the launcher), reduce the complexity.
- the .claude.json seed should disable prompt suggestions, since when you read the pane it looks like text is already entered and you don't see the cursor.

## pause
- user prompt submit for channel messages (discussed elsewhere) should trigger a hook with a mini agent that gets the previous messages from the channel and if it's not directed at the agent it rejects.
- need to confirm are todo/task consolidation and discord plugin updates part of issue migration and PR consolidation? Should those be front-loaded? Or combined?
  - task tracking, save to $AGENT_HOME_DIR/.tasks/? avoid .claude/make it more generic? Make it auto-sync up to github issues? use gh websocket streaming to get events for label add for assignment/comments to sync down? How much should be cached locally? Can Explore agent more effectively scrape locally, or should there be an ExploreTickets agent (which maybe is based on or extends an ExploreGraphQL and/or ExploreRemoteDataStore agent?)
    - what about transcript extraction for start/stop of Tasks?
      - At minimum in each task, track events:
        - Created datetime
        - Update datetime and what changed
        - if state changed, note old, new state, session id, and some uuid of the tool call or chat message in the transcript
      - this way we can extract later, but it gets confused when there's multiple tasks in progress
  - what about contacts?
  - What about auto-references?
  - what about auto-commit for agent repos?
- somewhere is a PR for a plugin that disallows Bash(cd ... && ...) and enforces CD calls to happen separately after the dir as added to allowed dirs, can we please get that merged and added to all 3 agents?


## pause


- We need a way for agents to discover and dynamically use plugins from the known marketplaces, so they can search for skills they don't have, install them, perform the task, then remove them (or install them in a forked ephemeral context in some way). Lets create a plugin-utils plugin that gives agents tools for finding, inspecting (plugin info from marketplace and local configs/state), adding, removing, updating (from a marketplace) plugins (separate from our plugin-dev plugin fork). All agents should have this plugin. Make it in nsheaps/agents. When agents use these tools, they must specify if the addition of the tool is temporary (eg goes into settings.local.json) or permanent (goes into <agent-repo>/.claude/settings.json and trickles into $AGENT_HOME_DIR/.claude/settings.json). Needs a way to also enable a sub-agent to have a plugin that others do not. Make sure skills appropriately reference sections in claude docs that would help act as supplements, like https://code.claude.com/docs/en/plugin-marketplaces#manage-marketplaces-from-the-cli
  - Note: plugins can be installed and updated at runtime, skills are dynamically loaded, and we should consider running skills in a forked context. Rules are dynamically loaded. Settings files are dynamically reloaded. (according to docs), agent files are not.
- Reddit is an increasingly important source for understanding how to do things. I think there was a PR to make a plugin for that, what happened to it? Can we get it installed on all agents?
- We need to fork the plugin-dev and other claude plugin/mcp/skill/hook/etc plugin into our agents monorepo so we can add our flair to it and use it critically for our plugin validation. Alex and Jack should have the plugin
  - this should be combined with deep-research and strong use of claude-code-guide agent to consult best practices for plugin development, noting the source's age in relation to the version of claude code
  - for plugin-dev, skill writing should call out that things like references that are mentioned multiple times in a skill should use the github footnote format to define the reference. For those that are shared between skills, use a yaml file as a structured way of holding the references, and use a footnote to reference it in the file. For instance the shared agent consistency audit doc.
  - multiple repos is hurting us. We will consolidate most things into nsheaps/agents, but that will come at a later (but soon) point. For now, we can load plugins using a path relative to a marketplace. Make sure plugin development skills are used frequently, guide the agent to use a worktree to make the changes, add a $marketplaceName-dev marketplace using a local directory path to the git worktree on the agent that is being used for testing and make changes that way so the validation loop is faster and before pushing the plugin and opening a PR.
- we need to fork https://github.com/BerriAI/litellm-skills/ into our nsheaps/agents marketplace, and we need to add skills for fallbacks, autorouting, routers, updating the litellm config file

## litellm migration

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

## before agent-cli migration


- for every agent, lets update the statusline by making our own statusline plugin in nsheaps/agents similar to ai-mktpl's statusline plugin and how it sets itself up, I want to see
  - teams is claude's agent-teams
  - $SESSION_STATUS is from $CLAUDE_CONFIG_DIR/.claude/sessions/$pid.json
  - $REPOANDBRANCH_OR_PATH: 
    - if cwd is in git repo, print (with parens being diff from remote and after being ahdead/behind but with correct arrows, not ^ v):
      $org/$repo @ $branch (+2,-3) ^ 3 v 5 
    - if cwd is not a git repo, print absolute path, but if /a/b/c/d/e/f/g parts are on the path, truncate with ... c/d (save first 2 and last 3):
    - for context, have a mapping of model names to context size, and honor the env var to overwrite auto-compaction context size for the actual size and %
    - the [SSSTTTCCCCCCCCC] should be different colors (using ansi) and different ascii characters (for different patterns/opacities for when color is insufficient) that shows the breakdown of sections of the context used by different pieces (system prompt, tools, conversation, free space, etc). Use /context for inspiration with colors and symbols, and make it as wide as possible (using tput or COLUMNS or whatever to ensure it's the correct width)
  > $AGENT_NAME ($AGENT_HOME_DIR) <$GIT_AUTHOR_EMAIL> | Teams: (ON|OFF)
  > claude($PID, v=$CLAUDE_VERSION)://$SESSION_ID | Status: $SESSION_STATUS | Model: $MODEL (effort: $MODEL_EFFORT)
  > Ctx: 248k/500k (49.6%) [SSSTTTCCCCCCCCCFFFFFFFFF]
  > Last updated: $RFC_3339_DATETIME_LOCAL_TZ
  > $REPOANDBRANCH_OR_PATH

- We need to start a pattern in ai-mktpl and agents, where plugins can provide a 'maintenance' hook, and prior to version bumping in CI each plugin gets it's maintenance hooks run. This lets plugins package stuff into their distribution as part of the release process. In the future, this potentially needs to happen after mono repo build processes, and can potentially bloat the repo.
- agentic-behavior needs some TLC to reduce it's ruleset. Make things hooks/skills/agent as much as possible and reduce the imported rules to only those that MUST be there on every part of the conversation (including most subagents)
  - review the recent doc addition to the plugin root (claude.md? readme.md?) with some guiding principles
    - it doesn't say it yet, but that readme should also say that plugins should lean hard into resources served by MCP servers. That becomes a requirement after migration to typescript and nsheaps/agents, but is only a suggestion for now.
    - also prob doesn't say it yet, but we are making a _ton_ of research docs, and it seems always new rather than updated. I _love_ using lots of small files to take notes, but they all end up in one mega folder, and it makes it hard to see the final consolidated research perspective. For task execution I want to start seeing agent repos with a docs/journal/YYYY/MM/DD/xxx.md structure where you take your raw notes. Perform tasks at a basic/research level to understand the task and scope without looking at any prior research, THEN look at the prior research and re-confirm the perspective and scope. Constantly ADD to your journal files (assume you can't erase, but you can update to add footnotes/references and strikethroughs, make sure to datetime stamp your additions), then update the shared research docs in docs/research/topic-name/RESEARCH.md and then update docs/research/topic-name/ABSTRACT.md if necessary.
  - You should always be confident your changes work properly (through self-review, automated tests, manual testing, validation) before pushing them. Avoid CI resource waste.
  - it doesn't today, but it must really really really drive home that you must use skills to accomplish Tasks, even if you have previously read the skill
  - stop using tmp, instead use docs/journal/...
  - we need to duplicate all the built in skills and agents into docs inside agentic-behavior. Don't disable or replace them for now but we need a mechanism to see them. Pull them out of the binary. Note which version was used to pull it. Don't guess. Create a maintenance hook in agentic-behavior to continuously do this programmatically. Likely we'll need some configuration of what to extract, that gets updated overtime based on what we find and docs.
  - We need way better compaction rules. One of the most frequent failures is after compaction you start talking into the transcript instead of responding to users on the platform they messaged you on. Compaction level should be high, since needed data should already be captured in files. The compaction message should state where to find what data and details about the Tasks being worked on.
  - over-engineering happens _way_ too often. The rules say KISS, but that's not good enough. We need to really push on "start as small as possible and iterate outwards, don't overengineer and cover edge cases that aren't yet likely to happen" sort of mentality
  - it must also really drive home the point of spec driven development. Don't directly use these, but research and review best practices from the internet, and these sources. It's critical to follow the iterative guiding principals here and to NOT one-shot these tasks. One time I asked you to port a ralph-wiggum loop to /agentic-behavior:brain and you missed all of the programmatic enforcement aspects that made sure the loop kept going, don't do that again. Note: these sources might not be specific to claude-code, or they might have claude-code specific flavors. Not all agent harnesses act the same. Research and review without limit to scope but ensure your implementation focuses on claude best practices. Also note that these are known for being extremely opinionated (which is okay, I just want our opinions, not their), and are known for sometimes overcomplicating things or context bloat. Inspiration is good, but we want to be sure to capture the process of defining the user story, the requirements, the spec, the design, the tests, the implementation, the validation, the review, and deployment.
    - https://github.com/github/spec-kit
    - https://github.com/obra/superpowers
    - https://github.com/razzant/ouroboros
  - we need to enable agent teams, and we need to guide the main agent better on when to spin up a teammate and when to spin up an Agent(run_in_background:true).
    - this needs to be optional and off by default, but I want it on for alex.
      - Turning it "on" means setting the env var before launching claude (in 1pass ENVIRONMENT), and including extra skills for guidance on using teammates vs Agent()s
    - it's unclear how channels work in this context
    - it's hard to follow all of them


- we need nsheaps/agents to (1) have a package for agent specific renovate-config, and (2) a plugin that the agents use to enforce that config trumps whatever it extends from, which blocks the automerge of updates to tool version files from renovate for things like mise.toml, package.json, Dockerfile, etc...all automerge is off, all agents need it to be auto-reviewed (but plugin setting allows that to be turned off) that the .ai-agent-jack/henry/alex inherit from instead of the org one.
  - bonus points if we can find a mechanism (mise plugin?) to share tool versions across the org. I want to know when there's a claude-code update but I don't wanna know once per agent, and I want to be able to test an upgrade on a specific agent.
  - when there's an update we need to programmatically test the patcher with it.
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

- we need to set up a new plugin that comes with a built in scheduled job that forces the agent to perform a self-analysis/dream cycle, then re-build their agent from the ground up, saving only what's needed, migrating any personal rules/hooks/skills/agents/etc to plugins as necessary, validating their configuration matches the claude code best ptractices against the docs using claude-code-guide for help, etc. This needs to be a well captured skill, which itself also gets maintained in this process. This will allow that agent to continually improve itself on a schedule, but be manually triggered with skill invocation too. The aim should be to fully re-create the agent using the current setp as a template (so you have to basically audit everything), plan a small, calculated, targeted change, make the change, and repeat incrementally over time. The skill should take care to hoist stuff to shared plugins (existing if it makes sense, new if not) in PRs, but note to not remove it's own behavior (should add a circuit breaker) until the plugin is updated internally. (Later?) the agent-controller will help keep the agent aware of when plugins become available for update and if restarts are required (which in turn also updates the plugins at the moment). The cron should be disabled by default, but skill available. Make this in nsheaps/agents' marketplace, and install on alex only.
  - the agent should review it's interactions in it's transcripts, especially failures, or times it needed to go back to fix something it thought was correct the first time.
    - most things will come in via channels, so the transcripts have everything, but sometimes you'll need to query external sources, eg the ci logs for a job that failed but you didn't look at prior, maybe you'll find a better way in hindsight
  - make another plugin that does the same thing but for org-wide behaviors, also performing evaluation of the proposed PRs against other seen behaviors in the org, comaprison against known issues and ongoing incidents, thorough reviews against best practices and org policies, etc. All agents can inspect and understand their own setup, and try to improve themselves internally, and ask for improvements from agent-engineers. Agent-engineers can make the changes to themselves and other agents (when permitted by the agent-manager)
- add new task immediately after jack is made golden, before we consolidate PRs and Issues: we need to really reduce jacks context
  1. promote alex to a full software engineer and agent-engineer. Upgrade him to opus[1m] and set his context compaction to 500k like jack is
  2. reduce jack to sonnet
  3. in claude-utils, there's a claude-diagnostics tool, make it work so it prints all details about the /context (it worked before but now it's broken)
  4. use claude-diagnostics (maybe need an `bin/as-agent` wrapper to set CLAUDE_CONFIG_DIR and the like? or re-use what we have?) with jack to get a good view of what's clogging the context
  5. Use the skill from the previous task to make a small, but incremental improvement to Jack with an end goal of capturing as much as possible in skills (consider in a forked context), agents, hooks, before using rules, and moving stuff to shared plugins and making jack as clean as possible, relying more on hook and skill automation than forcing the context to contain a lot of rules. Ensure captured rules and behaviors don't contracdict each other. If they do, use your best judgement to reword as a whole to capture the preferred behavior of what you think the intended desire whas.
  6. Repeat step 5 until his default context usage under 50k.
- we need a new plugin: archiver. It uses a stop hook to ensure claude transcripts are copied to a known, dated,protected location, where deletion is prevented. This will allow us to clear AGENT_HOME_DIR more frequently without losing the transcripts for later analysis
- we need to fork hookify into our agents monorepo. (1) for consuming shared hooks from another 1+ repo(s) (which get set up at SessionStart, but has to wait for the agent's token to be valid (eg in a web session where the session start hook runs in parallel and the launcher doesn't have a chance beforehand)), and (2) skills for creating and updating them. The plugin should not be limited to hooks, rather focused on shared org behavior as patterns, such as "each repo probably has mise, and probably has a task called 'lint' so we can just blanket set up a hook that prior to committing code, we run the lint task", or "hook into when /\.?mise(\.toml$|/)/gi is written or edited and validate that it matches the org patterns for naming (no . prefix, tasks go in the mise folder, not defined in mise.toml, etc). It should autofix and notify when possible, but if it can't it's errors should be very specific about what happened, why it happened, and what's needed to fix it". Each of our 3 agents need to be set up with the consumption plugins, and and alex and jack should get the skill plugin, and each agent should consume from the nsheaps/.org repo.
  - we need a better dir structure for the hook files at the org level
  - (3) we need a plugin for directory specific hooks, eg <repo>/.claude/hooks/... for repo wide stuff, <repo>/docs/.claude/hooks/... for hooks that apply to the docs folder.
    - I want this plugin to track tool calls per folder, and enable hooks to define frontmatter that allows the engineer to define something like "you must use this skill (or tool) before editing files in this folder"
    - I want the frontmatter also to have a flag as to whether or not the hook applies recursively to all subfolders

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
- Lets make a new 'wiki' plugin and stub out it's specs? can build off of task remote syncing concept, maybe use github repo wiki? hold research? Don't build it just want to hold onto the idea
- in claude-utils can we add a new utility that uses fzf to find all of the running claude instances (regardless of CLAUDE_CONFIG_DIR) across all agents and lists them in a tree, with all of their actively-running subagents, and highlighting them uses claude-stream to show the transcript (scrollable, tmux aware?) of that agent or sub-agent. Make sure Agent() and teammates show the same way under the parent agent, and the listing shows the agent name and prompt (like general-purpose)
  - make sure to fix the bug with claude-stream where sometimes the stream stops following for some reason (maybe file is removed and new one created in it's place?)
- lets improve contacts
  - HANDLER info should move to generic how-to-iteract, and differentiate between Operator (in interactive console), vs agent-manager vs agent-director (me, previously handler)
  - $AGENT_HOME_DIR/.contacts, one file per contact, organized hierarchically
  - $CLAUDE_PLUGIN_DATA/roles/ for info about each role in the contacts and persona
