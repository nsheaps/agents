# pr-status-cli

Emoji-bucketed PR status via batched GraphQL.

## Usage

```bash
bun run apps/pr-status-cli/src/index.ts <ref> [<ref> ...]
```

Ref forms accepted:

- `https://github.com/<owner>/<repo>/pull/<n>` — full URL
- `<owner>/<repo>#<n>` — slug form
- `<owner>/<repo>/pull/<n>` — path form (no scheme)
- `@<path>` — read refs from a file (one per line, `#` line-comments OK)

All refs are merged into ONE aliased GraphQL request to `gh api graphql`.

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
