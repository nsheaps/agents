/**
 * validation-steps.ts — parser for the <validation-steps> block in a task
 * description. This is a faithful TypeScript port of the awk parser in
 * `hooks/task-invariant.sh` (the `parse_validation_steps` function). The two
 * parsers MUST agree — the MCP server enforces the same lifecycle invariants
 * in-process that the PreToolUse hook enforces for the built-in Task tools.
 *
 * Mirrored awk semantics:
 *   - The block is delimited by lines matching, case-insensitively,
 *     `^[ \t]*<validation-steps>[ \t]*$` and `^[ \t]*</validation-steps>[ \t]*$`.
 *   - Inside the block, each line is left-trimmed, then matched:
 *       `^- \[ \][ \t]+`   -> unchecked item
 *       `^- \[[xX]\][ \t]+` -> checked item
 *       `^RESULT\(`         -> a RESULT line clears the "awaiting RESULT" flag
 *   - A checked item sets `awaiting`; if the next item (checked or unchecked)
 *     or the closing tag / EOF is reached while `awaiting` is still set, the
 *     PREVIOUS checked item's 1-based index is recorded as missing-RESULT.
 *   - Indices are 1-based and count BOTH checked and unchecked items in order.
 *   - Tag text appearing inside RESULT prose, code blocks, or headers does NOT
 *     toggle the block (the open/close regex anchors the whole line).
 */

export interface ValidationStepsReport {
  /** number of `- [ ]` unchecked items */
  unchecked: number;
  /** number of `- [x]` checked items */
  checked: number;
  /** 1-based indices of checked items missing a RESULT(...) line */
  missingResult: number[];
}

const OPEN_TAG = /^[ \t]*<validation-steps>[ \t]*$/;
const CLOSE_TAG = /^[ \t]*<\/validation-steps>[ \t]*$/;
const UNCHECKED_ITEM = /^- \[ \][ \t]+/;
const CHECKED_ITEM = /^- \[[xX]\][ \t]+/;
const RESULT_LINE = /^RESULT\(/;

/**
 * Parse the <validation-steps> block out of a task description.
 *
 * @param description the (effective) task description text
 * @returns counts of checked/unchecked items and indices missing a RESULT line
 */
export function parseValidationSteps(description: string): ValidationStepsReport {
  let inside = false;
  let unchecked = 0;
  let checked = 0;
  let awaiting = false;
  let idx = 0;
  const missing: number[] = [];

  const lines = (description ?? "").split("\n");

  for (const rawLine of lines) {
    // Open tag — only outside the block (matches `!inside && ...` in awk).
    if (!inside && OPEN_TAG.test(rawLine.toLowerCase())) {
      inside = true;
      continue;
    }
    // Close tag — only inside the block.
    if (inside && CLOSE_TAG.test(rawLine.toLowerCase())) {
      if (awaiting) {
        missing.push(idx);
        awaiting = false;
      }
      inside = false;
      continue;
    }
    if (!inside) {
      continue;
    }

    // Trim leading whitespace, mirroring `sub(/^[ \t]+/, "", line)`.
    const line = rawLine.replace(/^[ \t]+/, "");

    if (UNCHECKED_ITEM.test(line)) {
      if (awaiting) {
        missing.push(idx);
      }
      idx++;
      unchecked++;
      awaiting = false;
    } else if (CHECKED_ITEM.test(line)) {
      if (awaiting) {
        missing.push(idx);
      }
      idx++;
      checked++;
      awaiting = true;
    } else if (RESULT_LINE.test(line)) {
      awaiting = false;
    }
  }

  // EOF while still inside an unclosed block, or after the block — mirror the
  // awk END rule that flushes a trailing `awaiting`.
  if (awaiting) {
    missing.push(idx);
  }

  return { unchecked, checked, missingResult: missing };
}
