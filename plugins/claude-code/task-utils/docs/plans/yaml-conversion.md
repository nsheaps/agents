# Plan: Convert task-utils on-disk format from JSON to YAML

**Branch:** `claude/ai-3d-model-generator-XjoUi` (PR #157)
**Plugin path:** `plugins/claude-code/task-utils/`
**Scope:** Format-only change — no behavior changes, no schema changes.

---

## Design-question resolutions

### Q1 — YAML library for the MCP server (TypeScript/Bun)

**Recommendation: `yaml` npm package (v2.x).**

`Bun.YAML` (built-in) was tested against Bun 1.3.11 and confirmed to expose both
`parse` and `stringify`. However, `YAML.stringify` produces **flow-style
single-line output**: `{id: "1",status: in_progress,description: "..."}`. The
`status` key is NOT on its own line, so the shell hooks' `grep '^status: '`
approach cannot work.[^1]

The `yaml` npm package (tested at v2.9.0) produces block-style output with each
top-level scalar on its own line (`status: in_progress`), and multi-line
`description` values as `|-` block scalars. Full round-trip including
`<validation-steps>` blocks verified.[^2]

Size impact: the `yaml` package is ~160 KB; the binary is compiled with
`bun build --compile` and bundles all dependencies, so the addition is a
one-time binary-size increase with no runtime dependency.

[^1]: Empirically verified: `bun -e "import {YAML} from 'bun'; console.log(YAML.stringify({status: 'in_progress', description: 'a\nb'}))"` outputs `{status: in_progress,description: "a\nb"}`.

[^2]: Empirically verified: `yaml@2.9.0` stringify of a full TaskRecord-like object yields `status: in_progress` on its own line; `description` uses `|-` block scalar; round-trip `JSON.stringify(obj) === JSON.stringify(parse(stringify(obj)))` is true.

---

### Q2 — How the shell hooks parse YAML (the riskiest part)

**Recommendation: `grep`/`sed`/`awk` against top-level flat scalar lines. No `yq`. No MCP binary shelling-out.**

**Why this is safe:** The flat MCP store files are only read by the hooks for three
fields:

| Hook                                         | Fields read from flat store (`*.yaml`) |
| -------------------------------------------- | -------------------------------------- |
| `count_in_progress_flat` (task-store-lib.sh) | `status` only                          |
| 0-or-1 scan (task-invariant.sh)              | `status`, `id`, `subject`              |

The `description` field is **never read from flat store files**. `task-invariant.sh`
reads `description` only from the **legacy per-session store**
(`$TASKS_DIR/${TASK_ID}.json`), which stays JSON (it is written by the
built-in `TaskCreate`/`TaskUpdate` tools, outside this change's scope).

With the `yaml` npm package's block-style output, these three fields appear as
unambiguous `^key: value` lines at column 0. YAML block-scalar content (for
`description`) is indented by 2+ spaces and therefore cannot falsely match a
`^status: ` or `^id: ` grep anchored to column 0.

Specific replacements:

```bash
# status (unquoted scalar: "pending" / "in_progress" / "completed")
f_status="$(grep -m1 '^status: ' "$f" 2>/dev/null | awk '{print $2}')"

# id (yaml quotes numeric-looking strings: id: "1")
f_id="$(grep -m1 '^id: ' "$f" 2>/dev/null | sed 's/^id: //; s/^"//; s/"$//')"

# subject (may contain spaces; yaml quotes if it contains ":" "#" etc.)
f_subj="$(grep -m1 '^subject: ' "$f" 2>/dev/null | sed 's/^subject: //; s/^"//; s/"$//')"
```

Edge cases verified:

- `status:` inside a description block scalar is indented (2+ spaces) — `^status: ` does not match it.
- Subjects containing YAML-special chars get double-quoted by the `yaml` package; the `sed` strip handles that.
- `id` values like `"1"`, `"10"` are quoted by `yaml` because they look like integers; the `sed` strip removes the quotes.

---

### Q3 — Migration / backward compatibility

**Recommendation: Hard cutover to `.yaml`. No dual-read transition code.**

The repo owner controls all instances (this plugin is not yet widely distributed
beyond the owner's repos) and will separately migrate existing `.json` task files.
Dual-read adds two code paths in `listIds`, `read`, and `filePath` that become
dead code immediately after migration. KISS/YAGNI apply. Version bump to 0.1.4
signals the breaking format change.

---

### Q4 — Multi-line `description` field

The `yaml` npm package serializes multi-line strings as `|-` block scalars
(verified with a description containing a `<validation-steps>` block). The
round-trip is lossless. The shell hooks' `parse_validation_steps` awk function
reads from a bash variable (`$EFFECTIVE_DESC`), which is populated from the
**legacy JSON store** (unchanged) — so hook parsing of `<validation-steps>` is
unaffected by this change.

---

## Files changed

| File                                | Change                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `mcp/src/store.ts`                  | Import `yaml`, change extension `.json`→`.yaml`, use `yaml.parse`/`yaml.stringify` |
| `mcp/package.json`                  | Add `yaml` dependency, bump version `0.1.3`→`0.1.4`                                |
| `mcp/src/server.ts`                 | Bump `SERVER_VERSION` `"0.1.3"`→`"0.1.4"`                                          |
| `hooks/task-store-lib.sh`           | Change `*.json` glob and `jq` call in `count_in_progress_flat`                     |
| `hooks/task-invariant.sh`           | Change `*.json` glob and `jq` calls in the 0-or-1 flat-store scan                  |
| `mcp/test/store.test.ts`            | Update `.json` references → `.yaml`, update `JSON.parse` → `yaml.parse`            |
| `mcp/test/integration.test.ts`      | Update `.json` file existence checks and `JSON.parse` reads                        |
| `mcp/test/hook-integration.test.sh` | Update file checks and field extraction                                            |
| `.claude-plugin/plugin.json`        | Bump version `0.1.3`→`0.1.4`                                                       |
| `skills/mcp-task-tools/SKILL.md`    | Update `<id>.json` → `<id>.yaml` in Storage section                                |
| `skills/manage-tasks/SKILL.md`      | Update `<id>.json` → `<id>.yaml` in MCP fallback note (§5)                         |

`validation-steps.ts`, `tasks.ts`, `git-helper.ts` require **no changes** — they
do not interact with the file extension or serialization format directly.

---

## Phase 1 — MCP server (store.ts + package.json + TS tests)

**Goal:** MCP server reads and writes `.yaml` files. TS unit and integration tests pass.

### 1a. Add `yaml` dependency

```
cd plugins/claude-code/task-utils/mcp
bun add yaml
```

This updates `package.json` (`dependencies`) and `bun.lock`.

### 1b. Update `store.ts`

- Add at top: `import { parse as yamlParse, stringify as yamlStringify } from "yaml";`
- `filePath(id)`: return `join(this.root, \`\${id}.yaml\`)`(was`.json`)
- `listIds()`: filter `f.endsWith(".yaml")`, strip last 5 chars (was `.json` / 5 chars — length is same, no change in slice offset)
- `read(id)`: `yamlParse(readFileSync(path, "utf8"))` (was `JSON.parse(...)`)
- `write(task)`: `writeFileSync(path, yamlStringify(task), "utf8")` — note: no trailing newline needed since `yamlStringify` adds one; confirm empirically. Remove the `\n` suffix added to the JSON output.

### 1c. Update `mcp/test/store.test.ts`

- `"write creates a flat <id>.json file"` → assert `filePath("7")` ends with `7.yaml` and `listIds()` returns `["7"]` — the assertion string in test name changes to `.yaml`.
- The `read` round-trip test does not touch the file format directly (goes through `store.write`/`store.read`) — no change needed.
- No JSON.parse calls in store.test.ts — no other changes.

### 1d. Update `mcp/test/integration.test.ts`

Three changes:

1. `"task_create writes a flat <id>.json file"` test name + assertion: `join(storeDir, "1.json")` → `"1.yaml"`; `JSON.parse(readFileSync(file, "utf8"))` → use `yamlParse` (add import for `yaml`)
2. `existsSync(join(storeDir, "2.json"))` → `"2.yaml"` (deleted-file test)
3. Test description strings mentioning `.json` → `.yaml`

### 1e. Bump `mcp/src/server.ts` SERVER_VERSION

`"0.1.3"` → `"0.1.4"`

**Phase 1 validation:**

```bash
mise run build-task-mcp
cd plugins/claude-code/task-utils/mcp && bun test
```

All unit + integration tests must pass. Confirm `.yaml` files are written to `storeDir` in integration test (not `.json`).

---

## Phase 2 — Shell hooks + hook-integration test

**Goal:** `count_in_progress_flat` and the 0-or-1 scan in `task-invariant.sh` read `.yaml` files using `grep`/`awk`/`sed`.

**Prerequisite:** Phase 1 complete (the compiled binary now writes `.yaml`).

### 2a. Update `hooks/task-store-lib.sh` — `count_in_progress_flat`

```bash
# BEFORE (lines 52-56):
while IFS= read -r -d '' f; do
  f_status="$(jq -r '.status // empty' "$f" 2>/dev/null)"
  [[ "$f_status" == "in_progress" ]] && count=$((count + 1))
done < <(find "$store_root" -maxdepth 1 -name '*.json' -print0 2>/dev/null)

# AFTER:
while IFS= read -r -d '' f; do
  f_status="$(grep -m1 '^status: ' "$f" 2>/dev/null | awk '{print $2}')"
  [[ "$f_status" == "in_progress" ]] && count=$((count + 1))
done < <(find "$store_root" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null)
```

Also update the comment in task-store-lib.sh:

- Line 10: `<task-id>.json` → `<task-id>.yaml`
- Line 55: `*.json` → `*.yaml`

### 2b. Update `hooks/task-invariant.sh` — 0-or-1 flat-store scan

Lines 217-228:

```bash
# BEFORE:
done < <(find "$scan_dir" -maxdepth 1 -name '*.json' -print0 2>/dev/null)
# with:
f_id="$(jq -r '.id // empty' "$f" 2>/dev/null)"
f_status="$(jq -r '.status // empty' "$f" 2>/dev/null)"
f_subj="$(jq -r '.subject // empty' "$f" 2>/dev/null)"

# AFTER:
done < <(find "$scan_dir" -maxdepth 1 -name '*.yaml' -print0 2>/dev/null)
# with:
f_id="$(grep -m1 '^id: ' "$f" 2>/dev/null | sed 's/^id: //; s/^"//; s/"$//')"
f_status="$(grep -m1 '^status: ' "$f" 2>/dev/null | awk '{print $2}')"
f_subj="$(grep -m1 '^subject: ' "$f" 2>/dev/null | sed 's/^subject: //; s/^"//; s/"$//')"
```

Also update comments in task-invariant.sh mentioning `.json` for the flat store.

### 2c. Update `mcp/test/hook-integration.test.sh`

- Line 63: `[[ -f "$TASKDIR/1.json" ]]` → `"$TASKDIR/1.yaml"`; pass string `"$TASKDIR/1.yaml"` in pass message
- Line 66: fail message → `.yaml`
- Line 78: `STATUS="$(jq -r '.status' "$TASKDIR/1.json")"` →
  ```bash
  STATUS="$(grep -m1 '^status: ' "$TASKDIR/1.yaml" 2>/dev/null | awk '{print $2}')"
  ```
- Line 125: `NEWID="$(jq -rs 'map(.id) | sort_by(tonumber) | last' "$TASKDIR"/*.json)"` →
  ```bash
  NEWID="$(for f in "$TASKDIR"/*.yaml; do grep -m1 '^id: ' "$f"; done | sed 's/^id: //; s/^"//; s/"$//' | sort -n | tail -1)"
  ```
- Line 135: The legacy `.json` file (`"$LEGACY_DIR/99.json"`) stays JSON — **no change**. This tests the legacy store which is always JSON.

**Phase 2 validation:**

```bash
mise run build-task-mcp
bash plugins/claude-code/task-utils/mcp/test/hook-integration.test.sh
```

All 7 tests must pass.

---

## Phase 3 — Skills and docs

**Goal:** Remove all mentions of `.json` for task files in user-facing documentation.

### 3a. `skills/mcp-task-tools/SKILL.md`

In the Storage section (near bottom): `<id>.json` → `<id>.yaml`.

The full sentence: _"Tasks are stored FLAT at `<store-root>/<id>.json`"_ → _"Tasks are stored FLAT at `<store-root>/<id>.yaml`"_.

### 3b. `skills/manage-tasks/SKILL.md`

In §5 "MCP fallback" paragraph: `<id>.json` → `<id>.yaml`.

The sentence: _"The MCP server writes flat task files at `<repo>/.claude/tasks/<id>.json`"_ → `<id>.yaml`.

### 3c. `docs/` and `README.md`

Search for any remaining `.json` references to flat task files:

```bash
grep -rn '\.json' plugins/claude-code/task-utils/ \
  --include="*.md" \
  --exclude-dir=node_modules
```

Update any that reference task storage files. References to the legacy per-session store (`.claude/tasks/<session_id>/<id>.json`) stay unchanged — that store is not being changed.

**Phase 3 validation:** Visual review and grep confirm no stale `.json` references remain in docs/skills for the flat store.

---

## Phase 4 — Version bump

**Goal:** All version fields updated to `0.1.4`.

- `mcp/package.json`: `"version": "0.1.4"` (already done in Phase 1 when adding `yaml` dep, or explicitly here)
- `mcp/src/server.ts`: `SERVER_VERSION = "0.1.4"` (done in Phase 1e)
- `.claude-plugin/plugin.json`: `"version": "0.1.4"`

**Phase 4 validation:**

```bash
mise run check
```

Full check (lint + test) must pass cleanly.

---

## Summary of grep/sed patterns to verify during implementation

These are the exact patterns used in the shell hooks after the change. Verify each against a sample `.yaml` task file produced by Phase 1:

| Field                     | YAML output                  | grep/sed/awk command                                              | Expected result   |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------- | ----------------- |
| `status`                  | `status: in_progress`        | `grep -m1 '^status: ' f \| awk '{print $2}'`                      | `in_progress`     |
| `id`                      | `id: "1"`                    | `grep -m1 '^id: ' f \| sed 's/^id: //; s/^"//; s/"$//'`           | `1`               |
| `subject`                 | `subject: Fix the thing`     | `grep -m1 '^subject: ' f \| sed 's/^subject: //; s/^"//; s/"$//'` | `Fix the thing`   |
| `subject` (special chars) | `subject: "fix: the #thing"` | same                                                              | `fix: the #thing` |

---

## What does NOT change

- `TaskRecord` interface (store.ts) — no schema changes
- `tasks.ts`, `server.ts`, `validation-steps.ts`, `git-helper.ts` — no changes
- Legacy per-session store (`~/.claude/tasks/<session_id>/<id>.json`) — stays JSON; the built-in Task tools write it, outside this plugin's scope
- `hooks/require-task-in-progress.sh` — no direct changes (delegates to `count_in_progress_flat` in task-store-lib.sh)
- `hooks/hooks.json` — no changes
- `.mcp.json`, `mcp/build.sh`, `mcp/launch.sh` — no changes
- `mise.toml` build/test tasks — no changes

---

## References

- [Bun 1.3 release notes — YAML built-in](https://bun.sh/blog/bun-v1.3) — confirms `Bun.YAML` available since Bun 1.1, but does not document style (flow vs. block)
- [yaml npm package docs](https://eemeli.org/yaml/) — block-style serialization by default for multi-line strings
- [YAML 1.2 spec — block scalars](https://yaml.org/spec/1.2.2/#8112-block-chomping-indicator) — `|-` literal block scalar strips trailing newlines
