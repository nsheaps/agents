# Monorepo conventions

This repository is an nx + bun + TypeScript monorepo. nx orchestrates per-project tasks; bun provides workspaces, runtime, and the package manager; TypeScript is the implementation language. Plugin manifest validation is part of the same `nx run-many` fan-out — it lives in the `@nsheaps/agents-plugins` workspace package's `test` script.

## Layout

| Directory    | Purpose                                                                                                  | Publish target                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/*` | Shared libraries consumed by other workspace packages and external users.                                | npm public registry as `@nsheaps/<name>`                                                    |
| `lib/*`      | Internal utility libraries used across the monorepo.                                                     | npm public registry as `@nsheaps/<name>`                                                    |
| `services/*` | Deployable services (daemons, web servers, controllers).                                                 | Container images at `ghcr.io/nsheaps/<name>`. `"private": true` to block npm publish.       |
| `plugins`    | Claude Code + opencode plugins. Single workspace package (`@nsheaps/agents-plugins`, `"private": true`). | Plugin marketplace via its nx `release` target (see [Releases](#releases)). No npm publish. |
| `apps/*`     | CLI apps and other end-user-facing binaries.                                                             | Distribution varies (homebrew, ghcr.io, npm CLI bin) — declared per app.                    |

`packages/*`, `services/*`, `lib/*`, and `plugins` are workspace entries in the root `package.json`. `apps/`, `agents/`, `templates/`, and the rest are managed outside nx.

## Naming

| Aspect          | Rule                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm name        | `@nsheaps/<package-dir-basename>` — the directory name and the unscoped npm name must match.                                                     |
| Container image | `ghcr.io/nsheaps/<package-dir-basename>` — same basename, no scope.                                                                              |
| Directory name  | Kebab-case. Library packages start with the role noun (`agent-api`, `agent-ui`). Internal libs may use any descriptive name (`agents-pg-utils`). |

This 1-to-1 mapping between directory basename, npm name, and container image is intentional — it makes publishing scripts and CI lookups trivial.

## Required scripts

Every workspace package defines a subset of these scripts so nx can orchestrate them uniformly. The `lint` / `format` pair are mandatory; `build` / `test` are added where they apply.

| Script    | Behavior                                                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint`    | Read-only verification. Runs every check (e.g. `prettier --check . && tsc --noEmit`). Never writes. The safe gate for CI.                                                                                                                                                                                |
| `format`  | Apply every auto-fixer (e.g. `prettier --write`) **then** re-run the exact same checks `lint` runs. Writes files AND can still fail on non-fixable checks (e.g. type errors).                                                                                                                            |
| `build`   | Type-check and emit. `tsc -b` against the package's `tsconfig.json`. TS packages only.                                                                                                                                                                                                                   |
| `test`    | TS packages: `bun test --pass-with-no-tests`. `@nsheaps/agents-plugins`: `claude plugin validate` over each `plugins/claude-code/*` (delegated via `mise run validate`).                                                                                                                                 |
| `release` | Publish the module. Defined only on modules that actually release: `root` → `release-it --ci` (GitHub release + Homebrew); `@nsheaps/agents-plugins` → `plugins/release.sh` (version bump + `marketplace.json`). Driven by `release.yaml` via `nx affected --target=release`. See [Releases](#releases). |

### Why `format` runs every check

The shape is **`format = <fixers> + <same checks as lint>`**. The user-facing behaviour:

- If everything was already clean, `format` is a no-op that passes.
- If only auto-fixable issues exist, `format` writes the fixes and the post-write check passes.
- If a non-fixable issue exists (e.g. a TypeScript error, a plugin manifest with a bad field, a shell-script syntax error), `format` may still write whatever was fixable and **fail**.

This is what makes the autofix CI workflow safe: run `mise run format`, auto-commit any writes, and let the workflow fail when something the fixers can't repair is still broken. There's no `format-check` / `lint-check` alias pair — the autofix path uses `format`, the read-only gate uses `lint`.

nx auto-detects these scripts from `package.json`. No per-package `project.json` is required.

## How to add a new workspace package

1. Create the directory under `packages/`, `lib/`, or `services/`.
2. Add a `package.json` matching the template below.
3. Add a `tsconfig.json` extending `tsconfig.base.json`.
4. Add `src/index.ts` (and any other entry points listed in `exports`).
5. Run `bun install` at the repo root so bun picks up the new workspace.
6. Verify nx discovers it: `bunx nx show projects` should list the new package.

### `package.json` template (library — publishable)

```jsonc
{
  "name": "@nsheaps/<basename>",
  "version": "0.0.0",
  "description": "...",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  },
  "files": ["dist", "src", "README.md"],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/",
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/nsheaps/agent-team.git",
    "directory": "packages/<basename>",
  },
  "license": "UNLICENSED",
  "scripts": {
    "format": "prettier --write . --ignore-path ../../.prettierignore && tsc --noEmit",
    "lint": "prettier --check . --ignore-path ../../.prettierignore && tsc --noEmit",
    "build": "tsc -b",
    "test": "bun test --pass-with-no-tests",
  },
}
```

> **`private: true` until there are real exports.** New library packages should be created with `"private": true` even when they declare `publishConfig`. Keep them private while `src/index.ts` is only `export {};` — that way an accidental publish step can't ship an empty package to npm. When the package has real exports, drop `private` and the `publishConfig` registry/access already declared takes over.

### `package.json` template (service — private)

Same as the library template, but:

- Add `"private": true`.
- Drop `publishConfig`, `files`, and (optionally) the `exports` map — services aren't consumed as packages.
- The service ships as a container image at `ghcr.io/nsheaps/<basename>`; the build pipeline for that lives in `.github/workflows/` (separate from nx).

### `tsconfig.json` template

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
  },
  "include": ["src/**/*"],
}
```

For browser packages, add `"lib": ["ESNext", "DOM"]` to `compilerOptions`.

## The root project

The repo root is itself registered as an nx project (named `root`) via the `nx` block in the top-level `package.json`. Its job is the repo-level slice of work that doesn't belong to any workspace package:

- repo-root markdown (`README.md`, `ARCHITECTURE_DRAFT.md`, `docs/**`, `agents/**`, `apps/**`, `templates/**`, `.claude/**`, etc.)
- shell-script syntax sweep (`bin/*`, `bin/lib/*.sh` via `scripts/lint-shell.sh`)

To keep `nx run-many` parallelisation safe, the root project's prettier scripts pass **both** ignore files:

```
prettier --check "**/*.md" --ignore-path .prettierignore --ignore-path .prettierignore-root
```

`.prettierignore-root` contains `packages/`, `services/`, `lib/`, `plugins` — so the root target never touches files that a workspace-package target will also format. Each workspace package's prettier runs from its own directory and uses only `.prettierignore` (without `-root`), so it formats its own files without exclusion. The result: zero overlap between root and per-package targets, and nx can fan them out in parallel.

The root project has only `format` and `lint`. Workspace packages add `build` (TS only) and `test` (TS + plugins). When `nx run-many --target=build` runs, root and plugins are silently skipped (no target).

## The plugins package

`plugins/` is registered as a single workspace package (`@nsheaps/agents-plugins`, private). Three scripts:

- `format`: `prettier --write . --ignore-path ../.prettierignore` (the plugins' own README/JSON/yaml files).
- `lint`: `prettier --check . --ignore-path ../.prettierignore`.
- `test`: `bash ./test.sh` — runs `claude plugin validate` over every `plugins/claude-code/*/.claude-plugin/plugin.json`. This is the canonical plugin gate; failures mean a plugin manifest is wrong or a referenced asset is missing. The script defers to `mise run validate` when mise is on PATH (CI does this via `jdx/mise-action`); otherwise it falls back to a direct sweep with `claude plugin validate`, so `bunx nx run @nsheaps/agents-plugins:test` works in any environment that has `claude` available — no implicit mise dependency.

There's no `build` target — plugins ship via the marketplace pipeline in `cd.yaml`, not via tsc.

One package wrapping all plugins (vs one package per plugin) was a deliberate choice: validation already iterates over the whole `plugins/claude-code/*` set in a single `mise run validate` call, and per-plugin packages would multiply the workspace count without any nx benefit (no fan-out parallelism is possible — they all share `claude plugin validate`).

## How tasks flow

```
mise run <task>          (developer / CI entry point)
   └── bunx nx run-many --target=<task>
          ├── root       → bun run <task>  (root project scripts)
          ├── plugins    → bun run <task>  (plugins/package.json)
          └── workspaces → bun run <task>  (each TS workspace package)
```

The three layers are stable contracts:

- **mise** is a thin entry point. Every fan-out task body is a single `bunx nx run-many --target=<name>` call — no inline prettier, no inline shell-syntax check, no fallback bun invocations. 100% delegation to nx.
- **nx** owns orchestration: parallelism, caching, task graph (`build` depends on `^build`), affected-detection, and which projects implement a given target.
- **package scripts** own the actual work. They use the standard tools directly (prettier, tsc, bun test, `mise run validate`) so a single project can be operated on without nx (`bun run build` inside `packages/agent-api`, or `bun run lint` at the repo root, or `bun run test` inside `plugins/`).

Adding a new fan-out task is three steps:

1. Add a matching script in `package.json` for each project that should participate.
2. Add `[tasks.<name>]` to `mise.toml` with body `run = "bunx nx run-many --target=<name>"`.
3. If root participates, add the script name to `nx.includedScripts` in the root `package.json` so nx exposes it as a target.

## CI

`.github/workflows/test.yaml` has three jobs:

| Job     | Command                                                                 | Notes                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint`  | `mise run format` (via `.github/actions/lint-files` with `fix: 'true'`) | Auto-commits any writes back to the PR branch via `git-auto-commit-action`. Exits 1 if anything changed or any non-fixable check failed, so CI re-runs against the post-fix state. |
| `build` | `mise run build`                                                        | Runs in parallel with `test`.                                                                                                                                                      |
| `test`  | `mise run test`                                                         | Runs in parallel with `build`. Includes plugin validation via `@nsheaps/agents-plugins`'s test script.                                                                             |

`mise run lint` / `mise run format` / `mise run build` / `mise run test` are each a single `bunx nx run-many --target=<name>` call, so CI and local-dev go through the exact same chain.

`.github/workflows/cd.yaml` is now **preview-only**. On PRs it runs the `version-preview` job (sticky comment + `::notice` annotations on each affected `plugin.json`) showing the plugin bumps a merge will produce, and never pushes to the PR branch (which avoids cross-PR `marketplace.json` conflicts). The actual bump + `marketplace.json` regen runs on merge to `main` as the `@nsheaps/agents-plugins` module's nx `release` target — see [Releases](#releases).

## Releases

Releases are **affected-driven** and follow the same nx fan-out pattern as the other targets. `.github/workflows/release.yaml` runs on push to `main` and:

1. resolves a base = the floating `last-released` tag (fallback `HEAD~1` on first run);
2. computes affected modules with a `release` target via `bunx nx show projects --affected --withTarget=release --base=last-released`;
3. runs `bunx nx affected --target=release --base=last-released --parallel=1`;
4. opens the Homebrew formula PR **only when `root` is affected**;
5. on success, moves `last-released` to the released commit.

| Module                    | `release` script    | Publishes                                                                                            |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `root`                    | `release-it --ci`   | `vX.Y.Z` GitHub release + `agent-team` / `claude-team` Homebrew formulas (which ship only `bin/**`). |
| `@nsheaps/agents-plugins` | `bash ./release.sh` | Per-plugin version bumps + `.claude-plugin/marketplace.json`.                                        |

Each `release` script is **self-contained** (does its own commit/push), so `nx affected --target=release` can run modules independently; `--parallel=1` serializes them because they share one working tree. The `release` target `dependsOn: ["build", "test", "lint", "^release"]`, so a module builds/tests/lints (and upstream deps release) before it releases.

Because a module only releases when it is affected, a `plugins/**`-only change no longer cuts an `agent-team` GitHub release or Homebrew PR — those formulas ship only `bin/**`, which a plugins change never touches. Modules without a `release` script (most `apps/*`, `packages/*`, `services/*`) are simply skipped until they declare one.

The floating tag is `last-released` (it superseded the old `cd/last-release` tag).

## nx configuration notes

- `nx.json` defines `targetDefaults` with caching for `build`, `test`, and `lint`. `format` is uncached (it writes files in place).
- `build` declares `dependsOn: ["^build"]` so dependent packages build first.
- `defaultBase: "main"` — used by `nx affected`.
- nx cache lives in `.nx/cache` and is gitignored.
- The root project is registered via `nx.name = "root"` + `nx.includedScripts = ["format", "lint"]` in the root `package.json`. `includedScripts` restricts which package.json scripts become nx targets — without it, every script (including helper scripts that shouldn't be fanned out) would be exposed.

## When to use `nx affected` vs `nx run-many`

- CI defaults to `run-many` so every change runs every check. With small workspace counts this is cheap.
- For local incremental work, `bunx nx affected --target=test` only runs tests for packages touched since `main`.
- For PRs that touch only one or two packages, switching CI to `affected` later is a one-line change once the workspace is large enough to benefit.
