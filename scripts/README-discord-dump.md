# discord-dump.py

Stdlib-only Python script that dumps Discord channel/thread messages to JSON Lines.

## Auth

Bot token from `$DISCORD_BOT_TOKEN` (override with `--token-env NAME`). The bot
must be in the guild and have **View Channel** + **Read Message History** on
every channel/thread you want to dump.

## Required IDs

- `--guild` / `-g` or `DISCORD_GUILD_ID`
- `--channel` / `-c` or `DISCORD_CHANNEL_ID` (required unless `--all`)
- `--thread` / `-t` or `DISCORD_THREAD_ID` (required when `--channel` is a forum
  and you didn't pass `--forum` / `--with-threads`)

## Modes

| Flag | What it does |
|---|---|
| _(default)_ | Dump one channel to one jsonl file. |
| `--with-threads` | Also dump every active+archived public thread under the channel; output becomes a directory with one file per channel/thread. |
| `--forum` | Like `--with-threads` but explicit — required when `--channel` is a forum (type 15) or media channel (type 16). |
| `--thread <id>` | Dump only that thread. |
| `--all` | Dump every textual channel in the guild (skips voice/category/stage). Combine with `--with-threads` to also grab threads. |

## Filters

- `--start YYYY-MM-DD` and `--end YYYY-MM-DD` (or full ISO8601) — UTC.
- `--user <id>` — include only these author IDs (repeatable).
- `--exclude-user <id>` — drop these author IDs (repeatable).

## Resilience

- Full pagination via the `before=` cursor (`limit=100`).
- Honors `429` with `retry_after` from body or `Retry-After` header.
- Proactively sleeps when `X-RateLimit-Remaining: 0` (uses `X-RateLimit-Reset-After`).
- Retries 5xx and network/timeout errors with exponential backoff + jitter
  (cap 60s, `--max-retries 8` by default).

## Output shape

One JSON object per line — the raw Discord Message object. No reshaping, so
embeds/attachments/reactions/components are preserved verbatim for downstream
processing.

## Examples

```bash
# Single channel → single file
DISCORD_BOT_TOKEN=... ./scripts/discord-dump.py \
  -g 1490863845252665415 -c 1497431286661517353 \
  -o behavior.jsonl

# Channel + every thread (forum or text-with-threads) → directory
./scripts/discord-dump.py \
  -g 1490863845252665415 -c 1497431286661517353 --with-threads \
  -o behavior/

# Whole guild
./scripts/discord-dump.py -g 1490863845252665415 --all --with-threads -o guild/

# Filter by date + author
./scripts/discord-dump.py -g ... -c ... \
  --start 2026-05-01 --end 2026-06-01 \
  --user 303922555947843585 \
  -o filtered.jsonl
```
