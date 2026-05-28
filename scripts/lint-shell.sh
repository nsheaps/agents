#!/usr/bin/env bash
# Syntax-check shell scripts under bin/ and bin/lib/.
# Invoked by the root project's `lint` / `lint-check` package.json scripts,
# which are in turn invoked by `bunx nx run-many --target=lint` (called by
# `mise run lint`).
set -euo pipefail

echo "Checking shell scripts under bin/..."
for script in bin/*; do
  [ -d "$script" ] && continue
  [ -f "$script" ] || continue
  case "$script" in
    *.ts | *.js | *.py | *.rb | *.go) continue ;;
  esac
  bash -n "$script"
done

if [ -d bin/lib ]; then
  for lib in bin/lib/*.sh; do
    [ -f "$lib" ] || continue
    bash -n "$lib"
  done
fi

echo "All shell-syntax checks passed."
