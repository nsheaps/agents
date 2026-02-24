# brew-auto-maintenance: Go Ecosystem Research

Research Date: 2026-02-23
Researcher: Road Runner (Deep Researcher)
Task: #176 / #173

## Question

What Go libraries and patterns are best suited for building `brew-auto-maintenance` — a macOS tool with system tray icon, launchd background service, configurable auto-update, and CLI for manual operations?

## Answer

The evidence suggests a viable architecture using `fyne.io/systray` for menu bar, `os/exec` + `text/template` for launchd integration, plain YAML for config (upgrading to koanf later), and a single binary with subcommand pattern. No existing Go-based brew tray tool exists — this fills a market gap between Cork (SwiftUI, heavy) and homebrew-autoupdate (shell script, no GUI).

---

## 1. System Tray Library

### Recommendation: `fyne.io/systray`

**Confidence: High**

| Library | Stars | Last Commit | Open Issues | CGO | Recommendation |
|---------|-------|-------------|-------------|-----|----------------|
| [getlantern/systray](https://github.com/getlantern/systray) | 3,663 | Jul 2024 | 111 | Yes | Legacy — avoid for new projects |
| [fyne.io/systray](https://github.com/fyne-io/systray) | 328 | Feb 2026 | 14 | Yes | **Recommended** |
| [energye/systray](https://github.com/energye/systray) | 162 | Jan 2026 | 5 | Yes | Emerging alternative |
| [fyne.io/fyne](https://github.com/fyne-io/fyne) (full) | — | Active | — | Yes | Overkill for tray-only |

### Why fyne.io/systray

- **Drop-in replacement** for getlantern/systray (identical API)
- **Actively maintained** (Feb 10, 2026 latest commit vs Jul 2024 for getlantern)
- **Removed GTK dependency** — cleaner build, fewer system requirements
- **14 open issues** vs 111 for getlantern — healthier maintenance trajectory
- **Fyne ecosystem** support for future expansion if needed

### API Surface

All three systray libraries share nearly identical APIs:

```go
import "fyne.io/systray"

systray.Run(onReady, onExit func())
systray.SetIcon(iconBytes []byte)
systray.SetTemplateIcon(templateBytes, fallbackBytes []byte)  // macOS dark mode
systray.SetTitle(title string)
systray.SetTooltip(tooltip string)
systray.AddMenuItem(title, tooltip string) *MenuItem
systray.AddMenuItemCheckbox(title, tooltip string, checked bool) *MenuItem
systray.AddSeparator()
```

fyne.io/systray additionally provides `RunWithExternalLoop()` for GUI toolkit integration.

### macOS-Specific Requirements

- **CGO required**: `CGO_ENABLED=1` — all systray libraries use Objective-C bindings
- **App bundle required**: Must wrap binary in `.app` structure with `Info.plist`
- **Dark mode**: Use `SetTemplateIcon()` with black-on-transparent PNG (22x22px); macOS auto-inverts for light/dark
- **`LSUIElement = true`** in Info.plist: Hides app from Dock (menu bar only)
- **`NSHighResolutionCapable = true`**: Prevents blurry icons on Retina displays
- **Notarization**: Required for distribution — Developer ID cert, hardened runtime, `codesign` + `xcrun notarytool`

### Known Issues

- getlantern: NSUndoManager threading crashes, deprecated API warnings, SUID issues — these drove the fork
- fyne.io/systray: Fewer issues, more actively resolved
- energye: Cleanest backlog (5 issues) but less battle-tested

---

## 2. launchd Integration from Go

### Recommendation: `text/template` + `os/exec` (stdlib only)

**Confidence: High**

No high-level Go launchd wrapper library exists (unlike `go-systemd` for Linux). Integration is done through:

1. **plist generation**: `text/template` with XML template + config struct
2. **Service management**: `os/exec` calling `launchctl`
3. **Optional**: [`howett.net/plist`](https://github.com/DHowett/go-plist) (pure Go) if you need to read/modify existing plists

### plist Generation

```go
// Template approach (recommended for simplicity)
const plistTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{{.Label}}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{{.Program}}</string>
    <string>check</string>
  </array>
  <key>StartInterval</key>
  <integer>{{.CheckInterval}}</integer>
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
</plist>`
```

### Installing and Managing the Service

| Operation | Modern (10.10+) | Legacy |
|-----------|----------------|--------|
| Load | `launchctl bootstrap gui/{UID} {plist}` | `launchctl load {plist}` |
| Unload | `launchctl bootout gui/{UID} {plist}` | `launchctl unload {plist}` |
| Start | `launchctl kickstart -kp gui/{UID}/{label}` | `launchctl start {label}` |
| Stop | `launchctl stop gui/{UID}/{label}` | `launchctl stop {label}` |
| Status | `launchctl print gui/{UID}/{label}` | `launchctl list \| grep {label}` |

**Getting UID**: `os/user.Current().Uid`

**Install location**: `~/Library/LaunchAgents/com.nsheaps.brew-auto-maintenance.plist`

### Scheduling Patterns

- **`StartInterval`**: Run every N seconds (e.g., 21600 = 6 hours). Coalesces missed intervals on wake from sleep.
- **`StartCalendarInterval`**: Run at specific wall-clock times (e.g., 2 AM Sunday). Better for maintenance windows.
- **`KeepAlive` with `SuccessfulExit: false`**: Restart only on crash, not on clean exit.

### Graceful Shutdown

launchd sends SIGTERM and waits ~5 seconds before SIGKILL:

```go
ctx, cancel := signal.NotifyContext(context.Background(),
    os.Interrupt, syscall.SIGTERM)
defer cancel()
// Use ctx in main loop; keep shutdown < 5 seconds
```

---

## 3. Configuration Management

### Recommendation: Plain YAML for MVP, upgrade to koanf if needed

**Confidence: High**

| Approach | Complexity | Dependencies | Env Var Support | Recommended |
|----------|-----------|--------------|-----------------|-------------|
| Plain YAML (`gopkg.in/yaml.v3`) | Very low | 1 | Manual | MVP |
| [koanf](https://github.com/knadh/koanf) | Low | 2-3 (modular) | Built-in | v2 |
| [viper](https://github.com/spf13/viper) | High | Many | Built-in | Avoid — overkill |

### Why Plain YAML First

For ~5-10 config keys, yaml.v3 is sufficient:

```go
type Config struct {
    CheckInterval  string `yaml:"checkInterval"`  // e.g., "6h"
    AutoUpdate     bool   `yaml:"autoUpdate"`
    InstallTime    string `yaml:"installTime"`     // e.g., "02:00"
    IncludeCasks   bool   `yaml:"includeCasks"`
    NotifyOnUpdate bool   `yaml:"notifyOnUpdate"`
    TapSpecific    []struct {
        Tap      string   `yaml:"tap"`
        Formulae []string `yaml:"formulae"`
    } `yaml:"tapSpecific"`
}
```

### Config File Location

**macOS standard**: `~/Library/Application Support/brew-auto-maintenance/config.yaml`

This follows Apple's Human Interface Guidelines. Alternatives like `~/.config/` (XDG) are non-standard on macOS.

### When to Upgrade to koanf

- Need environment variable overrides (e.g., `BREW_AUTO_CHECK_INTERVAL`)
- Need CLI flag → config merging
- Config grows beyond 10 keys
- koanf is ~3x smaller than viper, preserves key casing (spec-compliant), modular dependencies

### Why Not Viper

- Forces lowercase on all keys (breaks YAML/JSON specs)
- ~5-6 MB binary overhead
- Massive dependency tree
- Overkill for a small tool

---

## 4. Shelling Out to Brew

### Recommendation: `os/exec` with `context.WithTimeout`

**Confidence: High**

### Key Commands

```go
// Check for outdated packages (JSON output)
cmd := exec.CommandContext(ctx, "brew", "outdated", "--json=v2")

// Update formula index
cmd := exec.CommandContext(ctx, "brew", "update")

// Upgrade all formulae
cmd := exec.CommandContext(ctx, "brew", "upgrade")

// Upgrade specific packages
cmd := exec.CommandContext(ctx, "brew", "upgrade", "package-name")

// Upgrade casks
cmd := exec.CommandContext(ctx, "brew", "upgrade", "--cask")

// Detect brew installation
path, err := exec.LookPath("brew")
```

### JSON Parsing

Use `brew outdated --json=v2` (v1 is deprecated):

```go
type OutdatedFormula struct {
    Name             string `json:"name"`
    InstalledVersion string `json:"installed_versions"`
    CurrentVersion   string `json:"current_version"`
}

cmd := exec.CommandContext(ctx, "brew", "outdated", "--json=v2")
var stdout bytes.Buffer
cmd.Stdout = &stdout
cmd.Run()
json.Unmarshal(stdout.Bytes(), &result)
```

### Best Practices

1. **Always use `context.WithTimeout`** — brew operations can hang
2. **Separate stdout/stderr buffers** — don't use `CombinedOutput()` for parseable output
3. **Type-assert `*exec.ExitError`** for exit code checking
4. **Detect "up to date"** by checking empty JSON array, not stdout text parsing
5. **Use `exec.LookPath("brew")`** to detect installation (cross-platform safe)

---

## 5. Prior Art

### Existing Tools

| Tool | Tech | Menu Bar | Auto-Update | CLI | Status |
|------|------|----------|-------------|-----|--------|
| [homebrew-autoupdate](https://github.com/DomT4/homebrew-autoupdate) | Shell + launchd | Notifications only | Yes | `brew autoupdate` | Community-maintained |
| [Cork](https://github.com/buresdv/Cork) | SwiftUI + AppKit | Yes | Yes | No | Active, paid binaries |
| [BrewMate](https://github.com/romankurnovskii/BrewMate) | Electron | Limited | No | No | Active |
| [Applite](https://github.com/milanvarady/Applite) | Native macOS | No | No | No | Active |
| **brew-auto-maintenance** | **Go** | **Yes** | **Yes** | **Yes** | **Proposed** |

### Market Gap

**No Go-based tool exists** that combines CLI + menu bar + auto-update. The evidence suggests:

- **homebrew-autoupdate** is closest in function but has no GUI — just launchd + notifications
- **Cork** is full-featured but requires Xcode/Swift and is macOS-only with no CLI
- **BrewMate** is Electron-based (heavy, not CLI-friendly)
- All existing tools shell out to brew — they orchestrate rather than replace it

### What brew-auto-maintenance Uniquely Offers

1. **Single Go binary** — lightweight (~5-10 MB), no runtime dependencies
2. **CLI + tray in one** — `brew-auto-maintenance check` (CLI) or `brew-auto-maintenance tray` (menu bar)
3. **Homebrew tap distribution** — `brew install nsheaps/tap/brew-auto-maintenance`
4. **Tap-specific update** capability (the `uufft` pattern) built in
5. **launchd integration** managed from the tool itself (`brew-auto-maintenance service install/start/stop`)

---

## 6. Recommended Repo Structure

```
brew-auto-maintenance/
├── cmd/
│   └── brew-auto-maintenance/
│       └── main.go                 # Single binary, subcommand dispatch
│
├── internal/
│   ├── brew/
│   │   ├── outdated.go             # brew outdated --json=v2
│   │   ├── upgrade.go              # brew upgrade / brew upgrade --cask
│   │   ├── update.go               # brew update
│   │   └── exec.go                 # Shared exec wrapper with timeout
│   ├── config/
│   │   ├── config.go               # Config struct + YAML loading
│   │   └── defaults.go             # Default values
│   ├── launchd/
│   │   ├── plist.go                # plist template rendering
│   │   ├── service.go              # launchctl install/start/stop/status
│   │   └── plist.tmpl              # XML template
│   ├── tray/
│   │   ├── tray.go                 # Menu bar setup + event loop
│   │   └── icons.go                # Embedded icon assets
│   └── cli/
│       └── commands.go             # CLI subcommand handlers
│
├── configs/
│   └── config.example.yaml         # Example config
│
├── .goreleaser.yaml                # Build + Homebrew tap automation
├── go.mod
├── go.sum
├── Makefile
├── README.md
└── LICENSE
```

### Single Binary, Subcommand Pattern

```go
// cmd/brew-auto-maintenance/main.go
func main() {
    switch os.Args[1] {
    case "check":     // Check for outdated packages (CLI)
    case "upgrade":   // Upgrade packages (CLI)
    case "tray":      // Start menu bar app
    case "service":   // Manage launchd service (install/start/stop/status)
    case "config":    // Show/edit configuration
    }
}
```

Consider [cobra](https://github.com/spf13/cobra) for subcommand parsing if complexity grows beyond 5 commands.

### Build Strategy

| Target | CGO | Cross-compile | Distribution |
|--------|-----|---------------|-------------|
| CLI commands | No | Yes (Linux/macOS/Windows) | Homebrew formula |
| Tray app | Yes (systray) | macOS only | Homebrew formula or cask |
| Combined binary | Yes | macOS only | Homebrew formula |

**Practical recommendation**: Ship a single macOS-only binary with CGO. Cross-platform CLI can be a future goal by splitting `cmd/` into two binaries.

### GoReleaser + Homebrew Tap

```yaml
# .goreleaser.yaml
builds:
  - main: ./cmd/brew-auto-maintenance
    env:
      - CGO_ENABLED=1
    goos: [darwin]
    goarch: [amd64, arm64]

brews:
  - tap:
      owner: nsheaps
      name: homebrew-tap
    homepage: "https://github.com/nsheaps/brew-auto-maintenance"
    description: "Homebrew auto-maintenance with menu bar and CLI"
```

---

## Recommended Implementation Phases

### Phase 1: CLI Foundation
- `internal/brew/` — exec wrapper, outdated/update/upgrade
- `internal/config/` — plain YAML config
- `cmd/brew-auto-maintenance/` — `check`, `upgrade` subcommands
- No CGO, no tray, cross-compilable

### Phase 2: launchd Service
- `internal/launchd/` — plist generation, service management
- `service install/start/stop/status` subcommands
- Background periodic checks via `StartInterval`

### Phase 3: Menu Bar
- `internal/tray/` — systray setup, icon management
- `tray` subcommand
- Show update count badge, quick-upgrade from menu
- Requires CGO, macOS only

### Phase 4: Polish
- Notifications (macOS native via `osascript` or [go-toast](https://github.com/nickkadams/go-toast))
- GoReleaser + Homebrew tap distribution
- Notarization for non-developer machines

---

## Confidence Levels

| Finding | Confidence |
|---------|------------|
| fyne.io/systray is the best choice for new macOS tray apps | **High** — active maintenance, clean API, drop-in getlantern replacement |
| All Go systray libraries require CGO | **High** — verified across all four options |
| text/template + os/exec sufficient for launchd | **High** — no wrapper library exists, stdlib approach is standard |
| Plain YAML sufficient for MVP config | **High** — 5-10 keys doesn't justify viper/koanf |
| No existing Go-based brew tray tool | **High** — exhaustive search found Swift, Electron, shell — no Go |
| Single binary subcommand pattern is viable | **High** — standard Go pattern, well-documented |
| brew outdated --json=v2 is the correct JSON flag | **Medium-High** — v1 confirmed deprecated, v2 structure not fully documented |

---

## Open Questions

1. **brew outdated --json=v2 exact schema**: The full JSON structure for v2 output isn't well-documented. Will need empirical testing with `brew outdated --json=v2 > /tmp/outdated.json` to map exact fields.
2. **Notification approach**: macOS notifications from Go are possible via `osascript` but feel hacky. A proper `UserNotifications` binding would be better but requires more CGO.
3. **`uufft` integration**: How the tap-specific update capability (the `uufft` pattern from dotfiles) maps to the config structure and CLI commands.
4. **Code signing automation**: Whether to use [mitchellh/gon](https://github.com/mitchellh/gon) or GoReleaser's built-in notarization support.

---

## Sources

### System Tray
- [getlantern/systray](https://github.com/getlantern/systray) — 3.6k stars, Jul 2024
- [fyne-io/systray](https://github.com/fyne-io/systray) — 328 stars, Feb 2026
- [energye/systray](https://github.com/energye/systray) — 162 stars, Jan 2026
- [fyne.io/fyne](https://github.com/fyne-io/fyne) — Full framework with tray since v2.2
- [mitchellh/gon](https://github.com/mitchellh/gon) — macOS signing/notarization
- [Bundling, signing, and notarizing Go apps](https://g3rv4.com/2019/06/bundling-signing-notarizing-go-application)

### launchd
- [Create and manage MacOS LaunchAgents using Go](https://ieftimov.com/posts/create-manage-macos-launchd-agents-golang/)
- [launchd Tutorial](https://www.launchd.info/)
- [Apple: Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [launchctl cheat sheet](https://gist.github.com/masklinn/a532dfe55bdeab3d60ab8e46ccc38a68)
- [DHowett/go-plist](https://github.com/DHowett/go-plist) — Pure Go plist encoder

### Configuration
- [knadh/koanf](https://github.com/knadh/koanf) — Lightweight config library
- [koanf vs Viper comparison](https://github.com/knadh/koanf/wiki/Comparison-with-spf13-viper)
- [Apple: Where to Put Application Files](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPFileSystem/Articles/WhereToPutFiles.html)

### Homebrew Integration
- [Homebrew JSON API Documentation](https://formulae.brew.sh/docs/api/)
- [Go os/exec Package](https://pkg.go.dev/os/exec)
- [Go context timeout patterns](https://golangbot.com/context-timeout-cancellation/)

### Prior Art
- [DomT4/homebrew-autoupdate](https://github.com/DomT4/homebrew-autoupdate) — Shell-based auto-update
- [buresdv/Cork](https://github.com/buresdv/Cork) — SwiftUI brew GUI
- [romankurnovskii/BrewMate](https://github.com/romankurnovskii/BrewMate) — Electron brew manager
- [milanvarady/Applite](https://github.com/milanvarady/Applite) — Native macOS cask manager

### Project Structure
- [golang-standards/project-layout](https://github.com/golang-standards/project-layout)
- [GoReleaser Homebrew integration](https://goreleaser.com/customization/homebrew/)
- [Go CGO cross-compilation](https://ecostack.dev/posts/go-and-cgo-cross-compilation/)
- [Go graceful shutdown patterns](https://victoriametrics.com/blog/go-graceful-shutdown/)
