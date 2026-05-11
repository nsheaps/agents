---
name: multi-agent-message-bidding
status: draft
description: Mechanism for multiple agents monitoring the same channel to coordinate responses without duplication
owner: nsheaps
created: 2026-04-08
tags: [multi-agent, discord, telegram, coordination, spec]
---

# Multi-Agent Message Response Bidding

## Problem

When multiple agents are configured to monitor the same channel/thread, a single message can trigger all agents to respond simultaneously, causing duplicate or conflicting responses.

## Solution

A haiku-based prompt hook evaluates incoming messages and coordinates responses through a confidence-based bidding protocol using emoji reactions as lightweight distributed locks.

## Requirements

### 1. Confidence Evaluation (Haiku Hook)

When a message arrives in a monitored channel:

- A haiku-based prompt hook evaluates the message
- Returns a confidence score indicating whether the agent should respond
- If above a configurable threshold, the agent proceeds to evaluate whether to respond

### 2. Response Classification

**Informational (no bidding needed):**

- Status of the agent's own work
- Direct responses about things only this agent knows
- These should be posted immediately without waiting

**Potentially shared (bidding required):**

- Messages that might not be directed at this specific agent
- General questions multiple agents could answer
- Requests that could be handled by any available agent

### 3. Bidding Protocol

For messages requiring bidding:

1. **React** to the message (emoji reaction serves as a "claim" signal)
2. **Check for competing responses:**
   - Review channel event log (streamed into conversation)
   - Check event timestamps on the message
   - If timestamps aren't available from the channel platform, the channel plugin MUST track them internally as they arrive outside the agentic loop
   - Check for additional messages in the thread that indicate someone else has already responded or the message no longer needs a response
   - Remember: not every message is directed at the agent that receives it, and not every message requires a response or reaction. If it's not for you, ignore it.
3. **First responder wins:**
   - If this agent was the first to react → continue with response
   - If another agent reacted first → remove own reaction, stand down
4. **Cleanup:**
   - Once the response is posted (including "I'll get right on that" confirmations), OR 5 seconds have elapsed from the original message timestamp (whichever is LONGER), remove the reaction from the original message

### 4. Channel Plugin Requirements

Channel plugins (Discord, Telegram) must support:

- Reaction add/remove on messages
- Event timestamp tracking for reactions (if not natively available from platform)
- Streaming channel events into the agent's conversation context
- Querying reaction state on a message

### 5. Configuration

- Confidence threshold (default TBD)
- Which channels/threads to monitor
- Which message types trigger bidding vs immediate response
- Reaction emoji to use for bidding (should be unique per agent or shared)
- Timeout duration for cleanup (default: 5 seconds)

## Open Questions

- What emoji should agents use for bidding reactions? Same emoji (race condition) or unique per agent?
- How do agents discover each other's reactions if the platform doesn't push reaction events?
- Should there be a "cooldown" after losing a bid to prevent rapid re-evaluation?
- How does this interact with @mentions (direct mentions should bypass bidding)?
- Should the confidence evaluation consider the agent's current workload/availability?

## Source

- Discord thread: https://discord.com/channels/1490863845252665415/1491507231022256360

## Related

- Discord plugin (`discord@ai-mktpl`)
- Telegram plugin (`telegram@ai-mktpl`)
- Agent teams infrastructure
