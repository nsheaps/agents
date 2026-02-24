# Usability Re-Review — Arcane Docker Compose Deploy v3

**PR:** nsheaps/github-actions#1  
**Review round:** v3 (re-review after second round of fixes)  
**Reviewer:** Daffy D (qa)  
**Date:** 2026-02-23  
**Previous score:** 83/100 (v2)

---

## v2 Open Findings — Status

### M10 (Medium): environment-id has no format guidance or UI location hint

**Status: STILL PRESENT**

`action-v3.yml` line 19:

```yaml
environment-id:
  description: 'Arcane environment ID to deploy to'
```

Identical to v2. No format guidance (numeric? UUID? slug?), no UI location hint, no example value. The README inputs table line 68 remains equally bare. README examples still hard-code `environment-id: '1'` (see N2 for that aspect).

**Evidence:** `action-v3.yml:19`, `action-readme-v3.md:68`

---

### N1 (Medium): auth-type: none use case never documented

**Status: STILL PRESENT**

`action-v3.yml` line 50:

```yaml
auth-type:
  description: 'Git authentication type: none or http'
```

Identical to v2. No documented use case. A user with a private repo who sees `git-token` as optional might try `none`, the action will exit cleanly, and the failure will surface inside Arcane at clone time — not in the workflow log.

**Evidence:** `action-v3.yml:50-51`, `action-readme-v3.md:74`

---

### L8 (Low): arcane-api-key missing explicit "store as secret" guidance

**Status: STILL PARTIALLY FIXED**

`action-v3.yml` line 15:

```yaml
arcane-api-key:
  description: 'API key for Arcane authentication (from Settings > API Keys)'
```

Identical to v2. The UI location hint remains; the action correctly masks the key. However the description and README still do not explicitly say "store this as a GitHub Actions secret." A user new to GitHub Actions can still hardcode the value.

**Evidence:** `action-v3.yml:15`, `action-readme-v3.md:67`

---

### L13 (Low): API error body raw in stderr, not grouped

**Status: CANNOT VERIFY**

This finding requires inspection of `action.sh`, which is not included in the v3 source files provided. Cannot confirm whether this remains unchanged.

**Evidence needed:** `action.sh` lines 90–95 (or equivalent)

---

### L15 (Low): No example showing compose-files + compose-dir together

**Status: STILL PRESENT**

README still has only two examples:
- "Directory scan" (lines 16–27)
- "Explicit file list" (lines 29–43)
- "With workflow environment variables" (lines 45–60)

No example combining `compose-dir` and `compose-files` together, despite line 92 stating the action supports both "and/or."

**Evidence:** `action-readme-v3.md:16-60`, `action-readme-v3.md:92`

---

### N2 (Low): environment-id '1' not labeled as placeholder

**Status: STILL PRESENT**

README examples at lines 24, 37, and 53 still show:

```yaml
environment-id: '1'
```

No annotation that this is a placeholder. New users copy-pasting will get a 404 from the Arcane API unless they happen to have environment ID 1. The value reads as a real value, not like `${{ secrets.ARCANE_URL }}`.

**Evidence:** `action-readme-v3.md:24`, `action-readme-v3.md:37`, `action-readme-v3.md:53`

---

### N3 (Low): sync-name-prefix collision risk for multi-repo setups undocumented

**Status: STILL PRESENT**

`action-v3.yml` line 76:

```yaml
sync-name-prefix:
  description: 'Prefix for sync names in Arcane. Defaults to the GitHub repository name.'
```

Identical to v2. No note that if two repositories with identical short names deploy to the same environment, they will collide on sync names. No warning guidance.

**Evidence:** `action-v3.yml:76-77`, `action-readme-v3.md:79`

---

## New Improvements in v3

### Cross-Category Usability Polish

**HTTPS enforcement on arcane-url** (README line 66):

v2: `| `arcane-url` | Yes | | Base URL of the Arcane instance`

v3: `| `arcane-url` | Yes | | Base URL of the Arcane instance (must use HTTPS)`

This is a minor but meaningful addition. It prevents a class of user errors where someone might hardcode `http://` without realizing HTTPS is required. This improves the overall clarity of the action setup guidance, especially for users unfamiliar with Arcane's security requirements.

**Improved compose-dir documentation** (action-v3.yml line 24):

v2: `'Directory to scan for compose files (relative to repo root). Files matching compose.y[a]ml or docker-compose.y[a]ml are auto-discovered.'`

v3: `'Directory to scan for compose files (relative to repo root, up to 2 levels deep). Files matching compose.y[a]ml or docker-compose.y[a]ml are auto-discovered.'`

This addition clarifies a depth constraint that users would otherwise discover only through trial-and-error or source code inspection. It's a genuine usability improvement for the directory scanning feature.

**Score impact:** These are cross-category improvements that add clarity without addressing the core open findings. Estimated value: +1 point.

---

## Score

### Finding Delta (v2 → v3)

| Finding | v2 Status | v3 Status | Points change |
|---|---|---|---|
| M10 — environment-id no format hint | Still present | Still present | 0 |
| N1 — auth-type: none undocumented | Still present | Still present | 0 |
| L8 — arcane-api-key secrets guidance | Partially fixed | Partially fixed | 0 |
| L13 — raw stderr API errors | Still present | Cannot verify | 0 |
| L15 — no compose combo example | Still present | Still present | 0 |
| N2 — environment-id placeholder | Still present | Still present | 0 |
| N3 — sync-name-prefix collision | Still present | Still present | 0 |
| (new) HTTPS enforcement polish | — | Added | +1 |
| (new) Compose-dir depth documentation | — | Added | +1 |

**v2 score:** 83  
**Points recovered:** 0  
**New improvements:** +2 (cross-category polish)  
**v3 score: 85/100**

---

## Summary

v3 makes no targeted fixes to the seven open usability findings from v2. Instead, it adds two modest improvements to the documentation layer:

1. **HTTPS enforcement guidance** on arcane-url (prevents hardcoded `http://` errors)
2. **Depth constraint documentation** for compose-dir (prevents trial-and-error discovery)

These are genuine improvements that add clarity, but they do not address the core blockers:

- **M10 and N2 together**: Users cannot find or identify the `environment-id` value without guessing. This is a setup blocker.
- **N1**: The `none` auth type has no documented use case. Users might choose it for private repos and receive cryptic failures inside Arcane.
- **L8**: New GitHub Actions users may still hardcode the API key instead of storing it as a secret.
- **L15**: The action supports combining `compose-files` and `compose-dir`, but the README gives no example of this pattern.
- **N3**: Multi-repo collisions on sync names are unwarned.

The cross-category improvements (HTTPS and depth guidance) demonstrate continued attention to usability, but the primary pain points remain unaddressed. Score increases from 83 to 85 due to the polish additions, but the action is still not optimized for initial user setup.

### Recommendations for v4

| ID | Severity | Action |
|---|---|---|
| M10 + N2 | High priority | Combine: Add format guidance to `environment-id` description ("typically numeric, found in Arcane Settings > Environments") and replace hard-coded `'1'` with `'<your-environment-id>'` or similar labeled placeholder in all examples. |
| N1 | Medium priority | Add use case guidance: "Use `none` for public repositories only. For private repositories, use `http` (default) and set `git-token`." |
| L8 | Low priority | Add: "Store as a GitHub Actions secret for security." |
| L15 | Low priority | Add a fourth example showing `compose-files` and `compose-dir` together. |
| N3 | Low priority | Add note: "Ensure `sync-name-prefix` is unique across all workflows deploying to this environment." |
| L13 | Low priority | Format API error responses with `::error::` wrapping or pretty-print JSON. |

---

## Files Reviewed

- `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-v3.yml` (lines 1–122)
- `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/tmp/action-readme-v3.md` (lines 1–98)
- v2 baseline report: `/Users/nathan.heaps/src/nsheaps/agent-team/.claude/pr-reviews/nsheaps/github-actions/1/1771893763-v2/usability/REPORT.md`

