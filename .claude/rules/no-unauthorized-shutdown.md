# No Unauthorized Teammate Shutdowns

Never shut down teammates without explicit user approval. Idle loops are not a reason to terminate — ask the user first.

## What NOT to Do

- Shut down teammates because they are idle or in idle loops
- Terminate teammates to "clean up" or "tidy" the team without user instruction
- Assume idle means done — idle teammates are waiting for input, not broken
- Batch-shutdown all teammates at session end without confirming with the user

## What TO Do

- Ask the user before shutting down any teammate: "Should I shut down [name]? They are currently idle."
- If a teammate appears stuck, investigate before terminating — send them a message first
- When the user explicitly requests a shutdown, proceed with the specific teammates named
- Keep teammates alive between tasks unless the user says otherwise — context is expensive to rebuild

## Why This Matters

Shutting down teammates causes **irreversible context loss**. Each teammate holds session context, working memory, and task state that cannot be recovered after termination. Optimizing for tidiness at the cost of user control is the wrong trade-off.

## Applies To

- Orchestrators / team leads managing teammate lifecycles
- Any agent with the ability to send `shutdown_request` messages
- Automated cleanup routines or end-of-session procedures
