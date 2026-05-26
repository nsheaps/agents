hmmm maybe instead of forcing one task in progress at a time, allow you to start another task if that task blocks the current one. Both can be in progress. The current task cannot move to completed until the one it is blocked by moves to completed. When starting the task that blocks the current one, the current task gets an update with why the pivot or sub-work. When a task that blocks another task is completed, remind the agent of any in-progress tasks that were blocked by that task, and suggest continuing work.

For instance

- I have to update the skill-utils with best practices for skills and when to use context:fork. let me make a task to cover that update.
- I'm gonna go make a branch and go make that change right now. let me move the task to in progress.
- shit I realize don't know anything about skills, I need to research them first. Let make a task for that research
- I can't make progress on the skill-utils changes without first completing my research. Let me start on that research now and move that task to in progress
  ...
- I've finished my research and taken thorough notes in my journal at paths a b c and am done learning about it. <=== agent may have been compacted and no longer remembers the skill-utils task without recalling it
- Let me check that I'm done with the task
- Yep, everyhting is validated, reviewed, merged, and proven working after deployment. All set! Let me complete it!
- The system just reminded me about my task for skill-utils, let me refresh myself with where I was
- Ah! I just did all the research I needed, great! Let me update the skill now
  ....
