/**
 * Tests for multi-repo bucket-split and query-chunking logic.
 * Run with: bun test src/digest-split.test.ts
 */

import { describe, it, expect } from "bun:test";
import { bucketByRepo, chunkReposForQuery } from "./index.ts";

describe("bucketByRepo", () => {
  it("groups refs by owner/repo slug", () => {
    const refs = [
      { owner: "nsheaps", repo: "agents", number: 1 },
      { owner: "nsheaps", repo: "ai-mktpl", number: 42 },
      { owner: "nsheaps", repo: "agents", number: 7 },
      { owner: "nsheaps", repo: "ai-mktpl", number: 99 },
      { owner: "nsheaps", repo: "op-exec", number: 3 },
    ];

    const bucketed = bucketByRepo(refs);

    expect(bucketed.size).toBe(3);
    expect(bucketed.get("nsheaps/agents")?.map((r) => r.number)).toEqual([1, 7]);
    expect(bucketed.get("nsheaps/ai-mktpl")?.map((r) => r.number)).toEqual([42, 99]);
    expect(bucketed.get("nsheaps/op-exec")?.map((r) => r.number)).toEqual([3]);
  });

  it("returns empty map for empty input", () => {
    expect(bucketByRepo([])).toEqual(new Map());
  });

  it("handles single repo", () => {
    const refs = [
      { owner: "nsheaps", repo: "agents", number: 1 },
      { owner: "nsheaps", repo: "agents", number: 2 },
    ];
    const bucketed = bucketByRepo(refs);
    expect(bucketed.size).toBe(1);
    expect(bucketed.get("nsheaps/agents")?.length).toBe(2);
  });
});

describe("chunkReposForQuery", () => {
  it("returns empty array for empty repos", () => {
    expect(chunkReposForQuery([], "is:pr", 230)).toEqual([]);
  });

  it("returns single chunk when repos fit within limit", () => {
    const repos = ["nsheaps/agents", "nsheaps/ai-mktpl", "nsheaps/op-exec"];
    const chunks = chunkReposForQuery(repos, "is:pr", 230);
    expect(chunks).toEqual([repos]);
  });

  it("splits into multiple chunks when repos exceed limit", () => {
    // Each repo qualifier is " repo:nsheaps/repo-XX" = ~22 chars
    // Base "is:pr" = 5 chars. Limit = 50 chars.
    // 50 - 5 = 45 chars budget for repo: qualifiers.
    // " repo:nsheaps/agents" = 21 chars, " repo:nsheaps/ai-mktpl" = 23 chars → 44 chars total → fits
    // Adding " repo:nsheaps/op-exec" = 22 chars → 66 > 50 → needs new chunk
    const repos = ["nsheaps/agents", "nsheaps/ai-mktpl", "nsheaps/op-exec"];
    const chunks = chunkReposForQuery(repos, "is:pr", 50);
    expect(chunks.length).toBeGreaterThan(1);
    // All repos should appear exactly once across all chunks
    const flat = chunks.flat();
    expect(flat.sort()).toEqual([...repos].sort());
  });

  it("handles single large repo that just fits", () => {
    const repos = ["nsheaps/agents"];
    const chunks = chunkReposForQuery(repos, "is:pr", 30);
    // "is:pr" (5) + " repo:nsheaps/agents" (21) = 26 <= 30
    expect(chunks).toEqual([["nsheaps/agents"]]);
  });

  it("places each repo in its own chunk if each exceeds incremental budget", () => {
    // Very small limit: only room for base + one repo per chunk
    const repos = ["nsheaps/a", "nsheaps/b", "nsheaps/c"];
    const chunks = chunkReposForQuery(repos, "is:pr", 20);
    // Each chunk should have at most repos that fit
    const flat = chunks.flat();
    expect(flat.sort()).toEqual([...repos].sort());
    // All chunks non-empty
    for (const c of chunks) expect(c.length).toBeGreaterThan(0);
  });

  it("preserves order within chunks", () => {
    const repos = ["a/1", "b/2", "c/3", "d/4", "e/5"];
    const chunks = chunkReposForQuery(repos, "is:pr", 230);
    expect(chunks.flat()).toEqual(repos);
  });
});
