#!/usr/bin/env bun
/**
 * pr-status — emoji-bucketed PR status via batched GraphQL.
 *
 * Usage:
 *   pr-status <ref> [<ref> ...]
 *
 * Ref forms:
 *   https://github.com/<owner>/<repo>/pull/<n>
 *   <owner>/<repo>#<n>
 *   @<path>            (read refs from file; one per line; '#' line-comment)
 *
 * Output (one line per PR, in input order):
 *   <state><ci><review> [[owner/repo#N] title](url)
 *
 * Requires `gh` on PATH and authenticated. Issues ONE `gh api graphql` call
 * for the whole batch (aliased queries).
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: pr-status <ref> [<ref> ...]  (ref = URL | owner/repo#N | @file)");
    process.exit(2);
  }
  const refs = collectRefs(args);
  if (refs.length === 0) {
    console.error("no refs parsed");
    process.exit(2);
  }
  const query = buildQuery(refs);
  const data = await ghGraphql(query);
  if (data.errors) {
    console.error("GraphQL errors:");
    console.error(JSON.stringify(data.errors, null, 2));
    // continue with partial data if present
  }
  refs.forEach((ref, i) => {
    const slot = data.data?.[`pr${i}`];
    const pr = slot?.pullRequest;
    if (!pr) {
      console.log(`⚠️⚠️⚠️ [[${ref.owner}/${ref.repo}#${ref.number}] (not found)](https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number})`);
      return;
    }
    console.log(formatLine(ref, pr));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
