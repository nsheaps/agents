import { describe, expect, test } from "bun:test";
import {
  CHECK_INTERVAL_MS,
  checkForUpdates,
  compareVersions,
  type FetchLike,
  type UpdateState,
} from "./updates";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Fake network: records URLs, answers from a table keyed by URL substring. */
function fakeFetch(table: Record<string, unknown>) {
  const calls: string[] = [];
  const f: FetchLike = async (url) => {
    calls.push(url);
    for (const [k, v] of Object.entries(table)) {
      if (url.includes(k)) return v instanceof Response ? v : json(v);
    }
    return json({}, 404);
  };
  return { f, calls };
}

const RELEASES = [
  { tag_name: "agents-v9.9.9", draft: false, prerelease: false },
  { tag_name: "claude-rc-v1.4.0", draft: false, prerelease: false },
  { tag_name: "claude-rc-v1.5.0-rc.1", draft: false, prerelease: true },
  { tag_name: "claude-rc-v1.3.0", draft: false, prerelease: false },
  { tag_name: "claude-rc-v2.0.0", draft: true, prerelease: false },
];
const NET = { "api.github.com": RELEASES, "registry.npmjs.org": { version: "2.5.0" } };
const ON = { claudeRc: true, claude: true };
const NOW = 1_000_000_000_000;

describe("compareVersions", () => {
  test.each([
    ["1.2.3", "1.2.3", 0],
    ["1.2.4", "1.2.3", 1],
    ["1.10.0", "1.9.0", 1],
    ["2.0.0", "10.0.0", -1],
    ["v1.0.1", "1.0.0", 1],
    ["1.0.0", "1.0.0-rc.1", 1],
    ["1.0.0-dev", "1.0.0", -1],
    ["0.0.0-dev", "0.0.1", -1],
  ])("%s vs %s -> %d", (a, b, want) => {
    expect(Math.sign(compareVersions(a, b))).toBe(want);
  });
});

describe("checkForUpdates", () => {
  test("reports newer claude-rc and claude, ignoring other tags, drafts and prereleases", async () => {
    const { f } = fakeFetch(NET);
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.3.0", claude: "2.4.0" },
      enabled: ON,
      state: {},
    });
    expect(r.notices.map((n) => n.title)).toEqual([
      "claude-rc 1.4.0 available",
      "Claude Code 2.5.0 available",
    ]);
    expect(r.notices[0]!.body).toContain("brew upgrade claude-rc");
    expect(r.state.latest).toEqual({ claudeRc: "1.4.0", claude: "2.5.0" });
    expect(r.state.lastCheck).toBe(NOW);
  });

  test("no notice when already current or ahead", async () => {
    const { f } = fakeFetch(NET);
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.4.0", claude: "2.6.0" },
      enabled: ON,
      state: {},
    });
    expect(r.notices).toEqual([]);
  });

  test("checks at most once per day", async () => {
    const { f, calls } = fakeFetch(NET);
    const state: UpdateState = { lastCheck: NOW - CHECK_INTERVAL_MS + 1000 };
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.0.0", claude: "1.0.0" },
      enabled: ON,
      state,
    });
    expect(r.checked).toBe(false);
    expect(calls).toEqual([]);
    expect(r.state).toEqual(state);
  });

  test("checks again once a day has passed", async () => {
    const { f, calls } = fakeFetch(NET);
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.0.0", claude: "1.0.0" },
      enabled: ON,
      state: { lastCheck: NOW - CHECK_INTERVAL_MS },
    });
    expect(r.checked).toBe(true);
    expect(calls.length).toBe(2);
  });

  test("notifies once per new version, again when a newer one appears", async () => {
    const { f } = fakeFetch(NET);
    const args = {
      fetch: f,
      versions: { claudeRc: "1.0.0", claude: "2.5.0" },
      enabled: ON,
    };
    const first = await checkForUpdates({ ...args, now: NOW, state: {} });
    expect(first.notices.length).toBe(1);
    const second = await checkForUpdates({
      ...args,
      now: NOW + CHECK_INTERVAL_MS,
      state: first.state,
    });
    expect(second.notices).toEqual([]);
    const { f: f2 } = fakeFetch({
      ...NET,
      "api.github.com": [{ tag_name: "claude-rc-v1.6.0", draft: false, prerelease: false }],
    });
    const third = await checkForUpdates({
      ...args,
      fetch: f2,
      now: NOW + 2 * CHECK_INTERVAL_MS,
      state: second.state,
    });
    expect(third.notices.map((n) => n.title)).toEqual(["claude-rc 1.6.0 available"]);
  });

  test("honours the per-source switches and skips their network calls", async () => {
    const { f, calls } = fakeFetch(NET);
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.0.0", claude: "1.0.0" },
      enabled: { claudeRc: false, claude: true },
      state: {},
    });
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("registry.npmjs.org");
    expect(r.notices.map((n) => n.title)).toEqual(["Claude Code 2.5.0 available"]);
  });

  test("both off -> no network and not counted as a check", async () => {
    const { f, calls } = fakeFetch(NET);
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.0.0", claude: "1.0.0" },
      enabled: { claudeRc: false, claude: false },
      state: {},
    });
    expect(calls).toEqual([]);
    expect(r.checked).toBe(false);
  });

  test("a failing source does not block the other and never throws", async () => {
    const { f } = fakeFetch({ ...NET, "api.github.com": json({}, 500) });
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.0.0", claude: "2.4.0" },
      enabled: ON,
      state: {},
    });
    expect(r.notices.map((n) => n.title)).toEqual(["Claude Code 2.5.0 available"]);
    expect(r.errors[0]).toContain("claude-rc");
  });

  test("a throwing fetch is reported, not thrown, and lastCheck is not advanced", async () => {
    const r = await checkForUpdates({
      fetch: async () => {
        throw new Error("offline");
      },
      now: NOW,
      versions: { claudeRc: "1.0.0", claude: "1.0.0" },
      enabled: ON,
      state: {},
    });
    expect(r.notices).toEqual([]);
    expect(r.errors.length).toBe(2);
    expect(r.state.lastCheck).toBeUndefined();
  });

  test("an unknown installed claude version (not found) skips the claude check", async () => {
    const { f, calls } = fakeFetch(NET);
    const r = await checkForUpdates({
      fetch: f,
      now: NOW,
      versions: { claudeRc: "1.4.0", claude: undefined },
      enabled: ON,
      state: {},
    });
    expect(calls.some((c) => c.includes("npmjs"))).toBe(false);
    expect(r.notices).toEqual([]);
  });
});
