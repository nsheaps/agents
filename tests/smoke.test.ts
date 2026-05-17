import { describe, expect, test } from "bun:test";

describe("repo smoke test", () => {
  test("test runner finds at least one test", () => {
    expect(true).toBe(true);
  });
});
