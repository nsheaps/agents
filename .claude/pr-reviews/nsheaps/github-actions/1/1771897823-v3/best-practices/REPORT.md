# Best Practices Re-Review — Arcane Docker Compose Deploy v3

**PR**: nsheaps/github-actions#1 v3
**Category**: BEST PRACTICES
**Previous score (v2)**: 95/100
**Revised score (v3)**: 96/100
**Reviewer**: Daffy D (qa)
**Date**: 2026-02-23

---

## v2 Findings: Verification Status

The three findings from v2 remain **open and unfixed**. I have verified each one against v3 source:

### N1 — Medium: `|| true` on trigger-sync silently eats all failures

**Status**: STILL PRESENT

**Location**: `action-v3.sh:303`

**Evidence**:

```bash
arcane_api POST "/environments/${ENV_ID}/gitops-syncs/${sync_id}/sync" > /dev/null || true
```

The `|| true` remains unchanged. The concern still stands: both transport errors (DNS, timeout) and HTTP 4xx/5xx errors are suppressed without distinction or logging. The policy of "trigger failure is non-fatal" is not documented, and there is no log message indicating the failure occurred.

---

### N2 — Low: Repository list jq guard inconsistency with `jq_extract_id`

**Status**: STILL PRESENT

**Location**: `action-v3.sh:190-194`

**Evidence**:

```bash
REPOSITORY_ID=$(echo "${repos}" | jq -r \
  --arg url "${REPO_URL}" \
  '[.[] | select(.url == $url)] | first // empty | .id')

if [[ -n "${REPOSITORY_ID}" && "${REPOSITORY_ID}" != "null" ]]; then
```

The raw `jq -r` is still used without the `jq_extract_id` helper. The malformed-but-valid-JSON case (e.g., `{"error": "unauthorized"}` returned by a compromised or misbehaving API) is not caught. The `jq` will return an empty string silently, `REPOSITORY_ID` will be empty, and the code will fall into the create branch — potentially creating a duplicate repository on every workflow invocation.

The inconsistency with `jq_extract_id` (used on lines 223 and 294 for create paths) remains unaddressed. This violates the defense-in-depth pattern established by the helper.

---

### N3 — Low: `find -type f` silently skips symlinked compose files

**Status**: STILL PRESENT

**Location**: `action-v3.sh:142-147`

**Evidence**:

```bash
done < <(find "${search_dir}" -maxdepth 2 -type f \( \
  -name "docker-compose.yml" -o \
  -name "docker-compose.yaml" -o \
  -name "compose.yml" -o \
  -name "compose.yaml" \
\) -print0 | sort -z)
```

`-type f` matches only regular files, not symlinks. If a compose file is a symlink (common in monorepos that share base compose files), it is silently skipped with no warning. The action may exit 0 having done nothing for that stack.

---

## v3 Improvements: New Validation Guards

While the three findings remain unfixed, v3 introduces new input validation guards that **strengthen the overall best-practice pattern** and raise the code quality ceiling:

### AUTO_SYNC Boolean Validation (lines 377-380)

**New pattern established**:

```bash
if [[ "${AUTO_SYNC}" != "true" && "${AUTO_SYNC}" != "false" ]]; then
  log_error "auto-sync must be 'true' or 'false', got '${AUTO_SYNC}'"
  exit 1
fi
```

Validates boolean inputs before passing to `jq --argjson`. This prevents malformed boolean values from reaching downstream operations.

### HTTPS Enforcement (lines 388-392)

**New pattern established**:

```bash
if [[ "${ARCANE_URL}" != https://* ]]; then
  log_error "arcane-url must use HTTPS (got '${ARCANE_URL}')"
  exit 1
fi
```

Validates that the Arcane URL uses HTTPS. This is a defense-in-depth security control that prevents accidental HTTP deployments that could leak API keys.

### SYNC_INTERVAL Positive-Integer Validation (lines 382-386)

**New pattern established**:

```bash
if [[ ! "${SYNC_INTERVAL}" =~ ^[1-9][0-9]*$ ]]; then
  log_error "sync-interval must be a positive integer, got '${SYNC_INTERVAL}'"
  exit 1
fi
```

Validates that sync interval is a positive integer. This prevents zero or negative values from reaching the API and being silently rejected with a cryptic error.

### Pattern Significance

These three new guards establish a **clear, repeatable pattern for defensive input validation**:

1. Identify configuration inputs that have constraints (boolean, numeric range, URL scheme, etc.)
2. Validate the input against the constraint early, at the entry point
3. Reject invalid inputs with a clear error message and exit code 1
4. Do not allow invalid values to propagate to downstream operations

This pattern, if extended consistently, would **directly address all three open findings**:

- **N1 fix**: Validate `TRIGGER_SYNC` as a boolean before using it; log the intent of the `|| true` policy
- **N2 fix**: Validate that `repos` is an array before attempting the `jq` select/filter
- **N3 fix**: Validate that found compose files are readable; warn if symlinks are skipped

---

## Best Practice Assessment

### Strengths in v3

1. **Consistent input validation pattern** — The new guards establish a clear, repeatable approach to defensive programming
2. **Early validation** — Constraints are checked at the entry point, before values reach sensitive operations
3. **Clear error messages** — Each validation failure explains what is wrong and what is expected
4. **Correct format** — Uses `exit 1` to signal failure, not `exit 0` or silent continuation

### Remaining Gaps

1. **Undocumented failure policies** — N1's `|| true` behavior is not documented; a maintainer may not realize it's intentional
2. **Inconsistent defensive patterns** — N2 shows that `jq_extract_id` is used on create paths but not on find paths; the pattern is not universal
3. **Silent failure modes** — N3 shows that symlinked files are silently skipped; this could hide configuration errors

### Recommended Next Steps (Priority Order)

1. **High**: Add a comment and log message to N1's trigger-sync call explaining the non-fatal policy
2. **Medium**: Apply `jq_extract_id` guard to N2's repository lookup, or add an explicit `type == "array"` check
3. **Low**: Document or warn on N3's symlink behavior in the compose file discovery function

---

## Score Breakdown

| Area                              | v2  | v3  | Delta | Reason                                                                        |
| --------------------------------- | --- | --- | ----- | ----------------------------------------------------------------------------- | --- | -------------------------------- |
| Trigger-sync policy documentation | -2  | -2  | 0     | Still undocumented; `                                                         |     | true` suppresses without comment |
| Repository list jq guard          | -1  | -1  | 0     | Raw `jq -r` still used; inconsistent with `jq_extract_id`                     |
| Symlink discovery behavior        | -1  | -1  | 0     | `find -type f` still silently skips symlinks                                  |
| Input validation pattern strength | 0   | +1  | +1    | New AUTO_SYNC, HTTPS, SYNC_INTERVAL guards establish strong defensive pattern |

**Final score: 96/100**

The one-point improvement reflects the **strengthened input validation pattern** established by the three new guards. While the three findings persist, the new guards demonstrate a clear commitment to defensive input validation and establish a template that a future maintainer can follow to fix N1, N2, and N3.

---

## Summary

v3 closes **zero** of the three open findings but improves the **pattern quality** by establishing a consistent, repeatable approach to defensive input validation. The code is incrementally more maintainable and follows a clearer best-practice template.

All three findings are defensible to close without further action **if and only if** they are accepted as intentional design decisions:

- N1: The trigger-sync failure is non-fatal by design (acceptable if documented)
- N2: Repository duplication is acceptable risk for the use case (low likelihood if API is stable)
- N3: Symlinks are not supported (acceptable if documented)

However, best practice would be to address them with comments, guards, or documentation before merging.
