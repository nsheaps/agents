# iTerm2 Tab Title Analysis — 4 Screenshots

**Date analyzed**: 2026-02-17
**Context**: Investigating how Claude Code sets iTerm2 tab titles in agent team mode

---

## Screenshot 1: `8.42.48 PM.png`

### Tab/Window Titles Visible

- **iTerm2 tab title** (at very top of window):
  - `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-dd_api_key`
  - This appears to be the FULL active tab title
  - Format: `— [resource type] [other info] [async job detail]`
  - Tab is labeled with actual GCP/async job details, not Claude Code task info

### Claude Code TUI Content

- **Left sidebar**: Shows profile selection menu with "Profile Name", "Default", "Internal", "Staging", etc.
  - Currently selected (highlighted in blue): **"Blind"** (last item in list)
- **Main panel**: Shows Settings → General → Terminal tab with various options
  - Scrollback lines: 1000
  - Character encoding: Unicode (UTF-8)
  - Report terminal type: xterm-256color
  - EMG answer back: [checked]
  - Mouse reporting options: [multiple checkboxes, some checked]

### Key Observations

- The iTerm2 tab title is **NOT** reflecting Claude Code task/session info
- It's showing infrastructure/shell session details instead
- No visible Claude Code "activeForm" or task description in the tab title
- This appears to be iTerm2's default behavior picking up shell session info

---

## Screenshot 2: `8.42.54 PM.png`

### Tab/Window Titles Visible

- **Two visible iTerm2 tab lines at top**:
  1. `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-github_app_secret  created (22:1...`
  2. `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-dd_api_key  created (22:0...`
  - Both tabs showing similar format with GCP resource + async job info
  - Green "created" status badge with timestamp info visible

### Claude Code TUI Content

- **Top bar shows**: "Settings" dialog open
- **Tab navigation**: General | Appearance | Profiles | Keys | Arrangements | **Pointer** | Shortcuts | Advanced
  - Currently viewing: General/Windows/Tabs/Panes/Dimming section
- **Per-pane UI**:
  - Checkbox: ✓ "Show per-pane title bars"
  - Checkbox: ✓ "Separate status bars per pane"
  - Checkbox: ✓ "Separate background images per pane"
- **Side margins**: 6 [with +/- controls]
- **Top & bottom margins**: 2 [with +/- controls]

### Key Observations

- The "Show per-pane title bars" setting is **CHECKED** (enabled)
- This iTerm2 setting would display per-pane titles if they were being set
- Current tab titles still showing infrastructure/async job info, not Claude Code info
- No evidence yet of Claude Code controlling the tab title string

---

## Screenshot 3: `8.43.01 PM.png`

### Tab/Window Titles Visible

- **Top line shows partial tab title**:
  - `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-github_app_secret`
  - Similar format to previous screenshots
- **Green text on right edge** (appears to be scroll indicator or status):
  - `created (22:1...` visible

### Claude Code TUI Content

- **Top bar**: Shows a dropdown/help text about terminal title changes
  - Text visible includes: "Applications in Terminal may change the title bar"
  - "Each tab may have its own window title"
  - "Disable title updates when the title bar is not visible"
  - "Show any pane title bar"
  - "Show per-pane title bar"
  - "Support basic HTML tags in title lines"
  - "Support any report window title"
  - "Allow applications other to change the window title"

### Key Observations

- This is still showing iTerm2's Settings/Preferences dialog
- The help text visible suggests iTerm2 HAS mechanisms for apps to control titles
- Still no Claude Code task info visible in the actual tab title
- The tab title format remains: `— [GCP info] [async job info]`

---

## Screenshot 4: `8.43.04 PM.png`

### Tab/Window Titles Visible

- **Multiple tab title lines visible at top**:
  1. `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-github_app_secret`
  2. `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-dd_api_key`
  3. `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-[string_uuid_window_id]_uuid_key`
  4. `— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-stripe_webhook_secret`
  - All tabs follow same pattern with GCP resource + async job identifiers

### Claude Code TUI Content

- **Settings dialog still open**, showing similar tabs
- **Visible checkbox option**: ✓ "Each tab may have its own window title"
- **Text visible below**: "Remembered the position of previously closed windows"
- Other partially visible text about "Adjust window when changing next slide"

### Key Observations

- **CRITICAL FINDING**: The tab titles are consistently showing infrastructure/GCP info, NOT Claude Code session/task info
- All 4 tabs follow the exact same pattern: `— gcp:secretmanager:SecretIamMember async-job-worker-seed-access-[SECRET_TYPE]`
- The format strongly suggests these are shell session titles coming from the async job worker scripts
- No evidence of Claude Code TUI writing its own title strings to iTerm2
- The `— ` prefix appears to be iTerm2's marker for shell-provided titles

---

## Summary & Findings

### What's Being Set as Tab Titles

The tab titles are **NOT** coming from Claude Code's activeForm or task descriptions. Instead, they're coming from:

1. **Shell session details** (the `gcp:secretmanager:SecretIamMember` prefix)
2. **Async job worker identifiers** (the `async-job-worker-seed-access-[SECRET_TYPE]` suffix)
3. **iTerm2's default behavior** of picking up these shell titles

### Pattern Observed

All tabs follow this exact format:

```
— gcp:secretmanager:SecretIamMember  async-job-worker-seed-access-[IDENTIFIER]  [STATUS] [TIMESTAMP]
```

### No Claude Code Task Info

- None of the 4 screenshots show Claude Code's activeForm, task ID, or agent name in the tab title
- The iTerm2 Settings show that per-pane titles ARE enabled, but they're not being populated by Claude Code
- This suggests the async job worker scripts are setting titles via shell escape sequences (likely OSC 0/1/2)

### What This Means for Agent Teams

- **Current behavior**: iTerm2 tabs show infrastructure/job details, not agent role names or task info
- **For looney-tunes team**: The tab titles don't reflect that Wile E. Coyote (Coach) or Road Runner (Researcher) are running in those panes
- **Opportunity**: Claude Code (or a wrapper script) could set more meaningful tab titles like:
  - `Wile E. Coyote (Coach) — session-001`
  - `Road Runner (Researcher) — #42: Investigate spawn behavior`
  - `Bugs Bunny (Engineer) — implementing feature-x`

### Recommendation

To make agent team tabs more readable:

1. Add tab title setting to Claude Code's TUI (or via launch flags)
2. Have the orchestrator script set iTerm2 title via escape sequence like: `echo -ne "\033]0;Agent Name (Role) — Task Info\007"`
3. This would make the LEFT sidebar sidebar immediately show which agent is doing what
