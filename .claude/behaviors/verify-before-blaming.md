---
name: verify-before-blaming
description: Check your own work before blaming external tools or systems. Use when something fails, produces unexpected output, or seems broken. Addresses the team's pattern of accepting incorrect root cause diagnoses.
---

# Verify Before Blaming

Procedure for investigating failures without jumping to conclusions about external tools. 4 of 9 logged team failures involved accepting an incorrect root cause diagnosis — most commonly blaming an external tool that was working correctly while the actual error was in the agent's own work.

## Purpose

Ensure root cause diagnoses are evidence-based, not assumption-based. The team's track record shows that when something seems broken, the most likely cause is our own work — not the tool.

## When to Use

- When a tool produces unexpected output
- When a build, format, lint, or test step fails
- When someone (including yourself) offers an explanation for a failure
- When you're about to apply a workaround
- When you're about to report a tool as broken or buggy

## Steps

1. **Check your own work first** — Before investigating the tool, verify your inputs:
   - Is the file you're operating on syntactically valid?
   - Are you passing the correct arguments?
   - Is the file path correct?
   - Did you save your changes before running the tool?

2. **Reproduce in isolation** — Run the suspect tool with a known-good input:
   - If it works on known-good input: the problem is your input, not the tool
   - If it fails on known-good input: you may have found a real tool issue
   - Document both the test and the result

3. **Verify each theory before accepting it** — When you form a hypothesis:
   - State it explicitly: "I think X is causing Y because Z"
   - Design a test that would disprove your theory
   - Run the test
   - Only accept the theory if the test supports it

4. **Be skeptical of the first explanation** — The first explanation is often wrong, especially when it blames something external. Ask:
   - "Is this the simplest explanation?"
   - "Am I blaming something I can't see over something I can check?"
   - "Would a fresh pair of eyes reach the same conclusion?"

5. **Get independent verification** — Before committing to a diagnosis:
   - Ask another agent to reproduce the issue
   - Or ask Coach to review your root cause analysis
   - A diagnosis confirmed by one person and accepted by everyone is not "verified"

6. **Only then report or act** — After steps 1-5:
   - If it's your own error: fix it and report the failure (per failure-reporting behavior)
   - If it's genuinely a tool issue: report with evidence (known-good input, reproduction steps, expected vs actual output)
   - If it's a workaround: get approval before applying

## Anti-Patterns

- Blaming an external tool before checking your own work
- Accepting a plausible explanation without testing it
- Multiple agents reinforcing an unverified diagnosis ("sounds right to me")
- Applying workarounds for problems you haven't actually diagnosed
- Treating "it worked before" as proof that the tool changed rather than your input
- Reporting a tool bug without a minimal reproduction case
- Scaling up a workaround (e.g., expanding ignore rules) without verifying the root cause
- Letting confirmation bias drive diagnosis — if you expect a tool to be buggy, you'll find "evidence" it is
