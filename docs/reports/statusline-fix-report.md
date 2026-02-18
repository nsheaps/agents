# Statusline settings.json Corruption Fix Report

**Commit**: `bfe3214b` on `fix/statusline-direct-write` branch
**Repo**: nsheaps/ai-mktpl
**PR**: https://github.com/nsheaps/ai-mktpl/pull/164
**Author**: Bugs Bunny (Software Engineer)
**Date**: 2026-02-18

---

## 1. Root Cause

Both `statusline` and `statusline-iterm` plugins fire `configure-statusline.sh` on **two** hook events: `SessionStart` and `UserPromptSubmit`. With both plugins installed, that's 4 near-simultaneous writes to `~/.claude/settings.json`. Agent teams multiply this further.

Three race condition vectors cause corruption:

### Vector 1 — Shared tmp filename clobbering
Original code used a fixed `.tmp` suffix. Two processes writing to the same tmp file simultaneously corrupt each other's output.

### Vector 2 — Read-modify-write race
Both processes read settings.json at the same state, each applies its jq transform, last one to write wins — silently dropping the other's changes.

### Vector 3 — Truncation before write (THE MAIN CULPRIT)
PR #164's first attempt used `printf '%s\n' "$content" > "$SETTINGS_FILE"`. Shell `>` truncates the file to 0 bytes BEFORE writing new content. If the process is killed (or another process reads) between truncation and write completion → blank file. This is the primary cause of the blanking the user was seeing.

---

## 2. Files Changed

Two files, both on the `fix/statusline-direct-write` branch:

- `plugins/statusline/hooks/configure-statusline.sh` — full rewrite of write logic
- `plugins/statusline-iterm/hooks/configure-statusline.sh` — same rewrite

---

## 3. Fix Approach — `safe_write_settings()` function

Both files now use an identical `safe_write_settings()` function:

### mkdir-based POSIX lock
`mkdir "$lockdir"` is atomic on all POSIX filesystems. Only one process can create the directory; others spin-wait (0.1s intervals, 30 retries = ~3s timeout). This serializes all concurrent writes. Used `mkdir` instead of `flock` because **flock doesn't exist on macOS**.

### mktemp for unique tmp files
Each process creates `settings.json.XXXXXX` via `mktemp`. No cross-process clobbering possible.

### jq output validation
After jq transform, we verify:
- (a) tmp file is non-empty via `[ -s "$tmpfile" ]`
- (b) it's valid JSON via `jq empty "$tmpfile"`

If either check fails → skip the update, log warning to stderr, leave original file untouched.

### Atomic rename
`mv "$tmpfile" "$SETTINGS_FILE"` on the same filesystem is atomic. File is either old content or new content, never partially written or blank.

### Stale lock detection
If lock directory is older than 10 seconds (process crashed while holding lock), we clean it up and retry.

### Teammate skip guard
If `CLAUDE_CODE_PARENT_SESSION_ID` is set (spawned teammates), skip the entire hook with `echo '{}'; exit 0`. Only the lead or solo sessions configure statusline.

---

## 4. Bonus Catch

The statusline-iterm version still had a `flock`-based locking pattern from an earlier uncommitted attempt. Since `flock` doesn't exist on macOS, it would have silently failed on every invocation. Fixed to use the same mkdir pattern before committing.

---

## 5. Test Plan

- [ ] Start Claude Code session with both statusline plugins enabled — settings.json should not be blanked
- [ ] Run agent team session (multiple teammates) — no corruption from concurrent hook fires
- [ ] Kill process mid-hook — settings.json should remain intact (atomic rename)
- [ ] Verify stale lock cleanup works after forced kill
