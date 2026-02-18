# Research: Happy.Engineering

**Research Date**: February 2026
**Task**: #119
**Author**: Road Runner (Researcher)
**Status**: Complete

---

## Executive Summary

Happy (happy.engineering) is a **free, open-source mobile client for Claude Code and Codex** that enables developers to access and control their Claude Code sessions from mobile devices with end-to-end encryption. It is **not** an agent orchestration or team collaboration tool — it solves the problem of **device synchronization** for a single developer.

**Bottom line**: Happy is a complementary tool (monitor agent teams from your phone) but does not overlap with or compete against agent-team orchestration capabilities.

---

## 1. What Happy Does

### Core Components

| Component | Purpose | Repository |
| :-------- | :------ | :--------- |
| `happy` CLI | Wrapper that replaces `claude` on desktop | [slopus/happy-cli](https://github.com/slopus/happy-cli) |
| Happy App | Native iOS/Android/Web mobile client | [slopus/happy](https://github.com/slopus/happy) |
| Relay Server | E2E encrypted message relay | [slopus/happy-server](https://github.com/slopus/happy-server) |

### Key Features

1. **Multi-device sync** — Bidirectional real-time sync between desktop CLI and mobile app
2. **Multiple concurrent sessions** — Run several Claude Code instances with independent state
3. **End-to-end encryption** — AES encryption, QR code key exchange, zero-knowledge relay
4. **Permission interception** — Mobile device must approve sensitive operations
5. **Push notifications** — Alerts when Claude Code needs input or tasks complete
6. **Voice agent integration** — Speech-to-text for hands-free interaction
7. **File mentions and custom agents** — Autocomplete, command history, agent switching from mobile

### How It Works

```
Desktop (happy CLI)  ←→  Encrypted Relay  ←→  Mobile App (iOS/Android/Web)
```

1. Run `happy` instead of `claude` on desktop
2. Download mobile app, scan QR code to pair
3. Session state syncs across all paired devices in real-time
4. Mobile can approve permissions, send messages, monitor progress

---

## 2. Installation

```bash
npm install -g happy-coder
```

Setup: Run `happy` instead of `claude`, pair mobile via QR code.[^1]

---

## 3. Community and Adoption

- **GitHub stars**: 8.2k (main repo: slopus/happy)[^2]
- **License**: MIT (free, permissive open source)
- **Cost**: Completely free, no tiers or premium features
- **Self-hosting**: Available via [sylvan-lang/happy-self-hosted](https://github.com/sylvan-lang/happy-self-hosted)
- Active Discord community, featured on Hacker News[^3]

---

## 4. Relation to Agent-Team Work

### What Happy Is NOT

Happy is specifically **not designed for**:
- Coordinating multiple independent AI agents
- Agent team workflows (like Claude Code Agent Teams)
- Multi-agent task distribution or orchestration
- Team collaboration beyond single-developer device sync

### Comparison

| Aspect | Happy | Claude Code Agent Teams |
| :----- | :---- | :---------------------- |
| **Purpose** | Device sync for single Claude instance | Multiple coordinated AI agents |
| **Use Case** | Work from phone/tablet | Parallelize complex tasks |
| **Agents** | None (wraps single Claude Code) | Multiple specialized agents |
| **Orchestration** | N/A | Central orchestrator + teammates |
| **Team Support** | Single user, multiple devices | Multiple AI agents working together |

### Potential Interaction Points

If agent-team orchestration is running on desktop, Happy could theoretically:
- Monitor orchestrator output from mobile
- Approve permission prompts for the lead session remotely
- Send messages to the lead agent from mobile

However, this would require custom integration — Happy does not natively understand agent team structures, teammate messaging, or task lists.

### User's Prior Context

The user previously referenced a `happy` wrapper in the context of teammate launch customizability research.[^4] The question was whether teammates would go through a user's wrapper (like `happy`) when spawned. Finding: teammates are spawned via the Claude Code binary directly, not through user wrappers.

---

## 5. Security Architecture

- **Client-side encryption**: Messages encrypted before leaving device (AES, same family as Signal)
- **Key exchange**: Via QR code (QR data itself encrypted)
- **Relay role**: Message queue only, cannot decrypt traffic
- **Zero-knowledge**: Server has no access to plaintext, even if compelled
- **No telemetry**: No data collection, no tracking

---

## References

[^1]: [Happy.Engineering Official Site](https://happy.engineering/) — Features, installation, documentation

[^2]: [GitHub — slopus/happy](https://github.com/slopus/happy) — Main repository (8.2k stars)

[^3]: [Happy.Engineering on Hacker News](https://news.ycombinator.com/item?id=44904039) — Community discussion

[^4]: claude-utils project MEMORY.md — "Teammate launch customizability" research goal referencing `happy` wrapper

[^5]: [Happy Coder Best Practices Guide](https://happy.engineering/docs/guides/happy-coder-best-practices/) — Usage patterns and configuration

[^6]: [Happy vs Alternatives Comparison](https://happy.engineering/docs/comparisons/alternatives/) — Comparison with VS Live Share, CodeTogether, Codeanywhere
