#!/usr/bin/env bun
/**
 * pr-status — emoji-bucketed PR status via batched GraphQL.
 *
 * Usage:
 *   pr-status <ref> [<ref> ...]
 *   pr-status digest [--org <name>...] [--author <user>...] [--since <dur|iso>]
 *                    [--state open|closed|merged|all] [--by created|updated]
 *                    [--limit N] [--refs-only] [--all-open|--no-all-open]
 *
 * Ref forms (ref mode):
 *   https://github.com/<owner>/<repo>/pull/<n>
 *   <owner>/<repo>#<n>
 *   @<path>            (read refs from file; one per line; '#' line-comment)
 *
 * Digest mode: discover PRs via GitHub GraphQL `search` (filter by org, author,
 * since-time), then emit the same emoji-bucketed status lines. Pass `--refs-only`
 * to emit `owner/repo#N` refs instead of formatted lines.
 *
 * Output (one line per PR):
 *   <state><ci><review> [[owner/repo#N] title](url)
 *
 * Requires `gh` on PATH and authenticated. Ref mode issues ONE `gh api graphql`
 * call for the whole batch (aliased queries). Digest mode pages the search API
 * up to --limit (default 500), then runs the same batched status query.
 */

import { readFileSync } from "node:fs";

type Ref = { owner: string; repo: string; number: number };

const URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const PATH_RE = /^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/;
const SLUG_RE = /^([^/\s]+)\/([^#\s]+)#(\d+)$/;

function parseRef(s: string): Ref | null {
  const u = URL_RE.exec(s);
  if (u) return { owner: u[1], repo: u[2], number: Number(u[3]) };
  const p = PATH_RE.exec(s);
  if (p) return { owner: p[1], repo: p[2], number: Number(p[3]) };
  const m = SLUG_RE.exec(s);
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  return null;
}

function readRefsFile(path: string): Ref[] {
  const out: Ref[] = [];
  const lines = readFileSync(path, "utf8").split("\n");
  for (const raw of lines) {
    // Strip line-comments (`#` at start of line or preceded by whitespace),
    // but NOT the `#N` PR-number suffix in `owner/repo#N`.
    const line = raw.replace(/(?:^|\s)#.*$/, "").trim();
    if (!line) continue;
    const r = parseRef(line);
    if (!r) {
      console.error(`skip unparseable ref in ${path}: ${line}`);
      continue;
    }
    out.push(r);
  }
  return out;
}

function collectRefs(args: string[]): Ref[] {
  const refs: Ref[] = [];
  for (const a of args) {
    if (a.startsWith("@")) {
      refs.push(...readRefsFile(a.slice(1)));
    } else {
      const r = parseRef(a);
      if (!r) {
        console.error(`skip unparseable ref: ${a}`);
        continue;
      }
      refs.push(r);
    }
  }
  return refs;
}

const PR_FRAGMENT = `
  number
  title
  url
  isDraft
  state
  merged
  mergeable
  mergeStateStatus
  reviewDecision
  baseRepository { nameWithOwner }
  author {
    __typename
    login
    ... on User { url }
    ... on Bot { url }
    ... on Organization { url }
    ... on Mannequin { url }
    ... on EnterpriseUserAccount { user { login url } }
  }
  reviews(last: 50) {
    nodes {
      state
      authorAssociation
      author { login }
    }
  }
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          state
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun {
                name
                status
                conclusion
                isRequired(pullRequestNumber: $__PR_NUM__)
              }
              ... on StatusContext {
                context
                state
                isRequired(pullRequestNumber: $__PR_NUM__)
              }
            }
          }
        }
      }
    }
  }
`;

function buildQuery(refs: Ref[]): string {
  const parts: string[] = [];
  refs.forEach((r, i) => {
    const frag = PR_FRAGMENT.replace(/\$__PR_NUM__/g, String(r.number));
    parts.push(
      `pr${i}: repository(owner: ${JSON.stringify(r.owner)}, name: ${JSON.stringify(r.repo)}) {
        pullRequest(number: ${r.number}) { ${frag} }
      }`,
    );
  });
  return `query { ${parts.join("\n")} }`;
}

async function ghGraphql(query: string): Promise<any> {
  const proc = Bun.spawn(["gh", "api", "graphql", "-f", `query=${query}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`gh api graphql exited ${code}: ${err}`);
  }
  return JSON.parse(out);
}

type StateEmoji = "🔵" | "🟠" | "🟢" | "🟣" | "❌";
type CiEmoji = "⛔️" | "🟠" | "🔵" | "🔴" | "❌" | "🟢" | "✅";
type ReviewEmoji = "🔵" | "❌" | "🟠" | "🟢" | "✅" | "💬";

function stateEmoji(pr: any): StateEmoji {
  if (pr.merged) return "🟣";
  if (pr.state === "CLOSED") return "❌";
  if (pr.isDraft) return "🔵";
  if (pr.mergeable === "CONFLICTING") return "🟠";
  return "🟢";
}

type Ctx = { required: boolean; pending: boolean; failed: boolean; passed: boolean };

function classifyContexts(pr: any): Ctx[] {
  const nodes = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];
  return nodes.map((n: any) => {
    if (n.__typename === "CheckRun") {
      const status = n.status; // QUEUED / IN_PROGRESS / COMPLETED / PENDING / WAITING
      const conclusion = n.conclusion; // SUCCESS / FAILURE / NEUTRAL / CANCELLED / TIMED_OUT / ACTION_REQUIRED / STALE / SKIPPED
      const pending = status !== "COMPLETED";
      const passed = !pending && (conclusion === "SUCCESS" || conclusion === "NEUTRAL" || conclusion === "SKIPPED");
      const failed = !pending && !passed;
      return { required: !!n.isRequired, pending, passed, failed };
    } else {
      // StatusContext: state = EXPECTED / ERROR / FAILURE / PENDING / SUCCESS
      const st = n.state;
      const pending = st === "PENDING" || st === "EXPECTED";
      const passed = st === "SUCCESS";
      const failed = st === "FAILURE" || st === "ERROR";
      return { required: !!n.isRequired, pending, passed, failed };
    }
  });
}

function ciEmoji(pr: any): CiEmoji {
  if (pr.mergeable === "CONFLICTING" && pr.state === "OPEN") return "⛔️";
  const ctxs = classifyContexts(pr);
  if (ctxs.length === 0) return "🟢"; // no checks → trivially green
  const anyRunning = ctxs.some((c) => c.pending);
  const anyFailed = ctxs.some((c) => c.failed);
  const hasRequired = ctxs.some((c) => c.required);
  const requiredRunning = ctxs.some((c) => c.required && c.pending);
  const requiredFailed = ctxs.some((c) => c.required && c.failed);

  if (requiredRunning && anyFailed) return "🟠";
  if (anyRunning) return "🔵";
  // all complete
  if (!anyFailed) return hasRequired ? "✅" : "🟢";
  // anyFailed && all complete
  if (hasRequired && !requiredFailed) return "🔴";
  return "❌";
}

function reviewEmoji(pr: any): ReviewEmoji {
  const reviews = pr.reviews?.nodes ?? [];
  if (reviews.length === 0) return "🔵";
  const anyRejected = reviews.some((r: any) => r.state === "CHANGES_REQUESTED");
  if (anyRejected) return "❌";
  const anyApproved = reviews.some((r: any) => r.state === "APPROVED");
  const decision = pr.reviewDecision; // APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED / null
  if (decision === "APPROVED") {
    // Codeowner-equivalent: GH only sets APPROVED when all required reviewers (incl. CODEOWNERS) are satisfied.
    return "✅";
  }
  if (anyApproved) {
    // Approved by someone but reviewDecision still REVIEW_REQUIRED → criteria not met
    if (decision === "REVIEW_REQUIRED") return "🟠";
    return "🟢"; // approved + no further requirement
  }
  // No approvals, no rejections
  const anyCommented = reviews.some((r: any) => r.state === "COMMENTED");
  if (anyCommented) return "💬";
  return "🔵";
}

// Hover-tooltip titles for each emoji (plain English). Rendered via the
// markdown link-title trick: `[emoji](# "title")` — works on github.com.
const STATE_TITLES: Record<StateEmoji, string> = {
  "🔵": "draft PR",
  "🟠": "open with merge conflicts",
  "🟢": "open",
  "🟣": "merged",
  "❌": "closed without merge",
};
const CI_TITLES: Record<CiEmoji, string> = {
  "⛔️": "CI ignored (merge conflict — needs another run)",
  "🟠": "required check still running, other checks failed",
  "🔵": "some checks still running",
  "🔴": "required passed, other checks failed (all complete)",
  "❌": "all checks finished, some failed",
  "🟢": "all checks passed (no required checks)",
  "✅": "all checks passed (including required)",
};
const REVIEW_TITLES: Record<ReviewEmoji, string> = {
  "🔵": "no reviews yet",
  "❌": "changes requested",
  "🟠": "approved but criteria still not met",
  "🟢": "approved, ready to merge",
  "✅": "approved by codeowner, ready to merge",
  "💬": "commented (no approvals or rejections)",
};

function tip(emoji: string, title: string): string {
  // Escape double quotes inside the title to keep markdown valid.
  const t = title.replace(/"/g, '\\"');
  return `[${emoji}](# "${t}")`;
}

function authorLink(pr: any): string {
  const a = pr.author;
  if (!a) return "";
  const login: string = a.login ?? "(unknown)";
  // GraphQL .url on User/Bot/Organization is the canonical profile URL
  // (e.g. https://github.com/apps/renovate for Bot, https://github.com/<login>
  // for User). EnterpriseUserAccount nests user.url.
  const url: string = a.url ?? a.user?.url ?? `https://github.com/${login}`;
  return ` by [@${login}](${url})`;
}

function formatLine(ref: Ref, pr: any): string {
  const slug = pr.baseRepository?.nameWithOwner ?? `${ref.owner}/${ref.repo}`;
  const title = pr.title ?? "(no title)";
  const url = pr.url ?? `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
  const s = stateEmoji(pr);
  const c = ciEmoji(pr);
  const r = reviewEmoji(pr);
  const emojis = `${tip(s, STATE_TITLES[s])}${tip(c, CI_TITLES[c])}${tip(r, REVIEW_TITLES[r])}`;
  const author = authorLink(pr);
  const body = `${emojis} [[${slug}#${pr.number}] ${title}](${url})${author}`;
  // Strikethrough merged 🟣 OR closed-no-merge ❌ — both terminal states.
  if (s === "🟣" || s === "❌") return `~~${body}~~`;
  return body;
}

/**
 * Per-repo sort key for digest mode.
 *
 * Bucket order:
 *   0 open  — sub-sorted by mergeability: CLEAN(0) > UNSTABLE(1) > BEHIND(2) > anything-else(3)
 *   1 merged 🟣 — descending PR number
 *   2 closed-no-merge ❌ — descending PR number
 *
 * Returns [repoBucket, mergeabilityRank, -prNumber] for lexicographic comparison.
 */
function digestSortKey(pr: any): [number, number, number, number] {
  const s = stateEmoji(pr);
  // Bucket 0 = open, 1 = merged, 2 = closed-no-merge
  const repoBucket = s === "🟣" ? 1 : s === "❌" ? 2 : 0;
  // Mergeability rank (lower = more mergeable); only relevant for open PRs
  const mss: string = pr.mergeStateStatus ?? "";
  const mergeRank =
    mss === "CLEAN" ? 0 : mss === "UNSTABLE" ? 1 : mss === "BEHIND" ? 2 : 3;
  return [repoBucket, mergeRank, -pr.number, 0];
}

// ---- digest subcommand: discover refs via GraphQL search ----

type DigestArgs = {
  orgs: string[];
  authors: string[];
  repos: string[]; // owner/repo slugs
  since: string;
  state: "open" | "closed" | "merged" | "all";
  by: "created" | "updated";
  limit: number;
  refsOnly: boolean;
  /** When true (default), open PRs are shown regardless of --since; --since only
   *  filters the closed/merged bucket.  Pass --no-all-open to restore the old
   *  behaviour where --since trims every bucket uniformly. */
  allOpen: boolean;
};

function parseDigestArgs(argv: string[]): DigestArgs {
  const a: DigestArgs = {
    orgs: [],
    authors: [],
    repos: [],
    since: "12hr",
    state: "all",
    by: "updated",
    limit: 500,
    refsOnly: false,
    allOpen: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const take = (): string => {
      const eq = v.indexOf("=");
      if (eq >= 0) return v.slice(eq + 1);
      return argv[++i];
    };
    if (v === "--org" || v.startsWith("--org=")) a.orgs.push(take());
    else if (
      v === "--author" ||
      v.startsWith("--author=") ||
      v === "--user" ||
      v.startsWith("--user=")
    )
      a.authors.push(take());
    else if (v === "--repo" || v.startsWith("--repo=")) a.repos.push(take());
    else if (v === "--since" || v.startsWith("--since=")) a.since = take();
    else if (v === "--state" || v.startsWith("--state=")) a.state = take() as DigestArgs["state"];
    else if (v === "--by" || v.startsWith("--by=")) a.by = take() as DigestArgs["by"];
    else if (v === "--limit" || v.startsWith("--limit=")) a.limit = Number(take());
    else if (v === "--refs-only") a.refsOnly = true;
    else if (v === "--all-open") a.allOpen = true;
    else if (v === "--no-all-open") a.allOpen = false;
    else if (v === "-h" || v === "--help") {
      console.error(
        "usage: pr-status digest [--org N...] [--author U...] [--repo OWNER/REPO...]\n" +
          "                       [--since DUR|ISO] [--state open|closed|merged|all]\n" +
          "                       [--by created|updated] [--limit N] [--refs-only]\n" +
          "                       [--all-open|--no-all-open]",
      );
      process.exit(0);
    } else {
      console.error(`unknown digest arg: ${v}`);
      process.exit(2);
    }
  }
  return a;
}

function sinceToISO(since: string): string | null {
  if (since === "all") return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(since)) return since;
  const m = /^(\d+)(m|hr|h|d|w)$/.exec(since);
  if (!m) {
    console.error(`bad --since: ${since}`);
    process.exit(2);
  }
  const n = Number(m[1]);
  const u = m[2];
  const sec =
    u === "m" ? n * 60 : u === "h" || u === "hr" ? n * 3600 : u === "d" ? n * 86400 : n * 604800;
  return new Date(Date.now() - sec * 1000).toISOString().replace(/\.\d+Z$/, "Z");
}

function buildSearchQ(
  a: DigestArgs,
  opts?: { stateOverride?: DigestArgs["state"]; skipSince?: boolean },
): string {
  const state = opts?.stateOverride ?? a.state;
  const parts: string[] = ["is:pr"];
  for (const o of a.orgs) parts.push(`org:${o}`);
  for (const u of a.authors) parts.push(`author:${u}`);
  for (const r of a.repos) parts.push(`repo:${r}`);
  if (state !== "all") parts.push(`is:${state}`);
  if (!opts?.skipSince) {
    const iso = sinceToISO(a.since);
    if (iso) parts.push(`${a.by}:>=${iso}`);
  }
  return parts.join(" ");
}

const SEARCH_GQL = `
query($q: String!, $first: Int!, $after: String) {
  search(query: $q, type: ISSUE, first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        baseRepository { nameWithOwner }
      }
    }
  }
}
`;

async function ghGraphqlVars(query: string, vars: Record<string, unknown>): Promise<any> {
  const argv = ["gh", "api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(vars)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number") argv.push("-F", `${k}=${v}`);
    else argv.push("-f", `${k}=${v}`);
  }
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`gh api graphql exited ${code}: ${err}`);
  return JSON.parse(out);
}

/** Page through a single GitHub search query, appending into `refs`/`seen` up to `limit`. */
async function collectSearchRefs(
  q: string,
  refs: Ref[],
  seen: Set<string>,
  limit: number,
): Promise<void> {
  const pageSize = 100;
  let after: string | null = null;
  while (refs.length < limit) {
    const first = Math.min(pageSize, limit - refs.length);
    const resp = await ghGraphqlVars(SEARCH_GQL, { q, first, after });
    if (resp.errors) {
      console.error("search GraphQL errors:");
      console.error(JSON.stringify(resp.errors, null, 2));
    }
    const search = resp.data?.search;
    const nodes: any[] = search?.nodes ?? [];
    for (const n of nodes) {
      if (!n?.baseRepository?.nameWithOwner || typeof n.number !== "number") continue;
      const slug = n.baseRepository.nameWithOwner as string;
      const key = `${slug}#${n.number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [owner, repo] = slug.split("/");
      refs.push({ owner, repo, number: n.number });
      if (refs.length >= limit) break;
    }
    const page = search?.pageInfo;
    if (!page?.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }
}

async function discoverRefs(a: DigestArgs): Promise<Ref[]> {
  // When --all-open (default true): open PRs are returned regardless of --since;
  // only the closed/merged bucket respects the time filter.  This requires two
  // separate search queries when state=all and a time-bounded --since is active.
  const hasSince = sinceToISO(a.since) !== null;
  const needsSplit = a.allOpen && a.state === "all" && hasSince;

  const refs: Ref[] = [];
  const seen = new Set<string>();

  if (needsSplit) {
    // 1. Open PRs — no since filter (always show all open PRs).
    const openQ = buildSearchQ(a, { stateOverride: "open", skipSince: true });
    // 2. Closed PRs (merged + unmerged-closed) — since filter applies.
    const closedQ = buildSearchQ(a, { stateOverride: "closed" });
    console.error(`digest queries (--all-open): open=${openQ}  closed=${closedQ}`);
    await collectSearchRefs(openQ, refs, seen, a.limit);
    await collectSearchRefs(closedQ, refs, seen, a.limit);
  } else {
    const q = buildSearchQ(a);
    console.error(`digest query: ${q}`);
    await collectSearchRefs(q, refs, seen, a.limit);
  }

  console.error(`discovered ${refs.length} ref(s)`);
  return refs;
}

// ---- main ----

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error(
      "usage:\n" +
        "  pr-status <ref> [<ref> ...]            (ref = URL | owner/repo#N | @file)\n" +
        "  pr-status digest [--org ...] [--author ...] [--since ...] [--refs-only]",
    );
    process.exit(2);
  }

  let refs: Ref[];
  let refsOnly = false;
  let sortDigest = false;

  if (argv[0] === "digest") {
    const dargs = parseDigestArgs(argv.slice(1));
    if (dargs.orgs.length === 0 && dargs.authors.length === 0 && dargs.repos.length === 0) {
      console.error("digest: at least one of --org, --author, or --repo is required");
      process.exit(2);
    }
    refs = await discoverRefs(dargs);
    refsOnly = dargs.refsOnly;
    sortDigest = true;
  } else {
    refs = collectRefs(argv);
  }

  if (refs.length === 0) {
    console.error("no refs to query");
    process.exit(refsOnly ? 0 : 2);
  }

  if (refsOnly) {
    for (const r of refs) console.log(`${r.owner}/${r.repo}#${r.number}`);
    return;
  }

  // Query in chunks so a single 502/size-limit failure doesn't abort the
  // whole digest. Exit 0 if ≥1 chunk succeeded; exit 1 only if ALL failed.
  const BATCH_SIZE = 25;
  let anySuccess = false;
  let failCount = 0;

  // In digest mode: collect (slug, sortKey, line) so we can sort per-repo before
  // emitting.  In ref mode: print immediately (preserve caller-specified order).
  type CollectedLine = { slug: string; sortKey: [number, number, number, number]; line: string };
  const collected: CollectedLine[] = [];

  for (let start = 0; start < refs.length; start += BATCH_SIZE) {
    const chunk = refs.slice(start, start + BATCH_SIZE);
    const query = buildQuery(chunk);
    let data: any;
    try {
      data = await ghGraphql(query);
    } catch (e) {
      console.error(`warn: chunk [${start}–${start + chunk.length - 1}] failed: ${e}`);
      failCount++;
      continue;
    }
    if (data.errors) {
      console.error(`warn: chunk [${start}–${start + chunk.length - 1}] had GraphQL errors:`);
      console.error(JSON.stringify(data.errors, null, 2));
      failCount++;
      continue;
    }
    anySuccess = true;
    chunk.forEach((ref, i) => {
      const slot = data.data?.[`pr${i}`];
      const pr = slot?.pullRequest;
      if (!pr) {
        const line = `⚠️⚠️⚠️ [[${ref.owner}/${ref.repo}#${ref.number}] (not found)](https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number})`;
        if (sortDigest) {
          const slug = `${ref.owner}/${ref.repo}`;
          collected.push({ slug, sortKey: [4, 0, -ref.number, 0], line });
        } else {
          console.log(line);
        }
        return;
      }
      const line = formatLine(ref, pr);
      if (sortDigest) {
        const slug = pr.baseRepository?.nameWithOwner ?? `${ref.owner}/${ref.repo}`;
        collected.push({ slug, sortKey: digestSortKey(pr), line });
      } else {
        console.log(line);
      }
    });
  }

  // Digest mode: sort per-repo (open by mergeability → merged → closed) then emit.
  if (sortDigest && collected.length > 0) {
    collected.sort((a, b) => {
      if (a.slug < b.slug) return -1;
      if (a.slug > b.slug) return 1;
      for (let k = 0; k < a.sortKey.length; k++) {
        if (a.sortKey[k] !== b.sortKey[k]) return a.sortKey[k] - b.sortKey[k];
      }
      return 0;
    });
    for (const { line } of collected) console.log(line);
  }

  if (!anySuccess && failCount > 0) {
    process.exit(1);
  }
  // partial failures: exit 0 — warnings already emitted to stderr
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
