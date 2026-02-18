# Language Comparison: Bun/TypeScript vs Rust vs Go

**Purpose**: Evaluate language options for building agent orchestration tooling, MCP servers, Kubernetes controllers, and end-user CLI distribution for the agent-team project.

**Research date**: 2026-02-16
**Researcher**: Tweety Bird (Docs Writer)

---

> **Decision (2026-02-17)**: The user has decided on **TypeScript/Bun for all components** except the K8s controller (which remains Go). This overrides the research recommendation of Go as primary. The rationale prioritizes developer experience, ecosystem familiarity, and the TypeScript MCP SDK's larger community over Go's binary size and cross-compile advantages. The research analysis below remains valid as reference material.

---

## Executive Summary

Go is the pragmatic default for agent and MCP tooling. It dominates the Kubernetes ecosystem, produces small static binaries, has an official Google-backed MCP SDK[^9], and offers the fastest path from zero to production. Rust trades development velocity for peak performance and memory safety — a worthwhile trade for long-running, resource-constrained agent infrastructure.[^11] Bun/TypeScript offers the best developer experience and fastest prototyping but carries binary size overhead and limited production precedent for orchestration workloads.[^1]

**Quick verdict by use case:**

| Use Case                         | Recommended        | Runner-Up          |
| :------------------------------- | :----------------- | :----------------- |
| K8s controller / operator        | **Go**             | Rust (kube-rs)[^5] |
| MCP server                       | **Go** or **Rust** | Bun/TS             |
| CLI orchestrator (`claude-team`) | **Go**             | Rust               |
| Rapid prototype / internal tool  | **Bun/TS**         | Go                 |
| Resource-constrained agent infra | **Rust**           | Go                 |

---

## 1. Binary Distribution

| Factor                    | Bun/TypeScript             | Rust                           | Go                            |
| :------------------------ | :------------------------- | :----------------------------- | :---------------------------- |
| **Typical binary size**   | 57-105 MB[^1]              | 5-15 MB (3-5 MB optimized)[^2] | 5-10 MB (1-3 MB stripped)[^3] |
| **Runtime deps**          | None (JSC embedded)        | None (musl static)             | None (CGO_ENABLED=0)          |
| **Cross-compile**         | `--target=bun-<os>-<arch>` | cargo-zigbuild, cross          | `GOOS/GOARCH` env vars        |
| **Ease of cross-compile** | Good (5 targets)           | Moderate (toolchain setup)     | Trivial (one-liner)           |
| **Homebrew-friendly**     | Yes, but large bottle      | Yes, small bottle              | Yes, small bottle             |

**Analysis**: Go and Rust produce binaries 5-20x smaller than Bun.[^3][^2] Go's cross-compilation is the simplest — a single env-var one-liner with no extra toolchains. Rust requires toolchain setup (cargo-zigbuild or cross) but produces the smallest optimized binaries.[^2] Bun embeds the full JavaScriptCore runtime, making binaries 57 MB+ even for hello-world.[^1]

**Winner**: **Go** (simplest cross-compile, small binaries). Rust close second (smallest optimized).

---

## 2. Kubernetes Controller Ecosystem

| Factor                   | Bun/TypeScript               | Rust                                        | Go                                   |
| :----------------------- | :--------------------------- | :------------------------------------------ | :----------------------------------- |
| **Primary framework**    | Pepr (admission-focused)[^4] | kube-rs (CNCF Sandbox)[^5]                  | controller-runtime + kubebuilder[^6] |
| **Maturity**             | Growing, niche               | Production-ready, growing                   | Industry standard (gold)             |
| **Dependent projects**   | Small                        | 33 active contributors                      | 23,210+ importing projects[^6]       |
| **Production operators** | Limited (admission webhooks) | Emerging (68% resource reduction cited)[^5] | 1,000+ on OperatorHub                |
| **Corporate backing**    | Community                    | CNCF                                        | Google, Red Hat, CNCF                |

**Analysis**: Go is THE language for Kubernetes. kubectl, etcd, containerd, Helm, Prometheus — all Go.[^6] The controller-runtime + kubebuilder + operator-sdk stack has no equivalent in any other language. Rust's kube-rs is a CNCF Sandbox project with real production success stories (68% resource reduction, zero crashes), but the ecosystem is orders of magnitude smaller.[^5] Bun/TypeScript via Pepr is viable for admission webhooks and lightweight controllers but not for stateful operators.[^4]

**Winner**: **Go** (uncontested). Rust viable for new projects prioritizing resource efficiency.

---

## 3. Performance

| Factor                | Bun/TypeScript       | Rust                            | Go                             |
| :-------------------- | :------------------- | :------------------------------ | :----------------------------- |
| **Startup time**      | 38-77 ms (compiled)  | 50-200 ms                       | <50 ms                         |
| **Memory footprint**  | 2-3x higher than Go  | 2-3x lower than Go              | Baseline                       |
| **Throughput (HTTP)** | 52k req/sec (Elysia) | Highest (tokio async)           | Good (goroutines)              |
| **Concurrency model** | Event loop (JSC)     | tokio async (zero-cost)         | Goroutines (2 KB stack)        |
| **GC pauses**         | Yes (JSC GC)         | None                            | Yes (improved in Go 1.26)[^12] |
| **CPU-bound perf**    | Moderate             | Best (~30% faster than Go)[^11] | Good                           |

**Analysis**: For agent orchestration — which is primarily I/O-bound (LLM API calls, file ops, subprocess management) with occasional CPU bursts — all three are adequate. Rust offers the best raw performance and memory efficiency, critical when running many concurrent agents per host.[^11] Go's goroutines (2 KB each, millions possible) are excellent for concurrent I/O. Bun is faster than Node.js but slower than both compiled languages.[^10] Go 1.26's Green Tea GC reduces pause latency significantly.[^12]

For startup-sensitive CLI tools, Go wins (<50 ms). For long-running daemons (MCP servers, controllers), startup is negligible and Rust's memory advantage matters more.

**Winner**: **Rust** (best memory and throughput). **Go** (best startup, simpler concurrency model).

---

## 4. Developer Experience

| Factor                   | Bun/TypeScript                       | Rust                           | Go                                     |
| :----------------------- | :----------------------------------- | :----------------------------- | :------------------------------------- |
| **Learning curve**       | Low (if you know TS)                 | Moderate-high (borrow checker) | Low (25 keywords)                      |
| **Time to productivity** | Days                                 | Weeks                          | Days                                   |
| **Type safety**          | Good (TypeScript)                    | Excellent (ownership + types)  | Good (static types, no generics depth) |
| **Compile speed**        | Instant (interpreted)                | 3-8 min clean build            | Seconds (incremental: ms)              |
| **Package ecosystem**    | 2M+ npm packages                     | Growing (crates.io)            | Mature (Go modules)                    |
| **Testing**              | `bun test` (10-30x faster than Jest) | `cargo test` (built-in)        | `go test` (built-in)                   |
| **CLI frameworks**       | Various npm packages                 | clap + tokio                   | Cobra + Viper + Bubbletea              |
| **Toolchain**            | All-in-one (bun)                     | cargo (all-in-one)             | go tool (all-in-one)                   |

**Analysis**: Bun offers the best DX for TypeScript developers — native execution, zero config, instant feedback loops.[^1] Go offers the fastest ramp for newcomers — 25 keywords, simple syntax, gofmt enforced consistency, and near-instant compilation. Rust's borrow checker adds weeks to the learning curve but eliminates entire classes of bugs.[^11] For a team that may include contributors with varying experience levels, Go's simplicity is a significant advantage.

Compile times are a critical differentiator: Go rebuilds in seconds, Bun is instant, Rust takes 3-8 minutes clean (30-60s cached). For CI/CD iteration speed, this matters.

**Winner**: **Bun/TS** (best DX for TS teams). **Go** (best for mixed-experience teams, fastest iteration).

---

## 5. MCP SDK Availability

| Factor                 | Bun/TypeScript                          | Rust                                        | Go                                       |
| :--------------------- | :-------------------------------------- | :------------------------------------------ | :--------------------------------------- |
| **Official SDK**       | `@modelcontextprotocol/sdk` v1.27.0[^7] | `modelcontextprotocol/rust-sdk` v0.15.0[^8] | `modelcontextprotocol/go-sdk` v1.3.0[^9] |
| **GitHub stars**       | (part of larger TS ecosystem)           | 3,000+[^8]                                  | 3,900+[^9]                               |
| **Dependent projects** | 25,840+ (npm)[^7]                       | 136 contributors                            | 836 dependent projects                   |
| **Maintainer**         | Anthropic                               | Anthropic                                   | Anthropic + Google[^9]                   |
| **Transports**         | stdio, HTTP, WebSocket                  | stdio, HTTP, child process                  | stdio, SSE, WebSocket, gRPC              |
| **Production-ready**   | Yes (v1.x stable)                       | Yes (active releases)                       | Yes (Google co-maintained)               |

**Analysis**: All three have official, production-ready MCP SDKs.[^7][^8][^9] The TypeScript SDK has the most dependents (25K+ npm projects) by virtue of the larger JS ecosystem. The Go SDK is notable for being co-maintained with Google, signaling long-term institutional commitment.[^9] The Rust SDK has the richest community ecosystem (rust-mcp-sdk, Prism MCP SDK) alongside the official one.

For MCP server development specifically, all three are viable first-class choices.

**Winner**: **Tie** — all three have official, well-maintained SDKs. Go's Google co-maintenance is a differentiator for long-term support.

---

## 6. Cross-Platform Support

| Target            | Bun/TypeScript | Rust          | Go                        |
| :---------------- | :------------- | :------------ | :------------------------ |
| **Linux x64**     | Yes            | Tier 1        | Yes                       |
| **Linux ARM64**   | Yes            | Tier 1        | Yes                       |
| **macOS x64**     | Yes            | Tier 1        | Yes                       |
| **macOS ARM64**   | Yes            | Tier 1        | Yes                       |
| **Windows x64**   | Yes            | Tier 1        | Yes                       |
| **Windows ARM64** | **No**         | Tier 2        | Yes                       |
| **Additional**    | —              | FreeBSD, WASM | Android, iOS, WASM, Plan9 |

**Analysis**: Go covers the widest platform matrix with the simplest toolchain — including Windows ARM64 and mobile platforms. Rust covers all major platforms at Tier 1/2 with some toolchain setup required for cross-compilation. Bun is missing Windows ARM64, which is an edge case but a gap.[^1]

**Winner**: **Go** (widest coverage, simplest toolchain). Rust close second.

---

## 7. CI/CD and Build Complexity

| Factor                  | Bun/TypeScript  | Rust                              | Go                                  |
| :---------------------- | :-------------- | :-------------------------------- | :---------------------------------- |
| **Config files needed** | 1-2             | 1-2 (Cargo.toml)                  | 1 (go.mod) + GoReleaser             |
| **Clean build time**    | 2-2.5 min       | 3-8 min                           | 2-5 min (multi-platform)            |
| **Incremental build**   | Instant         | 30-60s (cached)                   | Seconds                             |
| **Docker image size**   | 300-450 MB[^15] | 8-45 MB (scratch/distroless)[^14] | 5-15 MB (scratch)                   |
| **Release automation**  | npm publish     | cargo-release                     | GoReleaser (industry standard)[^13] |
| **Multi-arch Docker**   | Supported       | cargo-chef + multi-stage[^14]     | GoReleaser + buildx                 |

**Analysis**: Go's GoReleaser is the industry standard for multi-platform release automation — it handles cross-compilation, Docker multi-arch images, Homebrew taps, Scoop manifests, code signing, and SBOM generation in one tool.[^13] Rust's cargo-chef + multi-stage builds produce the smallest Docker images (8 MB with scratch) but require more CI setup.[^14] Bun's Docker images are 300-450 MB, 20-60x larger than Go/Rust alternatives.[^15]

Build times favor Go and Bun for iteration speed. Rust's 3-8 minute clean builds are a known pain point, though Swatinem/rust-cache mitigates this in CI.

**Winner**: **Go** (GoReleaser is unmatched for release automation). Rust best for minimal image size.

---

## 8. Community Adoption

| Factor                          | Bun/TypeScript         | Rust                           | Go                                   |
| :------------------------------ | :--------------------- | :----------------------------- | :----------------------------------- |
| **Language popularity**         | TS: Top 5              | Top 15, growing                | Top 10                               |
| **Infra/cloud-native presence** | Limited                | Growing (ripgrep, bat, etc.)   | Dominant (K8s, Docker, Terraform)    |
| **Agent frameworks**            | Limited Bun-specific   | Rig, AutoAgents, agentai[^17]  | Google ADK, LangChainGo, Genkit[^16] |
| **CLI tool precedent**          | Emerging               | Strong (ripgrep, starship, fd) | Strong (kubectl, gh, terraform)      |
| **Corporate backing**           | Oven (Bun)             | Mozilla → community            | Google                               |
| **Hiring market**               | TS developers abundant | Smaller talent pool            | Strong demand, growing supply        |

**Analysis**: Go dominates cloud-native infrastructure. Every major tool in the Kubernetes ecosystem is Go.[^6] For agent-specific frameworks, Go has institutional backing from Google (ADK, Genkit)[^16] while Rust has emerging but strong community projects (Rig, AutoAgents).[^17] Bun/TypeScript has the largest general developer base but limited precedent for orchestration-class workloads.

Rust has proven its CLI credentials (ripgrep used by VS Code for search, starship prompt, fd, bat), but Go has proven its infrastructure credentials (kubectl, Docker, Terraform, Helm).

**Winner**: **Go** (dominant in target ecosystem). Rust strong for CLI tooling specifically.

---

## Comparison Matrix

| Dimension                |  Bun/TS   |   Rust    |    Go     | Notes                                 |
| :----------------------- | :-------: | :-------: | :-------: | :------------------------------------ |
| **Binary distribution**  |    2/5    |    4/5    |  **5/5**  | Go: smallest + simplest cross-compile |
| **K8s controllers**      |    1/5    |    3/5    |  **5/5**  | Go: uncontested industry standard     |
| **Performance**          |    3/5    |  **5/5**  |    4/5    | Rust: best memory + throughput        |
| **Developer experience** |  **5/5**  |    2/5    |    4/5    | Bun: best DX; Go: fastest ramp        |
| **MCP SDK**              |  **5/5**  |    4/5    |  **5/5**  | All production-ready; Go has Google   |
| **Cross-platform**       |    3/5    |    4/5    |  **5/5**  | Go: widest + simplest                 |
| **CI/CD complexity**     |    3/5    |    3/5    |  **5/5**  | GoReleaser is unmatched               |
| **Community adoption**   |    3/5    |    3/5    |  **5/5**  | Go owns cloud-native infra            |
| **Overall**              | **25/40** | **28/40** | **38/40** |                                       |

---

## Recommendation

> **Note**: The original research recommended Go as primary. The user decided on TypeScript/Bun instead (see Decision box at top). The updated recommendation below reflects this decision.

### Primary: TypeScript/Bun (user decision)

TypeScript/Bun for all agent-team project components:

- **Agent launch wrapper** (`claude-team`): Fastest DX, instant iteration, familiar ecosystem[^1]
- **MCP servers**: TypeScript SDK has most examples and largest community (25K+ npm dependents)[^7]
- **Mesh MCP server**: TypeScript + Socket.io is a natural fit for real-time communication
- **CLI tools**: All orchestration and developer tooling in TypeScript

### Exception: Go (K8s controller only)

Go remains the only choice for Kubernetes controllers:

- **K8s controller**: controller-runtime + kubebuilder is the uncontested standard[^6]
- No other component uses Go

### Secondary: Rust (for performance-critical components, if needed)

Consider Rust only if a specific component proves to need extreme performance:

- **Long-running agent daemons**: 2-3x less memory than Go, no GC pauses[^11]
- **High-concurrency scenarios**: tokio async at extreme scale
- **Embedded/resource-constrained**: Smallest possible binaries (3-5 MB)[^2]

### Architecture (updated)

```
┌─────────────────────────────────────────┐
│      User-Facing CLI (TypeScript/Bun)   │
│  claude-team, agent launch, MCP client  │
├─────────────────────────────────────────┤
│     MCP Servers (TypeScript/Bun)        │
│  Team memory, orchestration, persona    │
├─────────────────────────────────────────┤
│      K8s Controller (Go)                │
│  Agent lifecycle, scaling, scheduling   │
└─────────────────────────────────────────┘
```

---

## References

[^1]: https://bun.com/docs/bundler/executables

[^2]: https://github.com/johnthagen/min-sized-rust

[^3]: https://eli.thegreenplace.net/2024/building-static-binaries-with-go-on-linux/

[^4]: https://pepr.dev

[^5]: https://kube.rs/

[^6]: https://github.com/kubernetes-sigs/kubebuilder

[^7]: https://github.com/modelcontextprotocol/typescript-sdk

[^8]: https://github.com/modelcontextprotocol/rust-sdk

[^9]: https://github.com/modelcontextprotocol/go-sdk

[^10]: https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide

[^11]: https://langpop.com/blog/rust-vs-go-systems-programming

[^12]: https://go.dev/doc/go1.26

[^13]: https://goreleaser.com/

[^14]: https://azzamsa.com/n/rust-docker/

[^15]: https://docs.docker.com/guides/bun/containerize/

[^16]: https://developers.googleblog.com/announcing-the-agent-development-kit-for-go-build-powerful-ai-agents-with-your-favorite-languages/

[^17]: https://rig.rs/

[^18]: https://aws.amazon.com/blogs/opensource/introducing-cli-agent-orchestrator-transforming-developer-cli-tools-into-a-multi-agent-powerhouse/
