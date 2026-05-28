# Monorepo conventions

This repository is an nx + bun + TypeScript monorepo. nx orchestrates per-package tasks; bun provides workspaces, runtime, and the package manager; TypeScript is the implementation language.

## Layout

| Directory     | Purpose                                                                   | Publish target                                                                                |
| ------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/*`  | Shared libraries consumed by other workspace packages and external users. | npm public registry as `@nsheaps/<name>`                                                      |
| `lib/*`       | Internal utility libraries used across the monorepo.                      | npm public registry as `@nsheaps/<name>`                                                      |
| `services/*`  | Deployable services (daemons, web servers, controllers).                  | Container images at `ghcr.io/nsheaps/<name>`. Marked `"private": true` to block npm publish.  |
| `apps/*`      | CLI apps and other end-user-facing binaries.                              | Distribution varies (homebrew, ghcr.io, npm CLI bin) — declared per app.                      |
| `plugins/*`   | Claude Code plugins. Versioned and published via the plugin marketplace.  | Not part of the nx workspace — managed by the existing `cd.yaml` workflow.                    |

Only `packages/`, `services/`, and `lib/` are workspace globs in the root `package.json`. `apps/`, `plugins/`, `agents/`, `templates/`, and the rest are managed outside nx.

## Naming

| Aspect              | Rule                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| npm name            | `@nsheaps/<package-dir-basename>` — the directory name and the unscoped npm name must match.               |
| Container image     | `ghcr.io/nsheaps/<package-dir-basename>` — same basename, no scope.                                        |
| Directory name      | Kebab-case. Library packages start with the role noun (`agent-api`, `agent-ui`). Internal libs may use any descriptive name (`agents-pg-utils`). |

This 1-to-1 mapping between directory basename, npm name, and container image is intentional — it makes publishing scripts and CI lookups trivial.

## Required scripts

Every workspace package must define these scripts in its `package.json` so that nx can orchestrate them uniformly:

| Script         | Behavior                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `format`       | Auto-fix formatting (currently `prettier --write . --ignore-path ../../.prettierignore`).                |
| `format-check` | Check-only formatting (`prettier --check`).                                                              |
| `lint`         | `format-check` + `tsc --noEmit`. Read-only. Safe for CI gates.                                           |
| `build`        | Type-check and emit. `tsc -b` against the package's `tsconfig.json`.                                     |
| `test`         | `bun test`.                                                                                              |

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
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist", "src", "README.md"],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/nsheaps/agent-team.git",
    "directory": "packages/<basename>"
  },
  "license": "UNLICENSED",
  "scripts": {
    "format": "prettier --write . --ignore-path ../../.prettierignore",
    "format-check": "prettier --check . --ignore-path ../../.prettierignore",
    "lint": "bun run format-check && tsc --noEmit",
    "build": "tsc -b",
    "test": "bun test"
  }
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
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

For browser packages, add `"lib": ["ESNext", "DOM"]` to `compilerOptions`.

## How tasks flow

```
mise run <task>          (the user-facing entry point)
   └── bunx nx run-many --target=<task>
          └── per-package `bun run <task>` (defined in each package.json)
```

The three layers are stable contracts:

- **mise** is the developer's everyday command surface. It also runs in CI. Every task that fans out to packages is one `bunx nx run-many` call.
- **nx** owns orchestration: parallelism, caching, task graph (`build` depends on `^build`), and affected-detection. nx is installed as a root devDependency (`bunx nx ...`), not via mise.
- **package scripts** own the actual work. They use the standard tools directly (prettier, tsc, bun test) so a single package can be operated on without nx (`cd packages/agent-api && bun run build`).

This means:

- Adding a new mise command that fans out to packages requires only an `nx run-many --target=<new-target>` line and a matching script in each `package.json`.
- CI uses the same `bunx nx run-many` calls — see `.github/workflows/test.yaml`. No CI-only paths.
- The mise `format` task also handles repo-level markdown (root-only concern) before delegating to nx for workspace packages.

## CI

`.github/workflows/test.yaml` runs three nx commands as separate steps so a failure points cleanly at the failed stage:

1. `bunx nx run-many --target=lint`
2. `bunx nx run-many --target=build`
3. `bunx nx run-many --target=test`

The lint job uses the existing `lint-files` action, which calls `mise run lint` — `mise run lint` now delegates to nx, so this single entry point covers both shell scripts (mise-native) and workspace packages (nx-orchestrated).

`.github/workflows/cd.yaml` is plugin-specific (Claude Code plugin marketplace) and is intentionally separate from the nx pipeline.

## nx configuration notes

- `nx.json` defines `targetDefaults` with caching for `build`, `test`, and `lint`. `format` is uncached (it writes files in place).
- `build` declares `dependsOn: ["^build"]` so dependent packages build first.
- `defaultBase: "main"` — used by `nx affected`.
- nx cache lives in `.nx/cache` and is gitignored.

## When to use `nx affected` vs `nx run-many`

- CI defaults to `run-many` so every change runs every check. With small workspace counts this is cheap.
- For local incremental work, `bunx nx affected --target=test` only runs tests for packages touched since `main`.
- For PRs that touch only one or two packages, switching CI to `affected` later is a one-line change once the workspace is large enough to benefit.
