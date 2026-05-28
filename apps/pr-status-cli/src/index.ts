#!/usr/bin/env bun
/**
 * pr-status — emoji-bucketed PR status via batched GraphQL.
 *
 * Usage:
 *   pr-status <ref> [<ref> ...]
 *   pr-status digest [--org <name>...] [--author <user>...] [--since <dur|iso>]
 *                    [--state open|closed|merged|all] [--by created|updated]
 *                    [--limit N] [--refs-only] [--all-open|--no-all-open]
 *                    [--out-dir <dir>]  # emit per-repo files instead of stdout
 *   pr-status patch-event [--event-file <path>] [--digest-dir <dir>]
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
 * Patch-event mode: read a GitHub pull_request webhook event (from
 * $GITHUB_EVENT_PATH or --event-file), patch ONLY the matching line in the
 * per-repo digest file, and update the combined all.md — no API calls.
 *
 * --out-dir mode: when set, runs a SINGLE search query across all --repo args,
 * buckets results by repo, and writes one file per repo at
 * <out-dir>/<owner>--<repo>.md. Also writes all lines to stdout (for combined).
 * The query is automatically chunked if the repo list would exceed the GitHub
 * search query length limit (~230 chars for the repo: qualifiers).
 *
 * Output (one line per PR):
 *   <state><ci><review> [[owner/repo#N] title](url)
 *
 * Requires `gh` on PATH and authenticated. Ref mode issues ONE `gh api graphql`
 * call for the whole batch (aliased queries). Digest mode pages the search API
 * up to --limit (default 500), then runs the same batched status query.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
      const passed =
        !pending &&
        (conclusion === "SUCCESS" || conclusion === "NEUTRAL" || conclusion === "SKIPPED");
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
  if (s === "🟣" || s === "❌") return `- ~~${body}~~`;
  return `- ${body}`;
}

/**
 * Per-repo sort key for digest mode.
 *
 * Sort order within each repo (ascending, lower = appears first):
 *   1. stateBucket:  0 open → 1 merged → 2 closed-no-merge
 *   2. mergeRank:    0 CLEAN → 1 UNSTABLE → 2 BEHIND → 3 other (open PRs only)
 *   3. ciRank:       0 ✅/🟢 (pass) → 1 🔵 (running) → 2 🔴 (partial) → 3 🟠 (partial-running) → 4 ❌/⛔️ (fail/blocked)
 *   4. reviewRank:   0 ✅ (codeowner-approved) → 1 🟢 (approved) → 2 🟠 (approved-not-met) → 3 💬 (commented) → 4 🔵 (no reviews) → 5 ❌ (changes-req)
 *   5. -prNumber:    higher PR number first (newer first) within the same bucket
 *
 * Repos are grouped (sorted by slug) then PRs within each repo sorted by this key.
 */
function digestSortKey(pr: any): [number, number, number, number, number, number] {
  const s = stateEmoji(pr);
  // Bucket 0 = open, 1 = merged, 2 = closed-no-merge
  const stateBucket = s === "🟣" ? 1 : s === "❌" ? 2 : 0;
  // Mergeability rank (lower = more mergeable); only relevant for open PRs
  const mss: string = pr.mergeStateStatus ?? "";
  const mergeRank = mss === "CLEAN" ? 0 : mss === "UNSTABLE" ? 1 : mss === "BEHIND" ? 2 : 3;
  // CI rank: best CI state first
  const ci = ciEmoji(pr);
  const ciRank =
    ci === "✅" || ci === "🟢" ? 0 : ci === "🔵" ? 1 : ci === "🔴" ? 2 : ci === "🟠" ? 3 : 4; // ❌ or ⛔️
  // Review rank: most-approved first
  const rv = reviewEmoji(pr);
  const reviewRank =
    rv === "✅" ? 0 : rv === "🟢" ? 1 : rv === "🟠" ? 2 : rv === "💬" ? 3 : rv === "🔵" ? 4 : 5; // ❌ = changes-req
  return [stateBucket, mergeRank, ciRank, reviewRank, -pr.number, 0];
}

// ---- patch-event subcommand: update a single PR line from webhook payload ----

/**
 * GitHub pull_request event payload shape (relevant fields only).
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
 */
type GhPrEvent = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    state: "open" | "closed";
    draft: boolean;
    merged: boolean;
    mergeable: boolean | null;
    user: { login: string; html_url: string };
    base: { repo: { full_name: string } };
    labels: Array<{ name: string }>;
  };
  repository: { full_name: string };
};

/**
 * Derive state emoji from raw webhook payload (no GraphQL).
 *
 * The REST/webhook `mergeable` is a tri-state boolean|null (null = GitHub hasn't
 * computed it yet). We map null → treat as unknown (open/🟢) rather than
 * CONFLICTING, to avoid false-orange flashes.
 */
function stateEmojiFromEvent(pr: GhPrEvent["pull_request"]): StateEmoji {
  if (pr.merged) return "🟣";
  if (pr.state === "closed") return "❌";
  if (pr.draft) return "🔵";
  if (pr.mergeable === false) return "🟠";
  return "🟢";
}

type PatchEventArgs = {
  eventFile: string;
  digestDir: string;
};

function parsePatchEventArgs(argv: string[]): PatchEventArgs {
  const a: PatchEventArgs = {
    eventFile: process.env.GITHUB_EVENT_PATH ?? "",
    digestDir: "docs/pr-status",
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const take = (): string => {
      const eq = v.indexOf("=");
      if (eq >= 0) return v.slice(eq + 1);
      return argv[++i];
    };
    if (v === "--event-file" || v.startsWith("--event-file=")) a.eventFile = take();
    else if (v === "--digest-dir" || v.startsWith("--digest-dir=")) a.digestDir = take();
    else if (v === "-h" || v === "--help") {
      console.error(
        "usage: pr-status patch-event [--event-file <path>] [--digest-dir <dir>]\n" +
          "  --event-file  path to GitHub event JSON (default: $GITHUB_EVENT_PATH)\n" +
          "  --digest-dir  root of digest docs (default: docs/pr-status)",
      );
      process.exit(0);
    } else {
      console.error(`unknown patch-event arg: ${v}`);
      process.exit(2);
    }
  }
  return a;
}

/**
 * Build a formatted digest line using event-derived state emoji but
 * preserving existing CI/review emojis from the old line if available.
 *
 * Line format used by formatLine():
 *   [stateEmoji](# "title")[ciEmoji](# "title")[reviewEmoji](# "title") [[slug#N] title](url) by [@login](url)
 *   (strikethrough wraps the whole thing for terminal states)
 *
 * When preserving, we extract the ciEmoji and reviewEmoji link-title tokens
 * from the existing line so we don't lose CI/review context.
 */
const EMOJI_TIP_RE = /\[([^[\]]+)\]\(#\s*"([^"]+)"\)/g;

function extractEmojiTips(line: string): Array<{ emoji: string; title: string }> {
  const results: Array<{ emoji: string; title: string }> = [];
  // Strip the leading "- " bullet prefix and any "~~...~~" strikethrough wrapper.
  // Emitted lines are always one of: "- ~~<body>~~" (closed/merged) or "- <body>" (open).
  const stripped = line.replace(/^- ~~(.+)~~$/, "$1").replace(/^- /, "");
  let m: RegExpExecArray | null;
  EMOJI_TIP_RE.lastIndex = 0;
  while ((m = EMOJI_TIP_RE.exec(stripped)) !== null) {
    results.push({ emoji: m[1], title: m[2] });
  }
  return results;
}

function buildPatchedLine(
  ref: Ref,
  pr: GhPrEvent["pull_request"],
  existingLine: string | null,
): string {
  const slug = pr.base.repo.full_name;
  const title = pr.title;
  const url = pr.html_url;
  const s = stateEmojiFromEvent(pr);

  // Try to preserve existing CI and review emojis from the old line.
  // The first tip-emoji = state, second = CI, third = review.
  let ciTip: string;
  let reviewTip: string;

  if (existingLine) {
    const tips = extractEmojiTips(existingLine);
    // tips[0] = old state (we replace), tips[1] = CI, tips[2] = review
    const oldCi = tips[1];
    const oldReview = tips[2];
    ciTip = oldCi
      ? `[${oldCi.emoji}](# "${oldCi.title.replace(/"/g, '\\"')}")`
      : tip("🟢", CI_TITLES["🟢"]);
    reviewTip = oldReview
      ? `[${oldReview.emoji}](# "${oldReview.title.replace(/"/g, '\\"')}")`
      : tip("🔵", REVIEW_TITLES["🔵"]);
  } else {
    // New PR — no prior line; use defaults (no checks, no reviews yet)
    ciTip = tip("🟢", CI_TITLES["🟢"]);
    reviewTip = tip("🔵", REVIEW_TITLES["🔵"]);
  }

  const stateTip = tip(s, STATE_TITLES[s]);
  const authorLogin = pr.user.login;
  const authorUrl = pr.user.html_url;
  const author = ` by [@${authorLogin}](${authorUrl})`;

  const body = `${stateTip}${ciTip}${reviewTip} [[${slug}#${ref.number}] ${title}](${url})${author}`;
  if (s === "🟣" || s === "❌") return `- ~~${body}~~`;
  return `- ${body}`;
}

/**
 * Returns true if a digest line refers to the given PR.
 * Lines look like (optionally prefixed with ~~):
 *   [emoji](# "...")... [[owner/repo#N] title](url) ...
 * We match on the `[[slug#N]` substring anywhere in the line.
 */
function lineMatchesPr(line: string, slug: string, number: number): boolean {
  // Strip the leading "- " bullet prefix and any "~~...~~" strikethrough wrapper,
  // then check for [[slug#N] anywhere in line.
  const stripped = line.replace(/^- ~~(.+)~~$/, "$1").replace(/^- /, "");
  return stripped.includes(`[[${slug}#${number}]`);
}

/**
 * Build the minimal seed content for a digest file that doesn't exist yet.
 *
 * The seeded file matches the format the full-regen `digest` job produces so
 * that the next scheduled full-regen will not notice a structural difference.
 * The header note says "(seeded by patch-event)" so it's clearly auditable.
 *
 * per-repo files use slug = "owner/repo"; all.md uses "REPOS.md scope (combined)".
 */
function seedDigestContent(filePath: string, slug: string): string {
  const ts = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const isAll = filePath.endsWith("/all.md") || filePath === "all.md";
  if (isAll) {
    return `# PR Status — REPOS.md scope (combined)\n\n_Generated ${ts} · seeded by patch-event (full regen pending)._\n\n`;
  }
  return `# PR Status — ${slug}\n\n_Generated ${ts} · seeded by patch-event (full regen pending)._\n\n`;
}

/**
 * Patch a single per-repo digest file: find the line for this PR number,
 * replace it with the new line. If no line found, append at end of content
 * (before blank trailer lines). Returns true if the file was changed.
 *
 * If the digest file does not exist, it is seeded with a minimal header (same
 * structure the full-regen `digest` job produces) and the new line is inserted.
 * The parent directory is created if needed.
 */
function patchDigestFile(filePath: string, ref: Ref, newLine: string): boolean {
  const slug = `${ref.owner}/${ref.repo}`;

  if (!existsSync(filePath)) {
    // Seed the file so the patch can proceed and the workflow `git add` succeeds.
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    const seeded = seedDigestContent(filePath, slug) + newLine + "\n";
    writeFileSync(filePath, seeded, "utf8");
    console.error(`patch-event: seeded missing digest file ${filePath} with line for ${slug}#${ref.number}`);
    return true;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  let matchIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lineMatchesPr(lines[i], slug, ref.number)) {
      matchIdx = i;
      break;
    }
  }

  let newLines: string[];
  if (matchIdx >= 0) {
    // Replace existing line
    newLines = [...lines];
    newLines[matchIdx] = newLine;
  } else {
    // Append before trailing blank lines
    let insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === "") {
      insertAt--;
    }
    newLines = [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)];
  }

  const newContent = newLines.join("\n");
  if (newContent === content) return false;
  writeFileSync(filePath, newContent, "utf8");
  console.error(
    matchIdx >= 0
      ? `patch-event: updated line for ${slug}#${ref.number} in ${filePath}`
      : `patch-event: appended new line for ${slug}#${ref.number} in ${filePath}`,
  );
  return true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Patch the combined all.md the same way.
 */
function patchAllDigest(allPath: string, ref: Ref, newLine: string): boolean {
  return patchDigestFile(allPath, ref, newLine);
}

async function runPatchEvent(argv: string[]): Promise<void> {
  const args = parsePatchEventArgs(argv);

  if (!args.eventFile) {
    console.error(
      "patch-event: no event file path — set $GITHUB_EVENT_PATH or pass --event-file",
    );
    process.exit(2);
  }

  let event: GhPrEvent;
  try {
    event = JSON.parse(readFileSync(args.eventFile, "utf8")) as GhPrEvent;
  } catch (e) {
    console.error(`patch-event: failed to read event file ${args.eventFile}: ${e}`);
    process.exit(1);
  }

  const pr = event.pull_request;
  if (!pr) {
    console.error(`patch-event: event has no pull_request field (action: ${event.action})`);
    process.exit(2);
  }

  const fullName = pr.base.repo.full_name ?? event.repository?.full_name;
  if (!fullName || !fullName.includes("/")) {
    console.error(`patch-event: could not determine repo full_name from event`);
    process.exit(2);
  }

  const [owner, repo] = fullName.split("/");
  const ref: Ref = { owner, repo, number: pr.number };

  // Determine digest file paths
  const perRepoSlug = fullName.replace("/", "--");
  const perRepoPath = `${args.digestDir}/per-repo/${perRepoSlug}.md`;
  const allPath = `${args.digestDir}/all.md`;

  console.error(`patch-event: action=${event.action} pr=${fullName}#${pr.number} (${pr.title})`);

  // Read existing per-repo line (for CI/review preservation)
  let existingLine: string | null = null;
  if (existsSync(perRepoPath)) {
    const lines = readFileSync(perRepoPath, "utf8").split("\n");
    for (const l of lines) {
      if (lineMatchesPr(l, fullName, pr.number)) {
        existingLine = l;
        break;
      }
    }
  }

  const newLine = buildPatchedLine(ref, pr, existingLine);

  let changed = false;
  changed = patchDigestFile(perRepoPath, ref, newLine) || changed;
  changed = patchAllDigest(allPath, ref, newLine) || changed;

  if (!changed) {
    console.error(`patch-event: no changes — digest already up to date`);
  }
  // Always exit 0; caller (workflow) decides whether to commit
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
  outDir: string | null;
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
    outDir: null,
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
    else if (v === "--out-dir" || v.startsWith("--out-dir=")) a.outDir = take();
    else if (v === "-h" || v === "--help") {
      console.error(
        "usage: pr-status digest [--org N...] [--author U...] [--repo OWNER/REPO...]\n" +
          "                       [--since DUR|ISO] [--state open|closed|merged|all]\n" +
          "                       [--by created|updated] [--limit N] [--refs-only]\n" +
          "                       [--all-open|--no-all-open] [--out-dir DIR]",
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

/**
 * Build a GitHub search query string from DigestArgs.
 * repos: optional subset of repos to use (for chunking). If null, uses a.repos.
 * opts.stateOverride: override a.state (used by --all-open split).
 * opts.skipSince: omit the since filter (used by --all-open open query).
 */
function buildSearchQ(
  a: DigestArgs,
  repos?: string[],
  opts?: { stateOverride?: DigestArgs["state"]; skipSince?: boolean },
): string {
  const repoList = repos ?? a.repos;
  const state = opts?.stateOverride ?? a.state;
  const parts: string[] = ["is:pr"];
  for (const o of a.orgs) parts.push(`org:${o}`);
  for (const u of a.authors) parts.push(`author:${u}`);
  for (const r of repoList) parts.push(`repo:${r}`);
  if (state !== "all") parts.push(`is:${state}`);
  if (!opts?.skipSince) {
    const iso = sinceToISO(a.since);
    if (iso) parts.push(`${a.by}:>=${iso}`);
  }
  return parts.join(" ");
}

/**
 * Split a list of repos into chunks where each chunk's repo: qualifiers
 * (combined with the base query prefix) stay under maxQueryLen chars.
 */
export function chunkReposForQuery(
  repos: string[],
  baseQ: string,
  maxQueryLen = 230,
): string[][] {
  if (repos.length === 0) return [];
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = baseQ.length;

  for (const r of repos) {
    const qualifier = ` repo:${r}`;
    if (current.length > 0 && currentLen + qualifier.length > maxQueryLen) {
      chunks.push(current);
      current = [];
      currentLen = baseQ.length;
    }
    current.push(r);
    currentLen += qualifier.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Bucket a flat list of refs by "owner/repo" slug.
 */
export function bucketByRepo(refs: Ref[]): Map<string, Ref[]> {
  const map = new Map<string, Ref[]>();
  for (const r of refs) {
    const slug = `${r.owner}/${r.repo}`;
    const existing = map.get(slug);
    if (existing) {
      existing.push(r);
    } else {
      map.set(slug, [r]);
    }
  }
  return map;
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

async function discoverRefsForQuery(q: string, limit: number): Promise<Ref[]> {
  const refs: Ref[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  const pageSize = 100;
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
  return refs;
}

/** Merge refs from `src` into `dest`/`seen`, respecting `limit`. */
function mergeRefs(src: Ref[], dest: Ref[], seen: Set<string>, limit: number): void {
  for (const r of src) {
    if (dest.length >= limit) break;
    const key = `${r.owner}/${r.repo}#${r.number}`;
    if (!seen.has(key)) {
      seen.add(key);
      dest.push(r);
    }
  }
}

async function discoverRefs(a: DigestArgs): Promise<Ref[]> {
  // When --all-open (default true): open PRs are returned regardless of --since;
  // only the closed/merged bucket respects the time filter.  This requires two
  // separate search queries when state=all and a time-bounded --since is active.
  const hasSince = sinceToISO(a.since) !== null;
  const needsSplit = a.allOpen && a.state === "all" && hasSince;

  // If we have --repo flags and they could exceed the GH search query length,
  // chunk them into multiple queries and merge results.
  if (a.repos.length > 0) {
    // Build the base query without repo: qualifiers to measure its length
    const baseArgs = { ...a, repos: [] };
    const baseQ = buildSearchQ(baseArgs, []);
    const chunks = chunkReposForQuery(a.repos, baseQ);

    if (chunks.length > 1) {
      console.error(`digest query: splitting ${a.repos.length} repos into ${chunks.length} chunks`);
    }

    const allRefs: Ref[] = [];
    const seen = new Set<string>();
    for (let ci = 0; ci < chunks.length; ci++) {
      if (allRefs.length >= a.limit) break;
      if (needsSplit) {
        // 1. Open PRs — no since filter (always show all open PRs).
        const openQ = buildSearchQ(a, chunks[ci], { stateOverride: "open", skipSince: true });
        // 2. Closed PRs (merged + unmerged-closed) — since filter applies.
        const closedQ = buildSearchQ(a, chunks[ci], { stateOverride: "closed" });
        if (chunks.length > 1) {
          console.error(`digest queries [${ci + 1}/${chunks.length}] (--all-open): open=${openQ}  closed=${closedQ}`);
        } else {
          console.error(`digest queries (--all-open): open=${openQ}  closed=${closedQ}`);
        }
        const openRefs = await discoverRefsForQuery(openQ, a.limit - allRefs.length);
        mergeRefs(openRefs, allRefs, seen, a.limit);
        const closedRefs = await discoverRefsForQuery(closedQ, a.limit - allRefs.length);
        mergeRefs(closedRefs, allRefs, seen, a.limit);
      } else {
        const q = buildSearchQ(a, chunks[ci]);
        if (chunks.length > 1) {
          console.error(`digest query [${ci + 1}/${chunks.length}]: ${q}`);
        } else {
          console.error(`digest query: ${q}`);
        }
        const chunkRefs = await discoverRefsForQuery(q, a.limit - allRefs.length);
        mergeRefs(chunkRefs, allRefs, seen, a.limit);
      }
    }
    console.error(`discovered ${allRefs.length} ref(s)`);
    return allRefs;
  }

  // No --repo flags: single query (with optional allOpen split)
  const allRefs: Ref[] = [];
  const seen = new Set<string>();

  if (needsSplit) {
    // 1. Open PRs — no since filter (always show all open PRs).
    const openQ = buildSearchQ(a, undefined, { stateOverride: "open", skipSince: true });
    // 2. Closed PRs (merged + unmerged-closed) — since filter applies.
    const closedQ = buildSearchQ(a, undefined, { stateOverride: "closed" });
    console.error(`digest queries (--all-open): open=${openQ}  closed=${closedQ}`);
    const openRefs = await discoverRefsForQuery(openQ, a.limit);
    mergeRefs(openRefs, allRefs, seen, a.limit);
    const closedRefs = await discoverRefsForQuery(closedQ, a.limit - allRefs.length);
    mergeRefs(closedRefs, allRefs, seen, a.limit);
  } else {
    const q = buildSearchQ(a);
    console.error(`digest query: ${q}`);
    const refs = await discoverRefsForQuery(q, a.limit);
    mergeRefs(refs, allRefs, seen, a.limit);
  }

  console.error(`discovered ${allRefs.length} ref(s)`);
  return allRefs;
}

// ---- main ----

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error(
      "usage:\n" +
        "  pr-status <ref> [<ref> ...]            (ref = URL | owner/repo#N | @file)\n" +
        "  pr-status digest [--org ...] [--author ...] [--since ...] [--refs-only]\n" +
        "                   [--out-dir DIR]\n" +
        "  pr-status patch-event [--event-file <path>] [--digest-dir <dir>]",
    );
    process.exit(2);
  }

  if (argv[0] === "patch-event") {
    await runPatchEvent(argv.slice(1));
    return;
  }

  let refs: Ref[];
  let refsOnly = false;
  let sortDigest = false;
  let outDir: string | null = null;
  let digestArgs: DigestArgs | null = null;

  if (argv[0] === "digest") {
    const dargs = parseDigestArgs(argv.slice(1));
    if (dargs.orgs.length === 0 && dargs.authors.length === 0 && dargs.repos.length === 0) {
      console.error("digest: at least one of --org, --author, or --repo is required");
      process.exit(2);
    }
    refs = await discoverRefs(dargs);
    refsOnly = dargs.refsOnly;
    sortDigest = true;
    outDir = dargs.outDir;
    digestArgs = dargs;
  } else {
    refs = collectRefs(argv);
  }

  if (refs.length === 0) {
    console.error("no refs to query");
    // exit 0 in digest mode: no PRs is a valid empty result, not an error
    process.exit(argv[0] === "digest" ? 0 : 2);
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

  // In digest mode: collect (slug, sortKey, line, ref) so we can sort per-repo
  // before emitting and bucket by repo for --out-dir.
  // In ref mode: print immediately (preserve caller-specified order).
  type CollectedLine = {
    slug: string;
    sortKey: [number, number, number, number, number, number];
    line: string;
    ref: Ref;
  };
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
          collected.push({ slug, sortKey: [4, 0, 4, 5, -ref.number, 0], line, ref });
        } else {
          console.log(line);
        }
        return;
      }
      const line = formatLine(ref, pr);
      if (sortDigest) {
        const slug = pr.baseRepository?.nameWithOwner ?? `${ref.owner}/${ref.repo}`;
        collected.push({ slug, sortKey: digestSortKey(pr), line, ref });
      } else {
        console.log(line);
      }
    });
  }

  // Digest mode: sort per-repo (open by mergeability/CI/review → merged → closed) then emit.
  // Repos are grouped alphabetically by slug; within each repo, PRs are sorted by the key.
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

  // --out-dir: write per-repo files (uses the already-sorted `collected` if digest mode)
  if (outDir && (anySuccess || refs.length === 0)) {
    const ts = new Date().toISOString().replace(/:\d+\.\d+Z$/, "Z");
    mkdirSync(outDir, { recursive: true });

    // Build the set of repos we were asked about (for the --repo flag list).
    // Even repos with 0 PRs should get a (possibly empty) file.
    const requestedRepos = new Set<string>(digestArgs?.repos ?? []);
    const bucketed = bucketByRepo(collected.map((cl) => cl.ref));

    // Ensure all requested repos appear in the map (even if empty).
    for (const r of requestedRepos) {
      if (!bucketed.has(r)) bucketed.set(r, []);
    }

    // Summary stats per repo (for GITHUB_STEP_SUMMARY / job log).
    const summaryLines: string[] = [];

    for (const [slug] of bucketed) {
      const repoLines = collected
        .filter((cl) => cl.slug === slug)
        .map((cl) => cl.line);

      // Count stats for summary
      const total = repoLines.length;
      const open = repoLines.filter((l) => !l.includes("~~")).length;
      const merged = repoLines.filter((l) => l.includes("🟣")).length;
      const closed = repoLines.filter((l) => l.includes("❌") && l.includes("~~")).length;
      summaryLines.push(`- **${slug}**: ${total} total — ${open} open / ${merged} merged 🟣 / ${closed} closed ❌`);
      console.error(`summary: ${slug}: ${total} total (${open} open, ${merged} merged, ${closed} closed)`);

      const fileName = `${slug.replace("/", "--")}.md`;
      const filePath = join(outDir, fileName);
      const header = [
        `# PR Status — ${slug}`,
        "",
        `_Generated ${ts} · scope: this repo · open + merged 🟣 only (closed-no-merge ❌ excluded)._`,
        "",
      ].join("\n");
      const body = repoLines.filter((l) => !l.includes("❌") || !l.includes("~~")).join("\n");
      writeFileSync(filePath, header + (body ? body + "\n" : ""));
    }

    // Write totals summary to GITHUB_STEP_SUMMARY if available
    const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummaryPath) {
      const totalPRs = collected.length;
      const totalOpen = collected.filter((cl) => !cl.line.includes("~~")).length;
      const totalMerged = collected.filter((cl) => cl.line.includes("🟣")).length;

      const summaryContent = [
        `## PR Status Digest — ${ts}`,
        "",
        `**Total:** ${totalPRs} PRs across ${bucketed.size} repos — ${totalOpen} open / ${totalMerged} merged`,
        "",
        "### Per-repo breakdown",
        "",
        ...summaryLines,
      ].join("\n") + "\n";

      appendFileSync(stepSummaryPath, summaryContent);
    }
  }

  if (!anySuccess && failCount > 0) {
    process.exit(1);
  }
  // partial failures: exit 0 — warnings already emitted to stderr
}

// Only run main() when executed directly, not when imported for testing.
if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
