# pr-status-cli

Emoji-bucketed PR status via batched GraphQL.

## Usage

```bash
# Ref mode: status for an explicit list of PRs
bun run apps/pr-status-cli/src/index.ts <ref> [<ref> ...]

# Digest mode: discover PRs by org/author/since via GitHub search
bun run apps/pr-status-cli/src/index.ts digest [--org <name>...] [--author <user>...] \
                                                [--since <dur|iso>] [--state ...] \
                                                [--by created|updated] [--limit N] [--refs-only]
```

### Ref mode

Ref forms accepted:

- `https://github.com/<owner>/<repo>/pull/<n>` — full URL
- `<owner>/<repo>#<n>` — slug form
- `<owner>/<repo>/pull/<n>` — path form (no scheme)
- `@<path>` — read refs from a file (one per line, `#` line-comments OK)

All refs are merged into ONE aliased GraphQL request to `gh api graphql`.

### Digest mode

Discovers PRs via GitHub GraphQL `search` (`is:pr` plus your filters), then runs the same batched status query and emits the same emoji-bucketed lines. At least one of `--org`, `--author`, or `--repo` is required.

| flag                               | default   | notes                                                         |
| ---------------------------------- | --------- | ------------------------------------------------------------- |
| `--org <name>`                     | —         | repeatable; multiple orgs OR'd                                |
| `--author <user>` (alias `--user`) | —         | repeatable; multiple authors OR'd                             |
| `--repo <owner/repo>`              | —         | repeatable; multiple repos OR'd (`repo:owner/repo` qualifier) |
| `--since <dur\|iso>`               | `12hr`    | `Nm`/`Nhr`/`Nh`/`Nd`/`Nw`/`all` or ISO8601                    |
| `--state`                          | `all`     | `open` / `closed` / `merged` / `all`                          |
| `--by`                             | `updated` | `updated` or `created` — what `--since` filters on            |
| `--limit N`                        | `500`     | hard cap                                                      |
| `--refs-only`                      | off       | emit `owner/repo#N` refs, skip the status query               |

## Output

One line per input ref, in input order:

```
<state><ci><review> [[owner/repo#N] title](url)
```

### Emoji legend

State (1st):

- 🔵 draft
- 🟠 merge-conflicted
- 🟢 open
- 🟣 merged
- ❌ closed without merge

CI (2nd):

- ⛔️ merge-conflicted (CI ignored, must re-run anyway)
- 🟠 required still running, but any other failed
- 🔵 some still running
- 🔴 required passed, any other failed, all complete
- ❌ any failed, all finished
- 🟢 all passed (no required checks)
- ✅ all passed (including required)

Review (3rd):

- 🔵 no reviews yet
- ❌ any rejections (CHANGES_REQUESTED)
- 🟠 approved but criteria still not met
- 🟢 approved and ready to merge
- ✅ approved by codeowner and ready to merge
- 💬 commented, no approvals or denials

## Requirements

- `bun`
- `gh` on PATH, authenticated

## Example

```bash
$ bun run apps/pr-status-cli/src/index.ts nsheaps/agents#178 nsheaps/agents#157
🟣🟢✅ [[nsheaps/agents#178] feat(task-utils): ...](https://github.com/nsheaps/agents/pull/178)
🔵❌🔵 [[nsheaps/agents#157] Add opt-out for ...](https://github.com/nsheaps/agents/pull/157)
```
