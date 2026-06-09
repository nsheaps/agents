#!/usr/bin/env bash
# Offline tests for bin/setup-claude-web. Uses CLAUDE_WEB_SKIP_INSTALL=1 so
# no marketplace/plugin network calls happen — only the config resolution,
# deep-merge, and settings/plugins.settings.yaml writes are exercised.
#
# Run: bash tests/setup-claude-web.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/bin/setup-claude-web"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0
check() { # check <desc> <actual> <expected>
  if [ "$2" = "$3" ]; then
    printf 'ok   %s\n' "$1"
    pass=$((pass + 1))
  else
    printf 'FAIL %s\n     expected: %s\n     actual:   %s\n' "$1" "$3" "$2"
    fail=$((fail + 1))
  fi
}

# --- fixtures: base -> org -> role ------------------------------------
mkdir -p "$WORK/base" "$WORK/org" "$WORK/role"
cat > "$WORK/base/agent.yaml" <<EOF
marketplaces:
  ai-mktpl: nsheaps/ai-mktpl
plugins:
  - shared-lib@ai-mktpl
settings:
  permissions:
    allow: ["Bash(git status)"]
EOF
cat > "$WORK/org/agent.yaml" <<EOF
extends: $WORK/base
marketplaces:
  agents:
    source: github
    repo: nsheaps/agents
plugins:
  - 1pass@ai-mktpl
pluginSettings:
  mise:
    autoInstallTools: true
settings:
  permissions:
    allow: ["Bash(gh pr view)"]
EOF
cat > "$WORK/role/agent.yaml" <<EOF
extends: $WORK/org
name: jack
plugins:
  - dangerous-bypass@ai-mktpl
  - shared-lib@ai-mktpl
pluginSettings:
  github-app:
    ref: "op://Agent-Jack/x"
settings:
  model: opus
  permissions:
    allow: ["Bash(git push)"]
EOF

run() { # run <web 0|1> <config-dir> <upstream>
  local web="$1" dir="$2" up="$3"
  if [ "$web" = "1" ]; then
    CLAUDE_CODE_REMOTE=true CLAUDE_WEB_SKIP_INSTALL=1 CLAUDE_CONFIG_DIR="$dir" \
      bash "$SCRIPT" "$up" >/dev/null
  else
    env -u CLAUDE_CODE_REMOTE CLAUDE_WEB_SKIP_INSTALL=1 CLAUDE_CONFIG_DIR="$dir" \
      bash "$SCRIPT" "$up" >/dev/null
  fi
}

# --- non-web run ------------------------------------------------------
OUT="$WORK/out-local"
run 0 "$OUT" "$WORK/role"
S="$OUT/settings.local.json"
check "non-web writes settings.local.json" "$([ -f "$S" ] && echo yes)" "yes"
check "non-web does NOT write settings.json" "$([ -f "$OUT/settings.json" ] && echo yes || echo no)" "no"
check "plugins union + dedupe (3 unique)" "$(jq '.enabledPlugins|length' "$S")" "3"
check "shared-lib present once" "$(jq '.enabledPlugins["shared-lib@ai-mktpl"]' "$S")" "true"
check "permissions.allow union across 3 layers" "$(jq '.permissions.allow|length' "$S")" "3"
check "settings passthrough (model)" "$(jq -r .model "$S")" "opus"
check "marketplace string normalized to github" "$(jq -r '.extraKnownMarketplaces["ai-mktpl"].source.repo' "$S")" "nsheaps/ai-mktpl"
check "marketplace dict shorthand wrapped" "$(jq -r '.extraKnownMarketplaces["agents"].source.repo' "$S")" "nsheaps/agents"
PS="$OUT/plugins.settings.yaml"
check "plugins.settings.yaml merged (mise)" "$(python3 -c "import yaml;print(yaml.safe_load(open('$PS'))['mise']['autoInstallTools'])")" "True"
check "plugins.settings.yaml merged (github-app)" "$(python3 -c "import yaml;print(yaml.safe_load(open('$PS'))['github-app']['ref'])")" "op://Agent-Jack/x"

# --- web run ----------------------------------------------------------
OUTW="$WORK/out-web"
run 1 "$OUTW" "$WORK/role"
check "web writes settings.json" "$([ -f "$OUTW/settings.json" ] && echo yes)" "yes"

# --- idempotency + preserve unrelated keys ----------------------------
jq '. + {"theme":"dark"}' "$S" > "$S.tmp" && mv "$S.tmp" "$S"
run 0 "$OUT" "$WORK/role"
check "idempotent: still 3 plugins" "$(jq '.enabledPlugins|length' "$S")" "3"
check "idempotent: allow still 3" "$(jq '.permissions.allow|length' "$S")" "3"
check "preserves unrelated key (theme)" "$(jq -r .theme "$S")" "dark"

# --- single layer (no extends) ----------------------------------------
mkdir -p "$WORK/solo"
printf 'name: solo\nplugins: [mise@ai-mktpl]\n' > "$WORK/solo/agent.yaml"
run 0 "$WORK/solo-out" "$WORK/solo"
check "single-layer ok" "$(jq '.enabledPlugins|length' "$WORK/solo-out/settings.local.json")" "1"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
