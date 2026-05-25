---
type: milestone-request
created: 2026-05-25T19:47:57Z
created_epoch: 1779738477
state: to-triage
project: GSD
requester: contacts://heaps-group/byGithubUsername/nsheaps
source_doc: docs/project-tracking/MASTER.md
source_header: "word-vomit plugin"
events:
  - {
      ts: 2026-05-25T19:47:57Z,
      by: alex,
      change: "created from MASTER.md milestone-extraction sweep (project-setup step 3, via sonnet subagent)",
    }
---

# Milestone request: word-vomit plugin

## Original MASTER.md content

> - `E5`: [word-vomit plugin] Lets set up a mechanism for me to write random shit into a file that you guys watch and properly categorize and update it (file-utils from scratch[^scratch] to notify). _(Moved from `# end of tonight 2026-05-24` per Nate Discord [`1508331380239634652`](https://discord.com/channels/1490863845252665415/1497431286661517353/1508331380239634652) — this is the prototype vision; I11/I18/I19 are the implementation tickets._
> - 🆕 `I11`: Create `nsheaps/agents/docs/project-tracking/INTAKE.md`
>   - The top of the file should contain brief instructions for how to use it, and an area for the user to clearly type into
> - `I18`: create a hook in ~~your config~~ ~~project-utils~~ word-vomit for userpromptsubmit post tool use and stop
>   1. hash the intake file and save it somewhere. If it's different than the previous hash, tell the agent to use the 'processing-intake' skill, which you should add to the alex repo.
>   2. hash the master file and remind if it has been updated
>   3. when MASTER.md or it's linked files is updated ~~remind to~~ commit and push immediately via a hook.
> - `I19`: create the processing-intake skill
>   1. If the user's thought is incomplete, wait for them to finish it by giving them a heredoc style identifier to write at the end. If you see the user writing, add a note to the top of the section with the indentifier that the user will need to write
>      1. add another section before theirs for another message to intake
>   2. When the user write the ending identifier, extract what they said to `docs/project-tracking/triage/$epochTimestamp-short-description-of-thing.md`
>   3. Each thing in there by date order (oldest first) gets submitted to a sonnet subagent to go find the correct doc or issue to update.
>      1. First move the file to `docs/project-tracking/processing/$epochTimestamp-short-description-of-thing.md`
>      2. Structure the doc to match a predefined structure that will help you triage it, saving the original text of the request
>      3. update the plan section with how you will tackle triaging the request and adding it to the right place, including how you'll find the right place, and what other data you'll need to collect before properly triaging it. Note you are not grooming the ticket, just properly adjusting the incoming request to the outgoing update. If there is no proper place to put it, a place will be created according to defined routing rules. if no routing rules exist, they'll be created, including updating for new routes.
>      4. update the thing as you go after each step
>      5. when triage is complete, document teh steps taken for triage, confirm all updates are properly linked to it, fix if not
>      6. Move the triage task to `docs/project-tracking/triaged/$epochTimestamp-short-description-of-thing.md`
>      7. Always try to leave things better than how you found it. If you fear that your change might not be well recieved (creates noise, isn't correct, etc) do some more research to increase your confidence. If you cant be confident enough, reach out to another agent or human for help.

## Triage notes

(empty — to be filled during triage)
