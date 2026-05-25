Do these things, remember to commit each file after they're changed, especially tickets and milestones and triages, I want to see it flow between each folder in the git history. Commit messages should describe the work done to change the file, not the work done described by the file itself, so they should generally be short and non-duplicative, except for the event log inside. Later for file-based ticket storage we may rely on git history (if git backed) for the event log instead. All sub-agents mentioned here should use sonnet, not opus, and should be done via script(s) instead of manual shell calls to help reduce context usage. These scripts will also help later.

1. start by writing a claude.md in docs/project-tracking that'll help you figure out how to use the folders. Consider potentially referencing skills in ticket-utils
2. create the folders described in the initialize.md doc for the project management. Add claude.md's hierarchically to help with what goes where. 3. Also create the projects for each repo to track tickets. each project folder should have a project.yaml with:
   - name
   - short desc
   - long desc
   - creation datetime
   - update datetime
   - default assignee
   - product owners (list of contacts://... like URLs, people that make decisions on the products owned by this team, these people must also have the product-owner role)
   - project managers (list of contacts:// people that manage the tickets for this team (and must have the project-manager role))
   - references (list of things like repository urls, wiki home-pages, teams, contacts, etc, consider structuring the data so you can also specify the type of reference and structured data?)
   - ...anything you like but define the project schema so it's consistent...
     NOTE: I said project.yaml but it could be PROJECT.md, with frontmatter to save the structured data. Consider which is better. markdown files can potentially offer the benefit of doubling as documentation/wiki. If markdown route is chosen, consider if long desc is needed in frontmatter, or that's what the markdown body is?
     Our team's project will start with encompassing these repos
   - nsheaps/agents
   - nsheaps/.ai-agent-jack
   - nsheaps/.ai-agent-henry
   - nsheaps/.ai-agent-alex
   - nsheaps/agent-kenny
   - nsheaps/ai-mktpl
   - nsheaps/claude-utils
   - ... all of the REPOS.md in scope (which should have been updated from the issue?)...
3. create /to-triage/ requests for all of the milestones for the headers in MASTER.md
4. do the processing to move it into the org-triage-queue
5. Do the processing to make the milestones, update master.md to link headers to the milestones. If a milestone is complete, add a line under it in master.md "completed YYYY-MM-DD HH:MMZ. Verified against [milestone test plan](./path/to/test/plan.md), [results](./path/to/validation/$epoch-results.md)"
   - results need to specify who did it, what the test was, and the results of each. Can currently just be duplicate of the validation plan in the task, since you need to do those as well.
6. for every file in task-summary/, prefix each file with a prompt like:
   > The following is the contents of the file as previously lived in docs/project-tracking/task-summary/xxxx.md. To triage this ticket, we'll need to appropriately file this as an actual ticket within the appropriate project.
   > Review the summary, and MASTER.md, and build out the ticket to triage.
   > Then, get the triage request to the actual ticket(s) in triage state and in the correct project(s). This will likely be one ticket per file for now, but you may choose to make more than one if you deem appropriate.
   > The ticket should capture this original summary, and the original messaging as it appears in MASTER.md. It MUST also be linked to the appropriate milestone.
   > When the ticket is ready, in the triage state, and is confirmed to have the needed information, update master.md appropriately to link to the ticket instead of keeping info in master.md. The link should be: `[$emojiState | $ticketShortDescription](relative/link/to/file/that/works/on/github/and/local/instead/of/link/to/github/directly.md)` the ticket short description.
   > After each file is processed with the prefixed message, move the file to the /to-triage/. This effectively triages the previous task summaries to turn them into real tickets.
7. do the triaging in the project queue(s). Tickets that are verified completed can go straight to the completed state. Anything else in progress needs the ticket updated with the fields from the bug ticket template or feature ticket template:

- bug tickets should include a description of the problem, the expected, the actual, and steps to reproduce, along with any analytics info that helps identify things that might not be included in str or desc
- feature tickets should include a
  - user story(s) - one for each persona affected by the feature
    - (preferrably with the "as a RRRR" referring to a user-persona (not our org roles or agent personas, a user-persona is something put together by product/design teams to describe a general outline of their target market. There might be (and probably should) multiple personas impacted by this ticket, and products should generally target one or more (erring on at least 2 or 3 separate user-persona's)))
    - "As a **_ I want to _** so that I can \_\_\_"
  - A list of stakeholders (Agents, humans, teams, companies)
  - any relevant designs/wireframes/prototypes
  - requirements + nice to haves (acceptance criteria)

7. update any internal tasks to have direct mappings to these ticket ids, since they'll now be project based
8. double check master.md has tickets for the things that had a task-summary before with no bullets underneath (captured in the tickets)
9. clean up task-summary since all files should have effectively been moved to the right location and it'd now be an empty folder.
10. appropriately move the initialize.md doc to /to-triage/ folder. Clean up any folders that shouldn't be used for ticket management (task-summary will be used, do not delete that)
11. do the process for moving that into the /org-triage-queue/ folder, split apart where necessary. This effectively processes the asks in initialize.md into triage requests
12. audit the hierarchical CLAUDE.md files for quality. After setup is complete, the one-time-bootstrap references in each CLAUDE.md (e.g. "SETUP.md — Alex is executing 2026-05-25") become stale. Walk every `CLAUDE.md` under `docs/project-tracking/` and remove the dated/one-time setup references, ensure each is still bullets-only and succinct, and verify each links only to files that still exist. Commit the cleanup as a single sweep.

Later the ticket-utils tools will automate all of this. For now we'll go without the parent drill down pages.

When you read this doc, please make sure I'm not missing any steps. At the end, anything in my initialize.md doc, task-summary docs, and milestones should be properly documented. Master.md won't be a link to tickets for each one, just ones that have the task-summaries, and feedback from my initialize.md is either captured in new tasks, or context added to other tasks. Any change in behavior requested by initialize not part of existing features should first be tracked as a ticket to describe the changes to make to the correct plugins/skills/repos, do not just make those changes (or silently acknowledge them without making changes).
the SYSTEM is not allowed to make changes to plugins/skills/repos
maybe consider tracking behavior changes in it's own project? Is that making it too complex for now? maybe a tag on the tickets?

please excuse the non-consecutive numbering, the indentation is more important.
