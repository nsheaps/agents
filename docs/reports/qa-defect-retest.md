# QA Defect Re-Test Report — Daffy D (qa)

**Date**: 2026-02-17
**Reviewer**: Daffy Duck (Quality Assurance)
**Scope**: Re-test DEF-1, DEF-2, DEF-3 after Bugs Bunny's fixes

---

## DEF-1 [HIGH]: `--dry-run` truncates CLI args at 80 chars

**Fix commit**: `51d0f16` — "fix: remove CLI arg truncation in --dry-run and launch output"
**Test**: `bun bin/agent-launch.ts --dry-run --team-name test-team quality-assurance`

**Result**: **PASS**

The `--append-system-prompt` argument is fully output — all 4450 chars of the quality-assurance agent's prompt body are visible, including multi-line content with single-quote escaping. No truncation at 80 chars. The command output is copy-pasteable.

**Evidence**: Full output saved to `.claude/tmp/test-dryrun.txt` — 124 lines, prompt fully visible.

---

## DEF-2 [MEDIUM]: `agentFilter` positional arg parsing is fragile

**Fix commit**: `3962e7b` — "fix: replace fragile agentFilter heuristic with node:util parseArgs"
**Tests**:
1. `bun bin/agent-launch.ts software-eng` — filter in default discover mode
2. `bun bin/agent-launch.ts launch software-eng --team-name test-team` — subcommand + filter + flag

**Result**: **PASS**

Test 1: Correctly filtered to show only `software-eng` in discover mode output.
Test 2: Correctly parsed `launch` as subcommand, `software-eng` as agent filter, and `--team-name test-team` as flag. The launch output shows the correct agent (Bugs Bunny's prompt).

**Implementation review**: Uses `node:util` `parseArgs` with `allowPositionals: true` and `strict: false`. Subcommand detection checks first positional against `SUBCOMMANDS` array. Agent filter is `positionals[1]` if subcommand present, `positionals[0]` otherwise. This is a clean, standard approach.

**Evidence**: Output saved to `.claude/tmp/test-filter.txt` and `.claude/tmp/test-subcommand-filter.txt`.

---

## DEF-3 [MEDIUM]: Ambiguous duplicate agent name error in `discover.ts:199`

**Fix commit**: `1fd5ac1` — "fix: clarify duplicate agent name error message (#143)"
**Test**: Created `.claude/agents/_test-dup.md` with `name: software-eng`, ran discover.

**Result**: **PASS**

Error message now reads:
```
ERROR [software-eng.md]: Duplicate agent name 'software-eng': 'software-eng.md' conflicts with already-loaded '_test-dup.md' (keeping '_test-dup.md')
```

This explicitly states:
- Which file is being rejected (`software-eng.md`)
- Which file was already loaded (`_test-dup.md`)
- Which file is kept (`_test-dup.md`)

The old message was ambiguous about which file was kept. The new message is unambiguous.

**Note**: Files are processed in sorted order, so `_test-dup.md` sorts before `software-eng.md` and is loaded first. The alphabetical-first file wins. This behavior is deterministic but could surprise users if they expect filename priority — documenting this would be helpful.

**Cleanup**: Test file `_test-dup.md` removed after testing.

---

## Summary

| Defect | Severity | Fix Commit | Test Result |
|--------|----------|------------|-------------|
| DEF-1  | HIGH     | `51d0f16`  | **PASS**    |
| DEF-2  | MEDIUM   | `3962e7b`  | **PASS**    |
| DEF-3  | MEDIUM   | `1fd5ac1`  | **PASS**    |

**All 3 defects verified fixed.** No regressions observed in default discover mode.

### Minor observation (not a defect)

DEF-3: Duplicate name resolution is alphabetical (sorted glob order). The first file alphabetically wins. This is documented in the error message ("already-loaded") but could be called out in docs or `--help` for users who might wonder why `_test-dup.md` beat `software-eng.md`.
