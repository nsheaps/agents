---
name: research
description: Deep-dive investigation procedure for complex questions requiring multiple sources. Use when a question can't be answered from a single source or requires synthesis across code, docs, web, and issues.
---

# Research

Procedure for conducting thorough, evidence-based investigations. Any teammate may need to perform research — this behavior ensures consistency regardless of who does it.

## Purpose

Produce a written report that answers a specific question with cited evidence, confidence levels, and identified gaps. Reports are saved to files, never returned inline in conversation.

## When to Use

- A question requires synthesizing multiple sources (code + docs + web + issues)
- The answer isn't in a single file or document
- You need to evaluate competing claims or approaches
- Someone asks you to investigate or compare options

## Steps

1. **Clarify the question** — Restate it in your own words. If ambiguous, ask before investigating.

2. **Plan your search** — Identify where evidence likely lives:
   - Source code (Grep, Glob, Read)
   - Project documentation (docs/, specs/, README)
   - GitHub issues and PRs (gh CLI)
   - Web resources (use sub-agents for web fetches to avoid context bloat)

3. **Gather evidence** — Search each source. For each finding, note:
   - The claim or fact
   - The source (URL, file path, line number)
   - Confidence level (High / Medium-High / Medium / Low)

4. **Cross-reference** — Compare findings across sources. Flag contradictions.

5. **Write the report** — Use this structure:
   - **Question**: The specific question investigated
   - **Answer**: Clear, direct answer upfront
   - **Evidence**: Supporting details with citations
   - **Confidence levels**: Per finding
   - **Open questions**: What remains unknown
   - **Sources**: Full list of URLs, file paths, references

6. **Save to file** — Write the report to the designated location (typically `.claude/tmp/{topic}-research.md`).

7. **Summarize to requester** — Send a concise summary (key findings + file path). Do NOT include the full report in the message.

## Anti-Patterns

- Returning large reports directly in conversation instead of saving to files
- Fetching web pages directly in your own context (use sub-agents)
- Stating claims without cited sources
- Presenting speculation as fact — "I don't know" is a valid finding
- Expanding scope without approval when research reveals bigger questions
- Accepting simple lookup requests as "research" — redirect those to self-service
