# Monorepo conventions

This repository is an nx + bun + TypeScript monorepo. nx orchestrates per-package tasks; bun provides workspaces, runtime, and the package manager; TypeScript is the implementation language.

## Layout

| Directory    | Purpose                                                                   | Publish target                                                                               |
| ------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/*` | Shared libraries consumed by other workspace packages and external users. | npm public registry as `@nsheaps/<name>`                                                     |
| `lib/*`      | Internal utility libraries used across the monorepo.                      | npm public registry as `@nsheaps/<name>`                                                     |
| `services/*` | Deployable services (daemons, web servers, controllers).                  | Container images at `ghcr.io/nsheaps/<name>`. Marked `"private": true` to block npm publish. |
| `apps/*`     | CLI apps and other end-user-facing binaries.                              | Distribution varies (homebrew, ghcr.io, npm CLI bin) — declared per app.                     |
| `plugins/*`  | Claude Code plugins. Versioned and published via the plugin marketplace.  | Not part of the nx workspace — managed by the existing `cd.yaml` workflow.                   |

Only `packages/`, `services/`, and `lib/` are workspace globs in the root `package.json`. `apps/`, `plugins/`, `agents/`, `templates/`, and the rest are managed outside nx.

## Naming

| Aspect          | Rule                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm name        | `@nsheaps/<package-dir-basename>` — the directory name and the unscoped npm name must match.                                                     |
| Container image | `ghcr.io/nsheaps/<package-dir-basename>` — same basename, no scope.                                                                              |
| Directory name  | Kebab-case. Library packages start with the role noun (`agent-api`, `agent-ui`). Internal libs may use any descriptive name (`agents-pg-utils`). |

This 1-to-1 mapping between directory basename, npm name, and container image is intentional — it makes publishing scripts and CI lookups trivial.

## Required scripts

Every workspace package must define these scripts in its `package.json` so that nx can orchestrate them uniformly:

| Script         | Behavior                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| `format`       | Auto-fix formatting (currently `prettier --write . --ignore-path ../../.prettierignore`). |
| `format-check` | Check-only formatting (`prettier --check`).                                               |
| `lint`         | `format-check` + `tsc --noEmit`. Read-only. Safe for CI gates.                            |
| `build`        | Type-check and emit. `tsc -b` against the package's `tsconfig.json`.                      |
| `test`         | `bun test`.                                                                               |

nx auto-detects these scripts from `package.json` — no per-package `project.json` is required. Add a `project.json` only when a package needs nx-specific configuration (custom inputs, tags, implicit dependencies, etc.).

## How to add a new package

1. Create the directory under `packages/`, `lib/`, or `services/` depending on its purpose.
2. Create `package.json` matching the template below.
3. Create `tsconfig.json` extending `tsconfig.base.json`.
4. Create `src/index.ts` (and any other entry points listed in `exports`).
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
    "format": "prettier --write . --ignore-path ../../.prettierignore",
    "format-check": "prettier --check . --ignore-path ../../.prettierignore",
    "lint": "bun run format-check && tsc --noEmit",
    "build": "tsc -b",
    "test": "bun test",
  },
}
```

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

- repo-root markdown (`README.md`, `ARCHITECTURE_DRAFT.md`, `docs/**`, `plugins/**`, `agents/**`, `apps/**`, `templates/**`, `.claude/**`, etc.)
- shell-script syntax sweep (`bin/*`, `bin/lib/*.sh` via `scripts/lint-shell.sh`)

To keep `nx run-many` parallelisation safe, the root project's prettier scripts pass **both** ignore files:

```
prettier --check "**/*.md" --ignore-path .prettierignore --ignore-path .prettierignore-root
```

`.prettierignore-root` contains `packages/`, `services/`, `lib/` — so the root target never touches files that a workspace-package target will also format. Each workspace package's prettier runs from its own directory and uses only `.prettierignore` (without `-root`), so it formats its own files without exclusion. The result: zero overlap between root and per-package targets, and nx can fan them out in parallel.

The root project has `format`, `format-check`, `lint`, `lint-check` targets only — no `build` or `test`. Workspace packages have all five. When `nx run-many --target=build` runs, root is silently skipped (no target).

## How tasks flow

```
mise run <task>          (developer / CI entry point)
   └── bunx nx run-many --target=<task>
          ├── root → bun run <task> in repo root (root project's scripts)
          └── per-package → bun run <task> in each workspace package
```

The three layers are stable contracts:

- **mise** is a thin entry point. Every task body is a single `bunx nx run-many --target=<name>` call — no inline prettier, no inline shell-syntax check, no fallback bun invocations. 100% delegation to nx.
- **nx** owns orchestration: parallelism, caching, task graph (`build` depends on `^build`), affected-detection, and which projects implement a given target.
- **package scripts** own the actual work. They use the standard tools directly (prettier, tsc, bun test) so a single project can be operated on without nx (`bun run build` inside `packages/agent-api`, or `bun run lint` at the repo root).

Adding a new task that fans out across the monorepo is three steps:

1. Add a matching script in `package.json` for each project that should participate (root and/or workspace packages).
2. Add `[tasks.<name>]` to `mise.toml` with body `run = "bunx nx run-many --target=<name>"`.
3. If root participates, add the script name to `nx.includedScripts` in the root `package.json` so nx exposes it as a target.

## CI

`.github/workflows/test.yaml` runs three nx commands as separate steps so a failure points cleanly at the failed stage:

1. `bunx nx run-many --target=lint`
2. `bunx nx run-many --target=build`
3. `bunx nx run-many --target=test`

The lint job uses the existing `lint-files` action, which calls `mise run lint`. `mise run lint` is now itself a single `bunx nx run-many --target=lint` call, so CI and local-dev go through the exact same chain.

`.github/workflows/cd.yaml` is plugin-specific (Claude Code plugin marketplace) and is intentionally separate from the nx pipeline.

## nx configuration notes

- `nx.json` defines `targetDefaults` with caching for `build`, `test`, and `lint`. `format` is uncached (it writes files in place).
- `build` declares `dependsOn: ["^build"]` so dependent packages build first.
- `defaultBase: "main"` — used by `nx affected`.
- nx cache lives in `.nx/cache` and is gitignored.
- The root project is registered via `nx.name = "root"` + `nx.includedScripts = ["format", "format-check", "lint", "lint-check"]` in the root `package.json`. `includedScripts` restricts which package.json scripts become nx targets — without it, every script (including helper scripts that shouldn't be fanned out) would be exposed.

## When to use `nx affected` vs `nx run-many`

- CI defaults to `run-many` so every change runs every check. With small workspace counts this is cheap.
- For local incremental work, `bunx nx affected --target=test` only runs tests for packages touched since `main`.
- For PRs that touch only one or two packages, switching CI to `affected` later is a one-line change once the workspace is large enough to benefit.
