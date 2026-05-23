# Sync and Concurrency Reference

Patterns for safe concurrent writes and cross-agent synchronization of plugin data files.

---

## The Core Problem

Multiple agents or processes may write to the same data files simultaneously:
- Two agents both try to update a task's status
- A hook fires while an agent is also writing
- A background sync daemon runs while an agent edits

Without coordination, writes race and corrupt files.

---

## Pattern 1: Copy-Swap (Single-Writer)

The safest atomic write pattern for filesystem data. Write to a temp file, then rename:

```bash
target_file=".claude/tasks/42.yaml"
tmp_file="${target_file}.tmp.$$"

# Write to temp file
yq -y '. + {"status": "completed", "updated_at": "2026-05-23T10:00:00Z"}' \
  "$target_file" > "$tmp_file"

# Atomic rename (atomic on Linux/macOS on same filesystem)
mv "$tmp_file" "$target_file"
```

**Why this works:** `mv` within the same filesystem is atomic at the OS level. Readers always
see a complete file — either the old version or the new version, never a partial write.

**Limitation:** Only prevents torn writes. Does not prevent two writers from clobbering each other.
For multi-writer scenarios, use a daemon or file locking.

---

## Pattern 2: Git as Coordination Layer

When agents run in separate processes or sessions, use git as the synchronization primitive:

```bash
# Before editing:
git -C "$CLAUDE_PROJECT_DIR" pull --ff-only

# Edit the file (copy-swap pattern)
yq -y '. + {"status": "completed"}' task.yaml > task.yaml.tmp
mv task.yaml.tmp task.yaml

# After editing:
git -C "$CLAUDE_PROJECT_DIR" add .claude/tasks/
git -C "$CLAUDE_PROJECT_DIR" commit -m "chore(tasks): update task 42 (completed)"
git -C "$CLAUDE_PROJECT_DIR" push
```

**On push failure (non-fast-forward):**
```bash
# Pull with rebase, re-apply
git pull --rebase
# Re-check the file — concurrent write may have updated it
# Re-apply your change if still needed
git push
```

**Throttle pulls.** Pulling on every write is expensive. Use a sentinel file to throttle:

```bash
LAST_PULL="${CLAUDE_PROJECT_DIR}/.claude/tasks/.last-sync-pull"
NOW=$(date +%s)
INTERVAL=${TASK_UTILS_PULL_INTERVAL_SECS:-60}

if [[ -f "$LAST_PULL" ]]; then
  LAST=$(stat -c %Y "$LAST_PULL" 2>/dev/null || stat -f %m "$LAST_PULL" 2>/dev/null || echo 0)
  DELTA=$(( NOW - LAST ))
  if (( DELTA < INTERVAL )); then
    # Skip pull — too recent
    exit 0
  fi
fi

git -C "$CLAUDE_PROJECT_DIR" pull --ff-only 2>/dev/null || true
touch "$LAST_PULL"
```

---

## Pattern 3: Daemon / MCP Server (Preferred for High Concurrency)

The most robust pattern: a single daemon owns the store directory and serializes all writes.
Agents call the daemon's tool API instead of editing files directly.

**Benefits:**
- No race conditions — writes are serialized by the daemon
- Transparent git operations — daemon handles add/commit/push
- Single source of truth for in-memory indexes
- Agents are decoupled from storage implementation

**Example architecture (task-utils MCP server):**
```
Agent A ──┐
Agent B ──┼──► MCP Tool Call ──► task-utils MCP Server ──► .yaml files ──► git
Agent C ──┘                                                              └──► push
```

**When the daemon is unavailable:**
- Agents fall back to direct file writes (copy-swap + git)
- Log the fallback so it's auditable
- On retry exhaustion, emit a detailed error with escalation path

---

## Pattern 4: File Locking (Same-Host, Same-Filesystem)

For same-host concurrent writers, use `flock`:

```bash
LOCK_FILE="${CLAUDE_PROJECT_DIR}/.claude/tasks/.write-lock"

(
  flock -w 5 200 || { echo "Could not acquire lock" >&2; exit 1; }
  
  # Critical section: edit the file
  yq -y '. + {"status": "completed"}' task.yaml > task.yaml.tmp
  mv task.yaml.tmp task.yaml

) 200>"$LOCK_FILE"
```

**Use when:** Same host, same filesystem, multiple processes. Not suitable for cross-machine
or cross-session coordination (use git or daemon instead).

---

## Conflict Detection and Resolution

When a pull reveals a conflicting update (two agents wrote different values for the same field):

### Detection

```bash
# After pull, check for merge conflicts
if git -C "$CLAUDE_PROJECT_DIR" diff --name-only --diff-filter=U | grep -q '\.yaml$'; then
  echo "Merge conflict in YAML task files"
fi
```

### Resolution strategy

1. **Never auto-resolve** by picking "ours" or "theirs" blindly
2. Emit a structured error: both versions, field that conflicts, agent IDs
3. A designated conflict-resolver (separate from the writing agents) reconciles
4. Conflicting fields for status: prefer the more "advanced" status
   (`completed > in_progress > pending`)

### Conflict-resolver sub-agent

A conflict-resolver should be a lightweight sub-agent baked into the plugin:

```
prompt: "Two task files conflict on field 'status'. Version A: {a}. Version B: {b}.
         Apply the resolution rules: prefer 'completed' over 'in_progress' over 'pending'.
         Output the resolved YAML."
```

The conflict-resolver is dispatched by the writing agent on conflict detection, not by
a third party.

---

## Network Filesystem Alternative

For teams where multiple agents run on different hosts, consider:

- **NFS mount**: shared filesystem, OS handles consistency
- **FUSE-based object store** (e.g., rclone mount to S3): cloud-backed, globally consistent
- **Database-backed**: PostgreSQL or SQLite (for structured queries across many records)

Agents read/write as if local; the filesystem handles distribution. Eliminates git-as-sync-layer
complexity at the cost of infrastructure setup.

---

## Summary: Which Pattern to Use

| Scenario | Pattern |
|----------|---------|
| Single agent, single process | Copy-swap |
| Multiple agents, same session | Daemon/MCP server |
| Multiple agents, different sessions (same host) | Git coordination + copy-swap |
| Multiple agents, different hosts | Daemon/MCP server or network filesystem |
| High-contention, same host | File locking + copy-swap |
| Conflict detected after pull | Conflict-resolver sub-agent |
