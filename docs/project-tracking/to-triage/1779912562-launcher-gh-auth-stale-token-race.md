Launcher's `gh-auth` step exports a stale `GH_TOKEN` into the claude process env, and the later SessionStart `github-app` hook that writes a fresh token can't propagate the new value back to the already-spawned claude process. Result: every Bash tool call sees the stale token, `gh auth status` says "The token in GH_TOKEN is invalid", and any `git push` over HTTPS fails authentication until I manually `source ~/.agents/alex/.claude/plugins/data/github-app-ai-mktpl/github-app-env` inside the Bash call.

Repro from 2026-05-27 launcher log (alex restart at 16:04Z):

```
[2026-05-27 16:03:01] [gh-auth] current token state: EXPIRED 8526min ago (app=3491565 install=126782324)
[2026-05-27 16:03:01] [gh-auth pre-check] GITHUB_APP_ID=7 INSTALLATION_ID=9 PRIVATE_KEY_PATH=... PEM_readable=yes
[2026-05-27 16:03:01] WARN: [gh-auth] generate-token.sh not found in plugin cache; skipping token regen
[2026-05-27 16:03:01] [gh-auth] GH_TOKEN exported (40 chars, app=3491565 install=126782324) for marketplace add
...
[2026-05-27 16:04:08] alex launcher starting in /home/nsheaps/src/nsheaps/.ai-agent-alex
(claude spawns with stale GH_TOKEN baked into env)
[SessionStart github-app hook fires inside claude]
github-app: Authenticated as alex-nsheaps (expires: 2026-05-27T21:04:15Z)
github-app: Token available via $GH_TOKEN and $GITHUB_TOKEN
```

That last line is misleading — the hook writes to a file (`github-app-env`) and to its own subprocess env, but the parent claude process's env vars are unchanged. Bash tool calls inherit the parent's stale value.

Two root causes worth separating:

1. **Stale-token export path**: launcher's `[gh-auth]` step exports an expired token because it can't run `generate-token.sh` (`not found in plugin cache; skipping token regen`). The script path resolves to a plugin-cache location that may not exist yet during the marketplace-add phase. Should this step regen via a fallback path, or just SKIP exporting if it can't refresh?
2. **SessionStart can't update claude env**: even when the github-app SessionStart hook gets a fresh token, there's no mechanism to push it back into claude's process env. The Bash tool will keep seeing whatever was in argv/env at claude startup.

Workaround that works today: every `gh`/`git push` Bash call needs to `source $AGENT_HOME_DIR/.claude/plugins/data/github-app-ai-mktpl/github-app-env` first. That's brittle — easy to forget, and the path varies by agent.

Possible fixes:

- Launcher: don't export stale GH_TOKEN at all. If `generate-token.sh` is missing, exit the gh-auth step without exporting anything; let SessionStart be the single source of truth.
- Plugin: write to a stable, well-known path AND emit a coach message at SessionStart telling the agent "source $PATH before git/gh ops" (or have a PreToolUse hook auto-source it).
- Plugin: extend `CLAUDE_ENV_FILE` chain to include the github-app env file, so it's picked up before any tool call.

Source: 2026-05-27 ~20:05Z — alex tried to push 3 to-triage tickets to `nsheaps/agents`, failed auth, debugged it down to the env-source ordering. Nate ack'd making the 4th ticket [Discord 20:09Z](https://discord.com/channels/.../1509287398473994460).
