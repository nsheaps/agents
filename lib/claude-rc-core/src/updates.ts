import type { Notice } from "./notify";

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const PER_PAGE = 50;
const MAX_PAGES = 5; // newest first, so the latest claude-rc is on the first page that has one
const releasesUrl = (page: number) =>
  `https://api.github.com/repos/nsheaps/agents/releases?per_page=${PER_PAGE}&page=${page}`;
const NPM_URL = "https://registry.npmjs.org/@anthropic-ai/claude-code/latest";
const TAG_PREFIX = "claude-rc-v";

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

export interface UpdateState {
  /** Epoch ms of the last check that reached at least one source. */
  lastCheck?: number;
  /** Latest versions seen, for display in status and the web UI. */
  latest?: { claudeRc?: string; claude?: string };
  /** Versions we already notified about, so each is announced once. */
  notified?: { claudeRc?: string; claude?: string };
}

export interface UpdateCheckInput {
  fetch: FetchLike;
  now: number;
  versions: { claudeRc: string | undefined; claude: string | undefined };
  enabled: { claudeRc: boolean; claude: boolean };
  state: UpdateState;
}

export interface UpdateCheckResult {
  checked: boolean;
  notices: Notice[];
  errors: string[];
  state: UpdateState;
}

interface Parsed {
  core: number[];
  pre: string;
}

function parse(v: string): Parsed {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v.trim());
  if (!m) return { core: [0, 0, 0], pre: "" };
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? "" };
}

/** Semver-ish comparison: numeric core, then a release outranks any prerelease of the same core. */
export function compareVersions(a: string, b: string): number {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = x.core[i]! - y.core[i]!;
    if (d !== 0) return d;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Pull `2.4.0` out of `claude --version` output such as `2.4.0 (Claude Code)`. */
export function parseClaudeVersion(output: string): string | undefined {
  return /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/.exec(output)?.[0];
}

async function getJson(fetch: FetchLike, url: string, what: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "claude-rc" },
  });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res.json();
}

async function latestClaudeRc(fetch: FetchLike): Promise<string | undefined> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await getJson(fetch, releasesUrl(page), "claude-rc releases");
    if (!Array.isArray(list)) throw new Error("claude-rc releases: unexpected response");
    let best: string | undefined;
    for (const r of list as Array<{ tag_name?: string; draft?: boolean; prerelease?: boolean }>) {
      if (!r.tag_name?.startsWith(TAG_PREFIX) || r.draft || r.prerelease) continue;
      const v = r.tag_name.slice(TAG_PREFIX.length);
      if (!best || compareVersions(v, best) > 0) best = v;
    }
    if (best || list.length < PER_PAGE) return best;
  }
  return undefined;
}

async function latestClaude(fetch: FetchLike): Promise<string | undefined> {
  const body = (await getJson(fetch, NPM_URL, "Claude Code (npm)")) as { version?: string };
  return typeof body.version === "string" ? body.version : undefined;
}

/**
 * Once-a-day check for newer claude-rc and Claude Code releases. Pure apart from the injected
 * fetch: the caller persists `state` and delivers `notices`. Never throws.
 */
export async function checkForUpdates(input: UpdateCheckInput): Promise<UpdateCheckResult> {
  const { fetch, now, versions, enabled } = input;
  const want = {
    claudeRc: enabled.claudeRc && !!versions.claudeRc,
    claude: enabled.claude && !!versions.claude,
  };
  const due =
    input.state.lastCheck === undefined || now - input.state.lastCheck >= CHECK_INTERVAL_MS;
  if (!due || (!want.claudeRc && !want.claude)) {
    return { checked: false, notices: [], errors: [], state: input.state };
  }

  const errors: string[] = [];
  const notices: Notice[] = [];
  const latest = { ...input.state.latest };
  const notified = { ...input.state.notified };
  let reached = false;

  if (want.claudeRc) {
    try {
      const v = await latestClaudeRc(fetch);
      reached = true;
      if (v) {
        latest.claudeRc = v;
        if (compareVersions(v, versions.claudeRc!) > 0 && notified.claudeRc !== v) {
          notified.claudeRc = v;
          notices.push({
            title: `claude-rc ${v} available`,
            body: `You have ${versions.claudeRc}. Run: brew upgrade claude-rc`,
          });
        }
      }
    } catch (e) {
      errors.push(`claude-rc: ${(e as Error).message}`);
    }
  }

  if (want.claude) {
    try {
      const v = await latestClaude(fetch);
      reached = true;
      if (v) {
        latest.claude = v;
        if (compareVersions(v, versions.claude!) > 0 && notified.claude !== v) {
          notified.claude = v;
          notices.push({
            title: `Claude Code ${v} available`,
            body: `You have ${versions.claude}. The daemon runs "claude upgrade" on its next start.`,
          });
        }
      }
    } catch (e) {
      errors.push(`claude: ${(e as Error).message}`);
    }
  }

  if (!reached) return { checked: true, notices, errors, state: input.state };
  return { checked: true, notices, errors, state: { lastCheck: now, latest, notified } };
}
