# brew-auto-maintenance Specification

> **Status**: Draft
> **Author**: Tweety Bird (Docs Writer)
> **Date**: 2026-02-23
> **Task**: #179
> **Research**: [docs/research/brew-auto-maintenance.md](../../research/brew-auto-maintenance.md)

---

## 1. Overview

`brew-auto-maintenance` is a macOS Go tool that automates Homebrew maintenance: checking for outdated packages, running upgrades on a schedule, managing a launchd background service, and optionally displaying a system tray icon. It unifies a CLI, a background service, and a menu bar app in a single binary.

### Goals

1. **Automated maintenance**: Check for and install Homebrew updates on a configurable schedule without user intervention
2. **Tap-specific upgrades**: Support upgrading only specific formulae from specific taps (absorbing the `uufft` capability)
3. **Single binary**: One binary handles CLI, service management, and tray — no separate daemons or installers
4. **Homebrew-distributable**: Install via `brew install nsheaps/devsetup/brew-auto-maintenance`
5. **Lightweight**: ~5–10 MB binary, no runtime dependencies beyond `brew` itself

### Non-Goals

- Replacing Homebrew itself or providing a Homebrew GUI (that's Cork, Applite)
- Cross-platform support in v1 (macOS only due to CGO + launchd)
- Managing Homebrew installation or taps (only upgrades existing installs)

### Market Context

No Go-based tool currently combines CLI + menu bar + auto-update for Homebrew. See [research §5](../../research/brew-auto-maintenance.md) for competitive analysis.

---

## 2. Repository

- **Repo**: `nsheaps/brew-auto-maintenance` (new, public)
- **Language**: Go 1.22+
- **Distribution**: GoReleaser + Homebrew tap `nsheaps/homebrew-devsetup`
- **License**: MIT

---

## 3. CLI Interface

### 3.1 Subcommands

```
brew-auto-maintenance <command> [flags]

Commands:
  check              Check for outdated formulae and casks
  upgrade            Run brew update + upgrade (respects config)
  tray               Start the menu bar app (Phase 3)
  service <action>   Manage the launchd background service
  config             Show current configuration
  version            Print version and exit
```

### 3.2 `check`

```
brew-auto-maintenance check [--json] [--tap <tap>]
```

- Runs `brew outdated --json=v2`
- Outputs a human-readable table by default; `--json` for machine-readable
- `--tap <tap>` filters output to formulae from a specific tap
- Exit code 0 = up to date, 1 = outdated packages found, 2 = error

### 3.3 `upgrade`

```
brew-auto-maintenance upgrade [--tap <tap>] [--formula <name>] [--casks] [--dry-run]
```

- Runs `brew update` then `brew upgrade` (respects config for cask inclusion)
- `--tap <tap>`: upgrade only formulae from this tap (the `uufft` pattern)
- `--formula <name>`: upgrade a single formula by name
- `--casks`: include casks (overrides config)
- `--dry-run`: print what would be upgraded without running

### 3.4 `service`

```
brew-auto-maintenance service install    # Write plist + bootstrap service
brew-auto-maintenance service uninstall  # Bootout + remove plist
brew-auto-maintenance service start      # kickstart the service
brew-auto-maintenance service stop       # Stop the service
brew-auto-maintenance service status     # Print service state
brew-auto-maintenance service restart    # Stop + start
```

Plist location: `~/Library/LaunchAgents/com.nsheaps.brew-auto-maintenance.plist`

### 3.5 `config`

```
brew-auto-maintenance config show     # Print current config (with defaults)
brew-auto-maintenance config edit     # Open config in $EDITOR
brew-auto-maintenance config reset    # Write default config (prompts if exists)
```

---

## 4. Configuration

### 4.1 Location

```
~/Library/Application Support/brew-auto-maintenance/config.yaml
```

Follows Apple's [standard file placement guidelines](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPFileSystem/Articles/WhereToPutFiles.html).

### 4.2 Schema

```yaml
# brew-auto-maintenance config
# Full reference: https://github.com/nsheaps/brew-auto-maintenance

# Whether the background service runs upgrades automatically
autoUpdate: true

# How often to check for updates (duration: e.g. "6h", "30m", "1h30m")
checkInterval: "6h"

# When to install upgrades (cron expression or duration after check)
# cron: "0 2 * * *"   → 2:00 AM daily
# duration: "0s"       → immediately after check
installSchedule: "0 2 * * *"

# Whether to upgrade casks in addition to formulae
includeCasks: false

# Show macOS notification when upgrades are available
notifyOnUpdate: true

# Tap-specific upgrade rules
# Each entry restricts upgrades from that tap to only the listed formulae.
# If formulae is empty, all formulae from the tap are upgraded.
taps:
  - tap: "nsheaps/devsetup"
    formulae:
      - "uufft"
  - tap: "homebrew/cask-fonts"
    formulae: []  # upgrade all from this tap
```

### 4.3 Go Struct

```go
type Config struct {
    AutoUpdate      bool         `yaml:"autoUpdate"`
    CheckInterval   string       `yaml:"checkInterval"`   // parsed as time.Duration
    InstallSchedule string       `yaml:"installSchedule"` // cron or duration
    IncludeCasks    bool         `yaml:"includeCasks"`
    NotifyOnUpdate  bool         `yaml:"notifyOnUpdate"`
    Taps            []TapConfig  `yaml:"taps"`
}

type TapConfig struct {
    Tap      string   `yaml:"tap"`
    Formulae []string `yaml:"formulae"` // empty = all from tap
}
```

---

## 5. Technical Design

### 5.1 Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `fyne.io/systray` | Menu bar icon + menu | Requires CGO; actively maintained (Feb 2026) |
| `gopkg.in/yaml.v3` | Config parsing | Sufficient for MVP; upgrade to koanf if config grows |
| `os/exec` | Shell out to `brew` + `launchctl` | stdlib; always use `context.WithTimeout` |
| `text/template` | plist generation | stdlib; no launchd Go wrapper exists |
| `cobra` | CLI subcommand parsing | Optional; plain `os.Args` switch acceptable for ≤6 commands |

See [research §1–§4](../../research/brew-auto-maintenance.md) for library evaluation rationale.

### 5.2 launchd Integration

plist template (embedded in binary via `go:embed`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nsheaps.brew-auto-maintenance</string>
  <key>ProgramArguments</key>
  <array>
    <string>{{.Program}}</string>
    <string>check</string>
  </array>
  <key>StartInterval</key>
  <integer>{{.CheckIntervalSeconds}}</integer>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>{{.LogPath}}</string>
  <key>StandardErrorPath</key>
  <string>{{.ErrLogPath}}</string>
</dict>
</plist>
```

Service commands use modern `launchctl` API:

```
install:   launchctl bootstrap gui/{UID} {plist}
uninstall: launchctl bootout gui/{UID} {plist}
start:     launchctl kickstart -kp gui/{UID}/com.nsheaps.brew-auto-maintenance
stop:      launchctl stop gui/{UID}/com.nsheaps.brew-auto-maintenance
status:    launchctl print gui/{UID}/com.nsheaps.brew-auto-maintenance
```

### 5.3 Tap-Specific Upgrade (`uufft` pattern)

Given a `TapConfig` entry with `tap: "nsheaps/devsetup"` and `formulae: ["uufft"]`:

1. Run `brew list --formula` to get installed formulae from that tap (via `brew info --json=v2 --installed`)
2. Filter to only the listed formulae names
3. Run `brew upgrade <formula1> <formula2> ...`

If `formulae` is empty, run `brew upgrade $(brew list --formula | grep -f <tap-formulae-list>)`.

### 5.4 Menu Bar (Phase 3)

- Icon: 22×22 PNG, black-on-transparent, registered with `systray.SetTemplateIcon()` for dark/light mode auto-inversion
- Menu items:
  - "brew-auto-maintenance" (disabled title)
  - Separator
  - "Check now" → triggers `check`
  - "Upgrade now" → triggers `upgrade`
  - Separator
  - "N packages outdated" (dynamic, updates after check)
  - Separator
  - "Preferences..." → opens config in `$EDITOR` or system default
  - "Quit"
- Requires `.app` bundle with `LSUIElement = true` in `Info.plist` to hide from Dock

### 5.5 Project Structure

```
brew-auto-maintenance/
├── cmd/brew-auto-maintenance/
│   └── main.go              # Subcommand dispatch
├── internal/
│   ├── brew/
│   │   ├── check.go         # outdated --json=v2
│   │   ├── upgrade.go       # update + upgrade, tap-specific
│   │   └── exec.go          # Shared exec wrapper with timeout
│   ├── config/
│   │   ├── config.go        # Struct + YAML load/save
│   │   └── defaults.go      # Default values
│   ├── launchd/
│   │   ├── service.go       # bootstrap/bootout/kickstart/stop/print
│   │   ├── plist.go         # Template rendering
│   │   └── plist.tmpl       # Embedded XML template
│   └── tray/
│       ├── tray.go          # systray setup + event loop (Phase 3)
│       └── icons.go         # Embedded icon bytes
├── configs/
│   └── config.example.yaml
├── .goreleaser.yaml
├── go.mod
├── Makefile
└── README.md
```

### 5.6 Build and Distribution

```yaml
# .goreleaser.yaml (excerpt)
builds:
  - main: ./cmd/brew-auto-maintenance
    env:
      - CGO_ENABLED=1
    goos: [darwin]
    goarch: [amd64, arm64]

brews:
  - repository:
      owner: nsheaps
      name: homebrew-devsetup
    homepage: "https://github.com/nsheaps/brew-auto-maintenance"
    description: "Homebrew auto-maintenance with CLI, launchd service, and menu bar"
    install: |
      bin.install "brew-auto-maintenance"
```

---

## 6. Implementation Phases

### Phase 1: CLI Foundation (MVP)

**Deliverables**:
- `brew check` — show outdated formulae/casks
- `brew upgrade` — run update + upgrade with tap/formula filtering
- `brew config show/edit/reset`
- Plain YAML config with all schema fields
- No CGO, no tray — cross-compilable for development

**Done when**: `brew-auto-maintenance check` and `brew-auto-maintenance upgrade --tap nsheaps/devsetup --formula uufft` work correctly on a real machine.

### Phase 2: launchd Service

**Deliverables**:
- `brew service install/uninstall/start/stop/status/restart`
- Embedded plist template
- Periodic `check` + conditional `upgrade` via `StartInterval`
- Logs to `~/Library/Logs/brew-auto-maintenance/`

**Done when**: `service install` writes a valid plist, service loads, and runs `check` on schedule.

### Phase 3: Menu Bar

**Deliverables**:
- `brew tray` — starts menu bar app
- `.app` bundle structure (for distribution)
- Template icon (22×22, dark/light mode)
- Dynamic outdated count badge
- "Check now" / "Upgrade now" actions

**Done when**: Menu bar icon appears, shows outdated count, triggers upgrade from menu.

### Phase 4: Polish

- macOS notifications (via `osascript` or `UserNotifications` CGO binding)
- GoReleaser + Homebrew tap CI
- Code signing + notarization

---

## 7. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | `brew outdated --json=v2` exact schema for tap-specific formulae | Needed for Phase 1 |
| 2 | Notification approach: `osascript` vs CGO `UserNotifications` | Phase 3/4 |
| 3 | Use `cobra` for subcommands or plain `os.Args` switch? | Phase 1 |
| 4 | Code signing automation: `mitchellh/gon` or GoReleaser built-in? | Phase 4 |
| 5 | `installSchedule` cron parsing: use `robfig/cron` or stdlib ticker? | Phase 2 |

---

## 8. References

- [Research: brew-auto-maintenance Go ecosystem](../../research/brew-auto-maintenance.md) — Road Runner, 2026-02-23
- [fyne-io/systray](https://github.com/fyne-io/systray)
- [gopkg.in/yaml.v3](https://pkg.go.dev/gopkg.in/yaml.v3)
- [launchd.info](https://www.launchd.info/)
- [Apple: Where to Put Application Files](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPFileSystem/Articles/WhereToPutFiles.html)
- [GoReleaser Homebrew](https://goreleaser.com/customization/homebrew/)
- [DomT4/homebrew-autoupdate](https://github.com/DomT4/homebrew-autoupdate) — prior art
