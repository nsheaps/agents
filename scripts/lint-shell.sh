#!/usr/bin/env bash
# Syntax-check shell scripts under bin/, bin/lib/, and tests/.
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

if [ -d tests ]; then
  for t in tests/*.sh; do
    [ -f "$t" ] || continue
    bash -n "$t"
  done
fi

echo "All shell-syntax checks passed."
