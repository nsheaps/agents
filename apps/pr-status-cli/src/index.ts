#!/usr/bin/env bun
/**
 * pr-status — emoji-bucketed PR status via batched GraphQL.
 *
 * Usage:
 *   pr-status <ref> [<ref> ...]
 *   pr-status digest [--org <name>...] [--author <user>...] [--since <dur|iso>]
 *                    [--state open|closed|merged|all] [--by created|updated]
 *                    [--limit N] [--refs-only]
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

function formatLine(ref: Ref, pr: any): string {
  const slug = pr.baseRepository?.nameWithOwner ?? `${ref.owner}/${ref.repo}`;
  const title = pr.title ?? "(no title)";
  const url = pr.url ?? `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
  const s = stateEmoji(pr);
  const c = ciEmoji(pr);
  const r = reviewEmoji(pr);
  return `${s}${c}${r} [[${slug}#${pr.number}] ${title}](${url})`;
}

// ---- digest subcommand: discover refs via GraphQL search ----

type DigestArgs = {
  orgs: string[];
  authors: string[];
  since: string;
  state: "open" | "closed" | "merged" | "all";
  by: "created" | "updated";
  limit: number;
  refsOnly: boolean;
};

function parseDigestArgs(argv: string[]): DigestArgs {
  const a: DigestArgs = {
    orgs: [],
    authors: [],
    since: "12hr",
    state: "all",
    by: "updated",
    limit: 500,
    refsOnly: false,
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
    else if (v === "--since" || v.startsWith("--since=")) a.since = take();
    else if (v === "--state" || v.startsWith("--state=")) a.state = take() as DigestArgs["state"];
    else if (v === "--by" || v.startsWith("--by=")) a.by = take() as DigestArgs["by"];
    else if (v === "--limit" || v.startsWith("--limit=")) a.limit = Number(take());
    else if (v === "--refs-only") a.refsOnly = true;
    else if (v === "-h" || v === "--help") {
      console.error(
        "usage: pr-status digest [--org N...] [--author U...] [--since DUR|ISO]\n" +
          "                       [--state open|closed|merged|all] [--by created|updated]\n" +
          "                       [--limit N] [--refs-only]",
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

function buildSearchQ(a: DigestArgs): string {
  const parts: string[] = ["is:pr"];
  for (const o of a.orgs) parts.push(`org:${o}`);
  for (const u of a.authors) parts.push(`author:${u}`);
  if (a.state !== "all") parts.push(`is:${a.state}`);
  const iso = sinceToISO(a.since);
  if (iso) parts.push(`${a.by}:>=${iso}`);
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

async function discoverRefs(a: DigestArgs): Promise<Ref[]> {
  const q = buildSearchQ(a);
  console.error(`digest query: ${q}`);
  const refs: Ref[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  const pageSize = 100;
  while (refs.length < a.limit) {
    const first = Math.min(pageSize, a.limit - refs.length);
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
      if (refs.length >= a.limit) break;
    }
    const page = search?.pageInfo;
    if (!page?.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
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

  if (argv[0] === "digest") {
    const dargs = parseDigestArgs(argv.slice(1));
    if (dargs.orgs.length === 0 && dargs.authors.length === 0) {
      console.error("digest: at least one of --org or --author is required");
      process.exit(2);
    }
    refs = await discoverRefs(dargs);
    refsOnly = dargs.refsOnly;
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

  const query = buildQuery(refs);
  const data = await ghGraphql(query);
  if (data.errors) {
    console.error("GraphQL errors:");
    console.error(JSON.stringify(data.errors, null, 2));
  }
  refs.forEach((ref, i) => {
    const slot = data.data?.[`pr${i}`];
    const pr = slot?.pullRequest;
    if (!pr) {
      console.log(
        `⚠️⚠️⚠️ [[${ref.owner}/${ref.repo}#${ref.number}] (not found)](https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number})`,
      );
      return;
    }
    console.log(formatLine(ref, pr));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
