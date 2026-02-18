# .claude/tmp/ — Ephemeral Scratch Directory

This directory is for **ephemeral, session-scoped working files only**. It is NOT
for permanent research, specs, or deliverables.

## Cleanup Convention

| Content Type | Action | Destination |
|:-------------|:-------|:------------|
| Research findings worth keeping | Move to `docs/research/` | Committed and preserved |
| Spec drafts | Move to `docs/specs/draft/` | Follows spec lifecycle |
| Swarm review outputs | Keep until findings are triaged, then delete | Ephemeral |
| Session scratch / QA output | Delete after session ends | Not preserved |
| Reports sent to teammates | Delete after confirmed received | Deliverable was the message |

**Rule**: If a file in `.claude/tmp/` would be useful in a future session, it
does not belong here. Move it to `docs/research/` or another permanent location.

**Retention**: Files older than 7 days should be reviewed and either archived
or deleted. Run periodic cleanup during docs maintenance.

---

# Language Research for Agent Team Tooling

This directory contains comprehensive research on Go, Rust, and Bun for building agent orchestration and MCP tooling.

## Documents

### Go Language Research

- **File**: `lang-research-go.md` (644 lines, 32KB)
- **Status**: Complete - RECOMMENDED for agent/MCP tooling
- **Key Findings**:
  - Official MCP Go SDK available (github.com/modelcontextprotocol/go-sdk)
  - Kubernetes ecosystem unmatched (kubebuilder, controller-runtime, operator-sdk)
  - Static binary distribution, trivial cross-compilation
  - Goroutine concurrency model ideal for agent orchestration
  - 30-50% lower memory than Java, <50ms startup time

### Rust Language Research

- **File**: `lang-research-rust.md` (27KB)
- **Status**: Complete - Alternative for peak performance
- **Key Findings**:
  - Excellent for performance-critical components
  - Mature MCP SDK (zed-industries/zed has Rust implementation)
  - Steeper learning curve, slower compile times
  - Ideal for real-time agent decision-making with strict latency budgets
  - Not recommended for rapid iteration projects

### Bun Language Research

- **File**: `lang-research-bun.md` (24KB)
- **Status**: Complete - Not recommended for production agent tooling
- **Key Findings**:
  - Modern JavaScript runtime with TypeScript support
  - Single-file execution convenience
  - Immature ecosystem for infrastructure tooling
  - Not suitable for Kubernetes operators or critical infrastructure
  - Consider for rapid prototyping/CLI UX experimentation only

### Research Summaries

- **File**: `lang-research-summary.txt` (4.3KB)
- **Quick Reference**: High-level findings, recommendations, source count

## Quick Recommendation

**For agent-team orchestration tooling: USE GO**

Reasons:

1. Official MCP SDK ready for production use
2. Kubernetes ecosystem is gold standard (mandatory if orchestrating in K8s)
3. Goroutines enable thousands of concurrent agent tool calls
4. Static binary distribution across platforms (trivial)
5. Developer velocity + operational simplicity
6. Massive institutional backing (Google, AWS, Microsoft, Red Hat)

**Rust only if**: You need 30% better peak performance AND your team has Rust expertise.

**Bun only if**: Rapid CLI prototyping/UX experiments (not production infrastructure).

## Research Methodology

Each document answers 8 core questions:

1. **Binary Distribution**: Size, static linking, cross-compilation, dependencies
2. **K8s Controller Ecosystem**: Maturity, production examples, community
3. **Performance**: Startup, memory, throughput, concurrency model
4. **Developer Experience**: Learning curve, ecosystem, error handling, compile speed
5. **MCP SDK**: Official SDKs, maturity, production examples
6. **Cross-Platform**: Platform support, ARM64, Windows/macOS/Linux
7. **CI/CD**: Build times, Docker images, release tooling
8. **Community**: Ecosystem dominance, AI/agent tooling, institutional support

## Sources

Total sources cited: 100+

- Official language documentation
- GitHub repositories (verified stats)
- Production examples from tier-1 companies
- 2025-2026 technical blog posts
- Research conducted February 2026

All sources are included as markdown hyperlinks within each research document.

## Key Statistics (Go)

- **MCP SDK**: github.com/modelcontextprotocol/go-sdk
  - 3.9k GitHub stars
  - 836 dependent projects
  - v1.3.0 latest release
  - 87 contributors
  - Apache 2.0 + MIT licensed

- **Kubernetes Operators**:
  - 1000+ operators in OperatorHub
  - Production: Dynatrace, K8ssandra, Redis, Prometheus, etc.
  - Cloud providers: AWS, Azure, GCP, Databricks maintain operators
  - Adoption: Universal in cloud infrastructure

- **Performance**:
  - Startup: <50ms CLI tools
  - Memory: 30-50% less than Java
  - Goroutines: 2KB stack each, millions concurrent
  - Docker: 20-30% faster startup
  - Binary size: 5-10MB (simple), 1-3MB (optimized)

- **Recent Improvements** (Go 1.26, February 2026):
  - GC latency improvements (Green Tea GC now default)
  - CGO overhead reduced 30%
  - Stack-allocated slices for better performance
  - SIMD support added (crypto/hpke, simd/archsimd)

## Decision Matrix

| Criterion          | Go                         | Rust                 | Bun            |
| ------------------ | -------------------------- | -------------------- | -------------- |
| MCP SDK maturity   | Official, production-ready | Good, community      | N/A            |
| K8s operators      | Gold standard              | Good                 | Not applicable |
| Startup time       | <50ms                      | ~100ms               | ~300ms         |
| Memory efficiency  | 30-50% less than Java      | Best (manual)        | Average        |
| Learning curve     | 25 keywords, quick         | Steep                | Easy           |
| Compile speed      | Very fast                  | Slow                 | Very fast      |
| Cross-platform     | Trivial                    | Good                 | Moderate       |
| Goroutines         | 2KB stack, millions        | OS threads, hundreds | No native      |
| Peak performance   | Good                       | 30% faster           | Moderate       |
| Developer velocity | Excellent                  | Slower               | Excellent      |

## Next Steps

1. **Decision Point**: Which language aligns with your constraints?
   - Infrastructure orchestration → Go (mandatory)
   - Peak performance critical → Rust
   - Rapid prototyping → Go (still best) or Bun (faster iteration)

2. **Proof of Concept**: Build simple MCP server in chosen language
   - Go: Use github.com/modelcontextprotocol/go-sdk
   - Rust: Use community MCP SDK
   - Validate against MCP spec

3. **Scale Testing**: Multi-agent orchestration
   - Test goroutine concurrency (Go)
   - Test memory scaling
   - Profile with pprof/flamegraph

4. **Production Deployment**:
   - GoReleaser for multi-platform Go releases
   - Container orchestration (K8s-native for Go)
   - Observe with Prometheus + Grafana

---

**Research Date**: February 16, 2026  
**Prepared for**: agent-team language selection  
**All sources verified and cited**
