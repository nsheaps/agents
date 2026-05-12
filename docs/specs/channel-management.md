---
name: channel-management
status: draft
description: Mechanism for injecting unofficial marketplace channel plugins into the GrowthBook allowlist to enable the --channels flag
parent:
related:
  - plugin-system-design
  - agent-harness-lifecycle
owner: jack
created: 2026-04-07
updated: 2026-04-07
tags:
  - channels
  - growthbook
  - plugin-system
  - security
---

# Channel Management

## Problem Statement

Claude Code's `--channels` flag requires channel plugins to be on Anthropic's
server-side `tengu_harbor_ledger` allowlist. Community marketplace plugins (from
`ai-mktpl`) are not on that list, forcing use of the less safe
`--dangerously-load-development-channels` flag. A mechanism is needed to use
`--channels` cleanly for unofficial marketplace plugins.

## Design Decisions

1. **Channel gate order** (seven layers, first failure stops processing):
   1. Capability — does the server declare `experimental['claude/channel']`?
   2. Runtime — is `tengu_harbor` GrowthBook flag enabled?
   3. Auth — is the user authenticated via claude.ai OAuth (not API key)?
   4. Org Policy — for team/enterprise: is `channelsEnabled: true`?
   5. Session — is the server listed in `--channels`?
   6. Marketplace — does the installed plugin match the marketplace in the `--channels` tag?
   7. Allowlist — is the plugin on the approved list (unless `entry.dev` is true)?
      Source: `docs/research/claude-code-channel-source-analysis.md`,
      `channelNotification.ts` `gateChannelServer()`.

2. **GrowthBook ledger disk-cache bypass**: The `tengu_harbor_ledger` is stored in
   `~/.claude.json` under `cachedGrowthBookFeatures`. Writing to it directly before
   `claude` starts injects unofficial marketplace entries without requiring server-side
   approval. The disk cache is the authoritative source for the initial connection
   decision — read priority position 4 (after ant-only env var and in-memory).
   Source: `docs/research/growthbook-cache-bypass.md`.

3. **Disk-cache write is idempotent and non-destructive**: The injection script
   (`bin/helpers/inject-channel-allowlist.sh`) detects existing entries and skips
   duplicates; preserves all official `claude-plugins-official` entries unchanged;
   uses atomic write via `mktemp` + `mv` to prevent corruption.
   Source: `docs/research/growthbook-injection-implementation.md`.

4. **6-hour refresh risk**: GrowthBook network refreshes every 6 hours for non-ant
   users, overwriting the disk cache with server values. Re-running the injection at
   session startup (before `claude` is invoked) is sufficient mitigation because the
   disk cache is only the fallback for the _next_ restart — in-memory values take over
   for the current session once GrowthBook refreshes in-memory.
   Source: `docs/research/growthbook-cache-bypass.md`.

5. **Entries currently injected** (as of 2026-04-07):
   - `{"marketplace": "ai-mktpl", "plugin": "discord"}`
   - `{"marketplace": "ai-mktpl", "plugin": "telegram"}`
     Source: `docs/research/growthbook-injection-implementation.md`.

6. **Telegram fallback**: `bin/agent` prefers `plugin:telegram@ai-mktpl` if the plugin
   directory exists, falls back to `plugin:telegram@claude-plugins-official`.
   Source: `docs/research/growthbook-injection-implementation.md`.

7. **`skipDangerousModePermissionPrompt` cannot be set in project settings**: The RCE
   protection in Claude Code explicitly excludes `projectSettings`
   (`.claude/settings.json`) from the sources checked for this flag. Must be set in
   `userSettings`, `localSettings`, `flagSettings`, or `policySettings` (managed org).
   Source: `docs/research/claude-code-channel-source-analysis.md`.

8. **`allowedChannelPlugins` org override** (team/enterprise only): When subscription is
   team or enterprise and `allowedChannelPlugins` is set in managed policy settings, it
   replaces the GrowthBook ledger entirely. Not applicable for personal accounts.
   Source: `docs/research/claude-code-channel-source-analysis.md`.

9. **Long-term solution**: Request Anthropic add `ai-mktpl` to the server-side
   `tengu_harbor_ledger`. Until then, the disk-cache injection at startup is the
   supported workaround. Source: `docs/research/growthbook-cache-bypass.md`,
   recommendation section.

## Open Questions

- Should the injection script be extended to support additional marketplaces/plugins
  beyond `ai-mktpl` discord and telegram?
- Is there a path to getting `ai-mktpl` added to Anthropic's server-side allowlist,
  and what is that process?

## References

- `docs/research/growthbook-cache-bypass.md` in ai-agent-jack
- `docs/research/growthbook-injection-implementation.md` in ai-agent-jack
- `docs/research/claude-code-channel-source-analysis.md` in ai-agent-jack
- `bin/helpers/inject-channel-allowlist.sh` in ai-agent-jack
- Claude Code source: `src/services/mcp/channelNotification.ts`, `channelAllowlist.ts`
- Claude Code source: `src/utils/settings/types.ts` (allowedChannelPlugins schema)
