
I've made some of the intake folder structure for us in nsheaps/agents. It doesn't match what's on the doc because I figured out in practice that I can't just write in a doc and wait for you, and us both editing the doc makes things hard. TLDR:
1. I write in docs/project-management/drafts/xxxx.md
2. when I'm done, I move to docs/project-management/to-triage/xxxx.md
3. one at a time, as you notice it, you move to docs/project-management/org-triage-queue/$epoch.xxxx.md. Make sure you can figure out who wrote it. Figure it out and define it at the top in frontmatter (you'll slowly build this until the thing getting triaged is turned into an actual ticket). If you can't figure out who wrote it, in frontmatter add a list of MISSING:... with things that you need help finding out, move it to docs/project/management/missing-info/xxx and message in discord appropriately.
4. in parallel to 3, when a file appears in the org-triage-queue folder, you read it and figure out which project it belongs in. When you figure that out, you move it to docs/project-management/$project/triage-queue/$epoch.xxxx.md ($epoch is always the value from when you first set it for that ticket, the created date, so don't regenerate it). One message (like this one) might have lots of different aspects of them that affect multiple projects. Extract each individual ticketable item (batching relevant changes together, we want few tickets, but atomic - we don't want PRs that do too much) and place that in the project triage-queue
5. in parallel to 4, you watch all the project triage-queue folders. When a file appears there, one-by-one, in chronological order. When one does, you read it, and make a new ticket for the project-manager to actually triage, following the appropriate schema for the ticket doc. The ticket state should be `triage` (or whatever the project is configured to, and should include the original requester (if you can't figure it out ask in chat), the created time, etc.). Tickets, regardless of state (except archived) go into docs/project-management/$project/tickets/$ticketId-short-description-slug.md and use frontmatter with a defined schema to hold relational data (like assignee). Contact info for now can be something that _looks_ like a URL that the contact-utils mcp server will later handle as a resource request (eg `contacts://1234--heaps-group/byName/Nathan%20Heaps` or `contacts://1234--heaps-group/byGithubUsername/nsheaps`. Later we'll support uuids as well, with merging tools etc.). The ticket itself should not be named with the epoch in mind, but the metadata should capture that epoch as a human readable RFC date format as the created date.
6. When the ticket gets triaged, the project manager may choose to continue with that specific ticket, or close it as not doing or some other sub-state. If the request to triage should be part of other tickets, the project manager may decide to update other tickets to include this request. That ticket must not already be planned work. If a ticket becomes a new ticket, it's state changes to backlog. Depending on the team setup, kanban, a member might 'claim' a ticket ahead of time by assigning it to themselves and setting the state to to-do. to-do implies that the work has already been planned and will be picked up soon. In a scrum/agile environment, a team might go over tickets together and groom them (part of triage process, or just general improvement to backlog or tickets in the backlog, but doesn't allocate tickets to resources), and plan them (assigning work to be done during a sprint, then setting state to to-do and associating it with the sprint (another object type outside of milestones and projects, similar to a milestone but instead of defining a chunk of work, it defines a chunk of time. Typically after a sprint you would retro with the team, whereas with kanban it may be handled adhoc).
   7. Triaging might also result in:
     - assigning to self, moving to in-progress, fixing the quick thing, and moving to complete (such as a small docs change that doesn't need review)
     - creating or updating project files, milestones, etc
     - doing some small research and creating one or more new triage items in the right place, potentially to replace the item being triaged.
    This triaging -> closing should only be done after a ticket is created in the triage state so that it can properly be assigned and closed, even if not tied to a milestone.
  - its also important that we recognize a ticket might not belong to a specific project. For us, we're working out of a single project.
  - it's also important that any of the triage work itself (be it doing the research to properly create the ticket, or the triage process to get the ticket to a backlog state, etc) should be handled by known, type-of-triage-specific, pre-written sub-agents, not by the ticket processor themselves (manager/owner/eng)
  - if the triage request is to do something outside of a project scope, like update or create a milestone, or update a project, or link to tickets together, the agent doing the org-triage-queue processing can just make the change by 
    1. set ticket frontmatter on the doc and save it.
       - Specify parent AGENT_NAME as the assignee and track the sessionid (NOTE-ALL TICKETS SHOULD TRACK IDS OF SESSIONS WHERE WORK IS DONE ON THE TICKET (including triage). Do so in the frontmatter with an events: key that's cronologically sorted and describes the change that happened so you can reconstruct the changes (just say the field that changed and the new value, except for the body of the markdown doc/long desc, and the events list. Track the time it happened as well)), instead of project IDs for the ticket number, use the epoch timestamp as the ticket ID, and ts- (note lowercase, system tickets are lowercase, projects always have upercase identifiers) as the project identifier.
    3. if the SYSTEM project doesn't exist yet, make it
    4. validate the ticket structure then skip the triage step, and move it to docs/project-management/SYSTEM/triage/SYSTEM-$epoch-short-desc.md (I guess I've decided tickets should me markdown with frontmatter, not yaml? We def need a utility so we can do something like `extract-frontmatter markdown.md | yq ....`) and set state to triage. The triage agent can now exit and the system should pick up on a system task to do, move it  as it work through it (a sub-agent per task, potentially resuming a subagent from prior tasks)
    4. make the needed changes, keep track of your work in the markdown file for the ticket, link to PRs if any.
    5. if pending validation, move ticket state to in-review, make sure to specify what it's waiting on. when checking for that thing to happen (like CI finish, CI review, etc), check the ticket too. When that thing resolves, update the ticket, then continue work
    6. When the work is completed, the agent should mark the task as completed and exit
- Anyone assigned to the tickets should be notified when their tickets get updated. In lieu of the lack of channel at the moment, agents should proactively check their tickets when checking on ongoing work when waiting on someone else to make a change to the ticket (will they?)
- We need to design an archiving process that will move done tickets from .../PROJECT/tickets/.... to .../PROJECT/tickets/archive/... after a configurable amount of time.
- at any point in time, a ticket can have typed references to other tickets. specifically right now, we support blocks and blockedBy, just like tasks
  - When triaging, try to add all the relevant ticket links to build the graph of ticket work before moving it from triage to the next state.
  - If there's no blocks or blockedBy, we should still have a way to order tickets, maybe just a priority is fine, but consider sites like linear also allow to to drag the order around.

a lot of your commits end up with CI pushing a lint commit after. Move edit-utils to nsheaps/agents, get it installed, and make sure you can configure the plugin to take a mapping of globs to commands to run after edits are made on those files. You may want to consider an auto-detect pattern, but for the nsheaps org, we use mise as the main script runner for everything. In nsheaps/agents, `mise run lint files...` should delegate to nx and run the proper linting task in the monorepo projects.
  We are missing a lot of projects, so nx setup will happen before the monorepo stuff, but we should at least be replicating the fixes CI makes (share the code if possible, but CI lints everything, whereas you wanna lint just the file you changed).

do you have a skill for key phrases that should trigger other skills? For instance, I want these phrases to auto-trigger you to update rules:
- going forward....
- in the future....
- you should always
...
perhaps the key phrases themselves should be in a dictionary so we can programatically detect them and hint?
Before you make it, tell me what the docs say about it, plan for it. It should be part of skill-utils.

After you come up with an overview of your plan, remind me to make #private-notes (`#private-notes`) available to you so you can use a script to dump the entire transcript from that channel, or from a thread. You should make that script right now. Test it by dumping the entire thread of messages from https://discord.com/channels/1490863845252665415/1497431286661517353 (this thread in #agent-human-resources) into someplace safe, but not someplace committed. maybe `~/.agents/.vault/transcripts/$platform/$server/$channel/[$thread/]YYYY-MM-DD.0.json` (split by day, define a max limit of say 5000 lines, and split into ...DD.0.json, ...DD.1.json, etc if it goes over the limit so that scans don't have to worry about the entire file). Make sure to use the correct file extension, and that you have at least 1 tool to access the data in that file programatically (tell me if you dont and what you want before installing), and at least 1 tool to search for message ids based on a regex search term (that you can then use the other tool to fetch that message, and it's surrounding -X+Y messages (default +-10)).

Using those key phrases for you to make corrections, even before that skill exists:
- going forward when you want to send a message longer than 4 lines to any place other than directly into a doc (eg github PR, discord message, commit message, edits to a wiki page, etc), as needed you should write your message to a file and review it for formatting and accuracy
- going forward, if an agent is online and gets a message implying they're offline, they should chime in that they're not
- going forward, before you make a statement that an agent is online or offline, you MUST check to see their actual state. Do not rely on memory. in the future, agent-utils > agent-mcp-service > agent-controller > agent-cluster-controller will bubble up status of each agent( and their session(s)), and will be easily requestable via tool (make sure this is captured in arch_draft)
- going forward, if I say a "plugin" start with looking for what marketplace it's defined in in your settings. If you can't find it, look for it in nsheaps/agents, then nsheaps/ai-mktpl if you don't know where it is. If it isn't in one of those two repos it might be in another repo like anthropics/claude-code or anthropics/claude-plugins-official. If you find it in there, we should not use it from there.
  - if it isn't found at all, make it, defaulting to nsheaps/agents. Make sure to factor in any designs already discussed in the docs. Even if not implemented now, don't pidgeonhole us into a solution. You should let the user know that you couldn't find it so they can chime in if you need a pointer, but keep working and assume you should make it
  - if you found it in ai-mktpl, propose to the user migrating it to nsheaps/agents, or potentially merging it with other similar plugins, especially those in nsheaps/agents
- Going forward if I ask you for any changes, it must be tracked by a ticket. You cannot work on the ticket without tying your task to it somehow, and you need to be able to go back and forth from the ticket to your (or any other agent's) task, and from the agent tasks to the ticket. A ticket could have multiple tasks from one or more agents.
- going forward, make or update designs, tickets, and specs for any my requests, regardless of the order, must be written incrementally using the doc writing skill (or whatever is appropriate) mentioned below or ticket utils (for tickets). They must always factor in the overall design in other docs, but specs should be specific about what's being delivered.
  - your task helps you focus on one chunk of work, or breaking down complex things into smaller chunks
  - tickets define the request to implement something (small or large). They say how it's going to be used, the requirements, the deliverables, and the user-facing validation steps to ensure the feature works. They use visual guides like mockups, wireframes, design guides, etc, to help explain the words in the ticket and to show what the user will see
  - specs define the technical implementation of a feature, are focused, specific, targeted towards engineers, use visual guides to visually explain concepts and designs (humans love pictures, hate walls of text, love to click into things to get to more details, then back out/up to look at something else)
    - one ticket may affect multiple specs
    - specs shouldn't be written per feature
    - specs should capture the product requirements and deliverables completely, but from the perspective of validation and qa (and potentially what to write unit/integration tests around to avoid manual validation)
    - a product is composed of one or more (typically many) specs, but specs don't necessarily define the layout of the features
    - a project can be a part of one or more products
    - usually projects in ticket management relate back to a team, not to a code-base. This should be configurable and change the skills/rules accordingly if needed. For us, we'll want to store all of our tickets as files in nsheaps/agents for now, and treat our entire organization as one team. Our tickets will refer to codebases in scope in the metadata. All tickets managed by ticket-utils have the same default metadata, but the plugin config can specify extra fields (by referring to a spec, not defining them in the config, so they can be programatically validated)
    - We will essnetially use milestones to batch up related work and stay on track without picking up other work (unless the product owner or project manager say its okay)
    - for websites, later when we look into farish, we'll extract some skills for building pages, extracting features, and building specs for them (we should already have some ticket.
  - milestones should exist outside of a project in ticket tracking, as it may involve multiple projects, especially when projects relate to the codebase instead of the team.
  - we may later decide to do tickets per project instead, but the overhead of those tool calls to make a ticket in every repo for sweeping changes is quite annoying and cumbersome (eg make a change to all agents) right now.

Also, in job-utils plugin (make if not found as mentioned above), create a `job-meeting-standup` skill for how you do standups. Standups aren't unique to engineering/design/product, but are frequently used in those settings. While it's typically a meeting, the same skill would be useable for a scheduled async standup in chat, or if I ask what you're working on. The use of the skill should specify that you shouldn't _need_ to look to see what you're doing, you should just be able to compile and surface it programatically from tickets and tasks. However, if you find yourself lacking that info, gather it manually and give it to the user, and ask if you should improve the skill and data retention and access to make it easier to fetch next time.

And in doc-utils, add a doc-writing-incrementally skill that helps guide you how to go from an idea to a fully fleshed out doc

also for journal-utils for writing journal entries, add a script (for now in journal-utils but maybe later to agent-utils for general transcript extraction) That can extract certain types of messages from a claude transcript, and format them using toon/tron format

And lets add a task to MASTER.md you decide where: I want to import the skills and agents from claude.ai and other anthropic sources (non-exhaustive)
skills (from claude.ai):
 - doc coauthoring (part of doc-utils)
 - internal comms (part of comm-utils)
 - mcp builder (part of plugin-dev)
 - prompt engineer (part of agent-utils)
 - skill-creator (part of skill-utils, but will be merged into our arch)
 - slack-gif-creator (part of comm-utils)
 - doc file types (xlsx ptx pdf docx) (part of doc-utils)
(managed) Agents (from platform.claude.com):
 - deep-researcher (part of deep-research to be renamed to research-and-experimentation or something)
 - field-monitor (part of research, reads blogs for a specific topic)
- structured extractor (part of agent-utils, later to be combined with our *q tools, maybe data utils instead?)
- incident commander (part of incident-utils)
- sprint retro facilitator (part of job-utils)
- data-analyst (maybe data-utils?)
Plugins
- plugin-dev (covered earlier)
- ...

Also help decide: at some point I mentioned project-utils. Do you think that should be ticket-utils or are there other things project-management(/ownership?)-wise that are worth keeping that plugin for in the future? And project-manager role vs product-manager role? should we just assume product- is always -owner and project- is always -manager?

Also decide if we want comm-utils, chat-utils, or both. I think we want both, and comm-utils can farm out to skills in chat-utils and doc-utils, and eventually to others like blog-utils, email-utils, etc.
  - right now you interact with discord through discord mcp server, and occasionally direct API access. My thinking is that chat-utils provides a unified interface for sending chat messages, heavily integrated with contact-utils for preferences and communication styles

Also do some research in the background on toon/tron, make a comparison research doc with visuals/tables/etc that makes it easy for me to see where each one is good vs bad

