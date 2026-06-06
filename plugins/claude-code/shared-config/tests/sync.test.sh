#!/usr/bin/env bash
# Hermetic test for shared_config_sync.py — no network.
#
# Builds local fixture git repos, runs the orchestrator for two separate
# "projects", and asserts:
#   - source repos are cloned into the shared cache (one clone per repo)
#   - <project>/.claude/{rules,skills,commands,agents}/.shared symlinks exist
#   - a source repo's .claude/shared-config-roots.yaml sourceDir override works
#   - the GitHub uses:-style subpath (org/repo/sub) selects the source dir
#   - the dedup hypothesis: the SAME rule file is reachable from both projects
#     and resolves (realpath) to the SAME source clone file.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${HERE}/../scripts/shared_config_sync.py"
PYBIN="$(command -v python3 || command -v python)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

GIT_BASE="${WORK}/remotes"
DATA="${WORK}/data"
mkdir -p "$GIT_BASE" "$DATA"

pass=0
fail=0
check() { # check <desc> <test-expr...>
  local desc="$1"; shift
  if "$@"; then echo "  ok: $desc"; pass=$((pass+1));
  else echo "  FAIL: $desc"; fail=$((fail+1)); fi
}

git_init_fixture() { # git_init_fixture <path>
  local d="$1"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  git -C "$d" config commit.gpgsign false
  git -C "$d" config tag.gpgsign false
  git -C "$d" add -A
  git -C "$d" commit -q --no-gpg-sign -m init
}

# --- Fixture A: resources at repo root (default source dir) -----------------
A="${GIT_BASE}/acme/shared-a"
mkdir -p "$A"/{rules,skills/demo-skill,commands,agents}
echo "# rule alpha" > "$A/rules/alpha.md"
echo "---"$'\n'"name: demo-skill"$'\n'"---"$'\n'"demo" > "$A/skills/demo-skill/SKILL.md"
echo "# cmd" > "$A/commands/do-thing.md"
echo "# agent" > "$A/agents/helper.md"
git_init_fixture "$A"

# --- Fixture B: resources under .claude/ (source-side roots override) -------
B="${GIT_BASE}/acme/shared-b"
mkdir -p "$B/.claude/rules" "$B/.claude/skills/b-skill"
echo "# rule beta" > "$B/.claude/rules/beta.md"
printf -- '---\nname: b-skill\n---\n' > "$B/.claude/skills/b-skill/SKILL.md"
cat > "$B/.claude/shared-config-roots.yaml" <<'YAML'
sourceDir: .claude
YAML
git_init_fixture "$B"

run_for_project() { # run_for_project <project-dir>
  local proj="$1"
  mkdir -p "$proj/.claude"
  cat > "$proj/.claude/shared-config.settings.yaml" <<'YAML'
enabled: true
sources:
  - acme/shared-a
  - acme/shared-b
YAML
  SHARED_CONFIG_TEST_GIT_BASE="$GIT_BASE" \
  CLAUDE_PROJECT_DIR="$proj" \
  CLAUDE_PLUGIN_DATA="$DATA" \
  "$PYBIN" "$PY" >/dev/null 2>"$proj/.stderr" || { echo "run failed:"; cat "$proj/.stderr"; return 1; }
}

PROJ_A="${WORK}/projA"; PROJ_B="${WORK}/projB"
echo "== run project A =="
run_for_project "$PROJ_A"
echo "== run project B =="
run_for_project "$PROJ_B"

echo "== assertions =="
check "source A cloned once" test -d "$DATA/shared-configs/sources/acme/shared-a/.git"
check "source B cloned once" test -d "$DATA/shared-configs/sources/acme/shared-b/.git"

check "projA rules/.shared is a symlink" test -L "$PROJ_A/.claude/rules/.shared"
check "projA skills/.shared is a symlink" test -L "$PROJ_A/.claude/skills/.shared"
check "projA commands/.shared is a symlink" test -L "$PROJ_A/.claude/commands/.shared"
check "projA agents/.shared is a symlink" test -L "$PROJ_A/.claude/agents/.shared"

# Resource files reachable through the link tree.
check "projA alpha rule reachable" test -f "$PROJ_A/.claude/rules/.shared/acme__shared-a/alpha.md"
check "projA beta rule reachable (sourceDir override)" test -f "$PROJ_A/.claude/rules/.shared/acme__shared-b/beta.md"
check "projA demo skill reachable" test -f "$PROJ_A/.claude/skills/.shared/acme__shared-a/demo-skill/SKILL.md"

# Dedup hypothesis: same realpath from both projects.
RA="$(realpath "$PROJ_A/.claude/rules/.shared/acme__shared-a/alpha.md")"
RB="$(realpath "$PROJ_B/.claude/rules/.shared/acme__shared-a/alpha.md")"
check "alpha.md resolves to same realpath across projects" test "$RA" = "$RB"
check "shared realpath lives in source clone" test "$RA" = "$(realpath "$DATA/shared-configs/sources/acme/shared-a/rules/alpha.md")"

# Idempotency: a second run for project A must not error or duplicate.
run_for_project "$PROJ_A"
check "rerun keeps alpha reachable" test -f "$PROJ_A/.claude/rules/.shared/acme__shared-a/alpha.md"

# Subpath (uses:-style) selects source dir: link acme/shared-b/.claude as a source.
PROJ_C="${WORK}/projC"; mkdir -p "$PROJ_C/.claude"
cat > "$PROJ_C/.claude/shared-config.settings.yaml" <<'YAML'
enabled: true
sources:
  - acme/shared-b/.claude
YAML
SHARED_CONFIG_TEST_GIT_BASE="$GIT_BASE" CLAUDE_PROJECT_DIR="$PROJ_C" CLAUDE_PLUGIN_DATA="$DATA" \
  "$PYBIN" "$PY" >/dev/null 2>"$PROJ_C/.stderr" || { echo "projC failed"; cat "$PROJ_C/.stderr"; }
check "projC subpath beta rule reachable" test -f "$PROJ_C/.claude/rules/.shared/acme__shared-b__.claude/beta.md"

# shared-lib boundary: SHARED_CONFIG_LIB_JSON (what the hook passes from
# plugin-config-read.sh) is honored, and its sources UNION with a standalone
# overlay. Also checks scalar coercion (mergeSettings as a string).
PROJ_D="${WORK}/projD"; mkdir -p "$PROJ_D/.claude"
cat > "$PROJ_D/.claude/shared-config.settings.yaml" <<'YAML'
sources:
  - acme/shared-b
YAML
SHARED_CONFIG_TEST_GIT_BASE="$GIT_BASE" \
SHARED_CONFIG_LIB_JSON='{"enabled":"true","mergeSettings":"false","resourceTypes":["rules"],"sources":["acme/shared-a"]}' \
CLAUDE_PROJECT_DIR="$PROJ_D" CLAUDE_PLUGIN_DATA="$DATA" \
  "$PYBIN" "$PY" >/dev/null 2>"$PROJ_D/.stderr" || { echo "projD failed"; cat "$PROJ_D/.stderr"; }
check "projD lib-json source (shared-a) linked" test -f "$PROJ_D/.claude/rules/.shared/acme__shared-a/alpha.md"
check "projD standalone source (shared-b) unioned" test -f "$PROJ_D/.claude/rules/.shared/acme__shared-b/beta.md"
# resourceTypes from lib limited to rules -> no skills link created
check "projD resourceTypes honored (no skills .shared)" test ! -e "$PROJ_D/.claude/skills/.shared"

echo ""
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
