#!/usr/bin/env bash
# claude-patch.sh — shared helpers for resolving + patching the claude
# binary. bin/claude is the ONLY caller that patches; bin/agent simply
# exec's `claude` (which PATH-resolves to bin/claude via direnv).
#
# Caller MUST set $REPO_DIR before invoking these helpers.
#
# Versioning + uniqueness model (Nate, Discord 2026-05-06 04:58Z):
# Each launch writes a UNIQUE patched binary at
#   $REPO_DIR/bin/patched/<version>/claude.<epoch>
# and atomically relinks $REPO_DIR/bin/claude-patched -> that file.
# Old patched outputs are left on disk (cheap, gitignored, easy to roll back).
# bin/claude only re-patches when the symlink is missing/broken or its
# target's version doesn't match the current claude version. Unique
# per-launch outputs eliminate the "Text file busy" failure mode that
# happened when the prior claude process still had the old patched
# binary mmap'd during a rapid restart.

# Echo the mise-pinned claude binary path. Returns 1 if mise can't resolve.
# Don't fall back to PATH — bin/<repo>/claude is on PATH and would be a loop.
claude_patch_resolve_bin() {
  if [[ -z "${REPO_DIR:-}" ]]; then
    echo "ERROR: claude_patch_resolve_bin requires REPO_DIR to be set" >&2
    return 1
  fi
  local bin
  bin="$(cd "$REPO_DIR" && mise which claude 2>/dev/null)" || return 1
  [[ -x "$bin" ]] || return 1
  printf '%s' "$bin"
}

# Ensure the resolved claude binary is a real ELF, not the npm error-stub.
# claude-code ships its native binary via a postinstall (install.cjs) that
# copies the platform ELF (from the optional-dep subpackage
# @anthropic-ai/claude-code-linux-x64/claude) over bin/claude.exe. Under
# mise's `npm:` install the postinstall sometimes does NOT run, leaving
# claude.exe as an error-stub shell script ("Error: claude native binary not
# installed."). The patcher correctly rejects non-ELF input — which would
# otherwise silently fall back to a stale patched binary of an older version
# (see alex-tracker #763 / 2026-06-09 diagnosis). Running the postinstall
# materializes the ELF in place on the shared mise install path.
#
# Arg: $1 = the mise-resolved claude path (claude_patch_resolve_bin output).
# Returns 0 if the binary is (now) a real ELF, 1 + error on stderr otherwise.
# Idempotent: a no-op when the binary is already ELF.
claude_patch_materialize_elf() {
  local bin="$1"
  local resolved
  resolved="$(realpath "$bin" 2>/dev/null)" || resolved="$bin"
  # ELF magic = 0x7f 'E' 'L' 'F'. Bash command substitution drops bytes after
  # the first NUL, but ELF's first 4 bytes contain no NUL, so this compares
  # cleanly against the error-stub (which begins with "echo").
  if [[ "$(head -c4 "$resolved" 2>/dev/null)" == $'\x7fELF' ]]; then
    return 0
  fi
  # Non-ELF stub: locate the npm package dir (parent of bin/, holds install.cjs)
  # and run the postinstall to copy the platform ELF over claude.exe.
  local pkgdir
  pkgdir="$(cd "$(dirname "$resolved")/.." 2>/dev/null && pwd)" || {
    echo "ERROR: claude_patch_materialize_elf: cannot derive package dir from $resolved" >&2
    return 1
  }
  if [[ ! -f "$pkgdir/install.cjs" ]]; then
    echo "ERROR: claude_patch_materialize_elf: $resolved is not ELF and no install.cjs at $pkgdir — cannot materialize native binary" >&2
    return 1
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: claude_patch_materialize_elf: node not on PATH — cannot run $pkgdir/install.cjs" >&2
    return 1
  fi
  echo "[claude-patch] $resolved is a non-ELF stub — running $pkgdir/install.cjs to materialize native binary" >&2
  ( cd "$pkgdir" && node install.cjs ) >&2 || {
    echo "ERROR: claude_patch_materialize_elf: install.cjs failed for $pkgdir" >&2
    return 1
  }
  # Re-verify: the postinstall must have produced a real ELF.
  if [[ "$(head -c4 "$resolved" 2>/dev/null)" == $'\x7fELF' ]]; then
    echo "[claude-patch] native ELF materialized at $resolved" >&2
    return 0
  fi
  echo "ERROR: claude_patch_materialize_elf: install.cjs ran but $resolved is still not ELF" >&2
  return 1
}

# Extract the claude version from a mise-installed binary path.
# Mise layout: <mise-data>/installs/<plugin>/<version>/bin/claude
# Returns the version string (e.g. "2.1.128") or 1 on parse failure.
claude_patch_extract_version() {
  local bin="$1"
  local version
  version="$(basename "$(dirname "$(dirname "$bin")")")"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\. ]] || return 1
  printf '%s' "$version"
}

# Echo the per-version+per-launch patched-binary path. Requires REPO_DIR.
# Epoch is unique per launch so we never overwrite a binary in use (the
# "Text file busy" failure mode on rapid restarts).
claude_patch_path_for_version() {
  local version="$1"
  local epoch="$2"
  printf '%s' "$REPO_DIR/bin/patched/$version/claude.$epoch"
}

# Echo the stable symlink path that bin/claude exec's. Gitignored.
claude_patch_symlink_path() {
  printf '%s' "$REPO_DIR/bin/claude-patched"
}

# Extract the version from a patched-binary path. Layout is
# .../bin/patched/<version>/claude.<epoch>; the version is the parent
# directory's basename. Returns 1 if the path doesn't match the layout.
claude_patch_version_from_target() {
  local target="$1"
  local v
  v="$(basename "$(dirname "$target")")"
  [[ "$v" =~ ^[0-9]+\.[0-9]+\. ]] || return 1
  printf '%s' "$v"
}

# Resolve the claude-patch-channels patcher binary. Echoes path or returns 1.
# Prefers $PATH (mise activated) but falls back to the mise shim directly,
# so this works in pre-direnv contexts too.
claude_patch_resolve_patcher() {
  local p
  p="$(command -v claude-patch-channels 2>/dev/null)" || true
  if [[ -z "$p" ]]; then
    local shim="$HOME/.local/share/mise/shims/claude-patch-channels"
    if [[ -x "$shim" ]]; then
      p="$shim"
    else
      return 1
    fi
  fi
  printf '%s' "$p"
}
