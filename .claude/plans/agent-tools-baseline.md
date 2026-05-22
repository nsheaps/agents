# Plan: Centralize agent-repo mise tool versions (`agent-tools-baseline`)

Status: **Phase 1 IN PROGRESS** — Working branch: `claude/ai-3d-model-generator-XjoUi` (PR #157).

## Resolved decisions (Phase 0 complete)

- **D1 RESOLVED:** Package named `agent-tools-baseline`, lives at `packages/agent-tools-baseline/`. "agent-mise-plugin" collides with the unrelated ai-mktpl `mise` Claude Code plugin.
- **D2 RESOLVED:** ONE `sync-mise-baseline` script with self-detect branch (local copy in agents repo; fetch-from-URL for consumer repos). Fetch branch is exercised in Phase 2 — commented in script.
- **D3 RESOLVED:** `claude-code` stays at `2.1.143`. `2.1.146` is broken.
- **D4 RESOLVED:** `claude-utils` standardized at `0.12.14` (henry's version, the most recent).
- **D5 RESOLVED:** `ai-mktpl` is OUT of scope — do not migrate it. It uses `latest` for most tools and is managed differently.
- **D8 RESOLVED:** `bun` pinned at `1.3.14` across all agent repos (agents repo was the outlier at 1.3.13; bumped).

## 1. Problem & goal

Five repos each carry their own `mise.toml` `[tools]` section and have drifted:

| Tool                            | alex      | jack      | henry     | agents    |
| ------------------------------- | --------- | --------- | --------- | --------- |
| `npm:@anthropic-ai/claude-code` | 2.1.128   | 2.1.128   | 2.1.128   | 2.1.143   |
| `node`                          | 24.15.0   | 24.15.0   | 24.15.0   | 24.15.0   |
| `bun`                           | 1.3.14    | 1.3.14    | 1.3.14    | **1.3.13**|
| `jq`                            | 1.8.1     | 1.8.1     | 1.8.1     | 1.8.1     |
| `gh`                            | 2.92.0    | 2.92.0    | 2.92.0    | —         |
| `yq`                            | 4.53.2    | 4.53.2    | 4.53.2    | —         |
| `npm:prettier`                  | latest    | latest    | latest    | —         |
| `npm:eslint`                    | latest    | latest    | latest    | —         |
| `github:nsheaps/op-exec`        | 0.1.0     | 0.1.0     | 0.1.0     | —         |
| `github:nsheaps/claude-utils`   | 0.12.13   | 0.12.13   | **0.12.14**| —        |
| repo-specific                   | —         | —         | —         | litellm, tilt |

Goal: one centrally-managed source of the default `[tools]` baseline that every agent repo consumes, while each repo can still override any tool version locally. Plus: standardize `claude-code` to one known-good version (`2.1.146` is a broken npm release; `2.1.143` is last known-good).

## 2. Critical research: which mise mechanism?

Sources:

- [mise — Configuration](https://mise.jdx.dev/configuration.html)
- [mise — Dev Tools](https://mise.jdx.dev/dev-tools/)
- [mise — TOML Tasks (`task_config.includes`)](https://mise.jdx.dev/tasks/toml-tasks.html)
- [mise discussion #4562 — Advice on sharing Mise config across repos](https://github.com/jdx/mise/discussions/4562)
- [mise-action #359 — Partial tool version override](https://github.com/jdx/mise-action/issues/359)

### Findings

1. **No `include`/`import` for `[tools]`.** mise has `[task_config].includes` — but that is **tasks-only**. There is no equivalent directive to pull another file's `[tools]` section into a `mise.toml`.
2. **mise _plugins_ (asdf/vfox-style) are the wrong tool.** A mise plugin adds a tool _backend_ (how to install a kind of tool), not a set of pinned versions.
3. **`[tools]` merges "additively with overrides"** across all loaded configs. A more specific / higher-precedence config overrides conflicting versions and inherits everything it doesn't redefine.
4. **Within a single directory, precedence is (high→low):** `mise.local.toml` > `mise.toml` > `mise/config.toml` > `.mise/config.toml` > `.config/mise.toml` > `.config/mise/config.toml` > **`.config/mise/conf.d/*.toml`**. `conf.d` fragments are the **lowest** precedence — so a repo's own `mise.toml` always overrides a `conf.d` baseline.
5. **`conf.d` loads all `*.toml` alphabetically.** A numeric prefix (`00-…`) controls ordering.
6. **Directory-tree inheritance does not help here.** The five repos are separate git repos at separate paths — none is a child of another.
7. **Global/system config** (`~/.config/mise/config.toml`, `/etc/mise/config.toml`) is per-machine and not version-controlled.
8. **Native remote-config is not a feature** (only a discussion idea).

### Chosen mechanism

**A version-controlled `[tools]`-only fragment, distributed into each repo's `.config/mise/conf.d/00-agent-baseline.toml`.**

- `conf.d` is the only native mise location that (a) holds a `[tools]` section, (b) is repo-local and committable, and (c) sits **below** the repo's own `mise.toml` so per-repo overrides Just Work.
- The canonical fragment lives once, in `nsheaps/agents/packages/agent-tools-baseline/`.
- Each repo's `mise.toml` keeps only its **repo-specific** tools; common tools move to the baseline fragment. To override a baseline tool, a repo re-declares it in its own `mise.toml` (higher precedence wins).

### Distribution of the canonical fragment into each repo

The canonical fragment lives in the `agents` repo; the other repos need a copy. **Vendored copy + drift check.**

- A `mise run sync-mise-baseline` task writes the canonical fragment into `.config/mise/conf.d/00-agent-baseline.toml` (committed to each repo).
- The copy is fetched by **pinned raw-GitHub URL** (tag-pinned) for consumer repos. The `agents` repo copies directly.
- A `mise run check-mise-baseline` task (wired into each repo's CI `lint` job) asserts the vendored copy byte-matches the canonical. Drift then surfaces as a **failing CI check + reviewable diff**, never silently.

## 3. Package design — `nsheaps/agents/packages/agent-tools-baseline`

Proposed layout:

```
packages/agent-tools-baseline/
├── README.md                      # what it is, how repos consume it, how to override
├── agent-baseline.mise.toml        # CANONICAL [tools]-only fragment (single source of truth)
├── VERSION                         # 0.1.0 — git tags for pinned fetches come in Phase 4
└── tasks/
    ├── sync-mise-baseline          # writes canonical fragment → consumer's conf.d
    └── check-mise-baseline         # CI gate: vendored copy must match canonical
```

### Baseline vs. repo-specific split

- **Baseline (in the fragment):** `node`, `npm:@anthropic-ai/claude-code`, `bun`, `jq`, `gh`, `yq`, `npm:prettier`, `npm:eslint`, `github:nsheaps/op-exec`, `github:nsheaps/claude-utils`.
- **Stays in agents' own `mise.toml`:** `pipx:litellm`, `tilt`.
- **ai-mktpl out of scope** — managed separately.

### `claude-code` standardization

Pin `npm:@anthropic-ai/claude-code = { version = "2.1.143", depends = "node" }` in the baseline fragment. The `depends = "node"` and the comment about the native-binary postinstall (fixed in `0d02e25`) carry into the fragment verbatim.

## 4. Phased work

### Phase 1 — Build the package (in `agents` repo, PR) ← IN PROGRESS

1. ✅ Update plan doc (rename agent-mise-plugin → agent-tools-baseline, apply resolved decisions).
2. Create `packages/agent-tools-baseline/` with `agent-baseline.mise.toml`, `README.md`, `VERSION`, `tasks/`.
3. Migrate the `agents` repo itself: create `.config/mise/conf.d/00-agent-baseline.toml`, strip baseline tools from `agents/mise.toml [tools]`, add thin wrapper tasks in `mise/tasks/`.
4. Wire `check-mise-baseline` into `agents` CI lint job.
5. Commit, push, update PR #157.

### Phase 2 — Migrate one agent repo (jack) as the reference

1. Publish git tag `v0.1.0` on `agents` so raw-GitHub URL works.
2. In `jack`: run `sync-mise-baseline` → commit `.config/mise/conf.d/00-agent-baseline.toml`.
3. Strip baseline tools from `jack/mise.toml [tools]`.
4. Wire `check-mise-baseline` into jack CI. Validate web session + launcher run.

### Phase 3 — Migrate alex, henry

Repeat Phase 2 per repo. alex / henry are identical to jack.

### Phase 4 — Drift guardrail & docs

1. Confirm `check-mise-baseline` fails CI on drift in all repos.
2. Update `cross-agent-consistency.md` to point at the baseline fragment as the source of truth.
3. Document override procedure in package README and each repo's `mise.toml` comment.
4. Decide ongoing version-bump flow (Renovate on canonical fragment + manual `sync-mise-baseline`).

## 5. Concrete per-repo changes (summary)

| Repo | `mise.toml` `[tools]` after | New file |
| --- | --- | --- |
| agents | `pipx:litellm`, `tilt` only | `.config/mise/conf.d/00-agent-baseline.toml` + `packages/agent-tools-baseline/` |
| jack | (empty `[tools]`; keeps tasks/settings) | `.config/mise/conf.d/00-agent-baseline.toml` |
| alex | (empty `[tools]`) | `.config/mise/conf.d/00-agent-baseline.toml` |
| henry | (empty `[tools]`) | `.config/mise/conf.d/00-agent-baseline.toml` |

## References

- [mise — Configuration](https://mise.jdx.dev/configuration.html)
- [mise — Dev Tools / tool dependencies](https://mise.jdx.dev/dev-tools/)
- [mise — TOML Tasks (`task_config.includes`)](https://mise.jdx.dev/tasks/toml-tasks.html)
- [mise discussion #4562 — Advice on sharing Mise config across repos](https://github.com/jdx/mise/discussions/4562)
- [mise-action issue #359 — Partial tool version override](https://github.com/jdx/mise-action/issues/359)
- Prior fix for the claude-code native-binary postinstall: commit `0d02e25` (`agents` `validate` task).
- PR #157: [claude/ai-3d-model-generator-XjoUi](https://github.com/nsheaps/agents/pull/157)
