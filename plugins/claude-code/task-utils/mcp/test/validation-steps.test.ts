/**
 * Unit tests for the <validation-steps> parser. These fixtures mirror the
 * cases the awk parser in `hooks/task-invariant.sh` handles — the two parsers
 * MUST agree.
 */

import { describe, expect, test } from "bun:test";

import { parseValidationSteps } from "../src/validation-steps.js";

describe("parseValidationSteps", () => {
  test("no block -> all zero", () => {
    const r = parseValidationSteps("just a plain description, no block");
    expect(r).toEqual({ unchecked: 0, checked: 0, missingResult: [] });
  });

  test("empty description -> all zero", () => {
    expect(parseValidationSteps("")).toEqual({
      unchecked: 0,
      checked: 0,
      missingResult: [],
    });
  });

  test("one unchecked item", () => {
    const desc = "<validation-steps>\n - [ ] do a thing\n</validation-steps>";
    const r = parseValidationSteps(desc);
    expect(r.unchecked).toBe(1);
    expect(r.checked).toBe(0);
    expect(r.missingResult).toEqual([]);
  });

  test("checked item with RESULT line -> no missing", () => {
    const desc = [
      "<validation-steps>",
      " - [x] did the thing",
      "       RESULT(2026-05-21 04:00Z, by test): evidence here",
      "</validation-steps>",
    ].join("\n");
    const r = parseValidationSteps(desc);
    expect(r.checked).toBe(1);
    expect(r.unchecked).toBe(0);
    expect(r.missingResult).toEqual([]);
  });

  test("checked item missing RESULT line -> flagged", () => {
    const desc = [
      "<validation-steps>",
      " - [x] did the thing",
      " - [ ] another thing",
      "</validation-steps>",
    ].join("\n");
    const r = parseValidationSteps(desc);
    expect(r.checked).toBe(1);
    expect(r.unchecked).toBe(1);
    // item 1 (the [x]) is missing its RESULT line
    expect(r.missingResult).toEqual([1]);
  });

  test("checked item at end of block missing RESULT -> flagged via close tag", () => {
    const desc = [
      "<validation-steps>",
      " - [ ] one",
      " - [x] two",
      "</validation-steps>",
    ].join("\n");
    const r = parseValidationSteps(desc);
    expect(r.missingResult).toEqual([2]);
  });

  test("uppercase [X] is a checked item", () => {
    const desc = [
      "<validation-steps>",
      " - [X] capital X",
      "       RESULT(2026-05-21 04:00Z): ok",
      "</validation-steps>",
    ].join("\n");
    const r = parseValidationSteps(desc);
    expect(r.checked).toBe(1);
    expect(r.missingResult).toEqual([]);
  });

  test("case-insensitive open/close tags", () => {
    const desc = [
      "<VALIDATION-STEPS>",
      " - [ ] step",
      "</VALIDATION-STEPS>",
    ].join("\n");
    expect(parseValidationSteps(desc).unchecked).toBe(1);
  });

  test("tag text inside RESULT prose does not toggle block", () => {
    const desc = [
      "<validation-steps>",
      " - [x] mentions <validation-steps> in prose below",
      "       RESULT(2026-05-21 04:00Z): the string </validation-steps> is harmless",
      " - [ ] still inside the block",
      "</validation-steps>",
    ].join("\n");
    const r = parseValidationSteps(desc);
    expect(r.checked).toBe(1);
    expect(r.unchecked).toBe(1);
    expect(r.missingResult).toEqual([]);
  });

  test("indented tags are recognized", () => {
    const desc = [
      "   <validation-steps>   ",
      "    - [ ] indented item",
      "   </validation-steps>   ",
    ].join("\n");
    expect(parseValidationSteps(desc).unchecked).toBe(1);
  });

  test("multiple checked items, middle one missing RESULT", () => {
    const desc = [
      "<validation-steps>",
      " - [x] one",
      "       RESULT(t): ok",
      " - [x] two",
      " - [x] three",
      "       RESULT(t): ok",
      "</validation-steps>",
    ].join("\n");
    const r = parseValidationSteps(desc);
    expect(r.checked).toBe(3);
    // item 2 has no RESULT before item 3 starts
    expect(r.missingResult).toEqual([2]);
  });

  test("content outside the block is ignored", () => {
    const desc = [
      "- [ ] this is outside and should not count",
      "<validation-steps>",
      " - [ ] inside",
      "</validation-steps>",
      "- [ ] also outside",
    ].join("\n");
    expect(parseValidationSteps(desc).unchecked).toBe(1);
  });
});
