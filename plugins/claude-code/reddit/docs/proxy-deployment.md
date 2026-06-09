# Reddit Proxy Deployment Guide

Complete operator guide for deploying the Reddit API reverse-proxy stack that lets
agent containers reach Reddit from egress-restricted environments.

**Research basis:** [`../../../../docs/research/reddit-proxy-deployment-options.md`](../../../../docs/research/reddit-proxy-deployment-options.md)
(GitHub: [`https://github.com/nsheaps/agents/blob/main/docs/research/reddit-proxy-deployment-options.md`](https://github.com/nsheaps/agents/blob/main/docs/research/reddit-proxy-deployment-options.md))

---

## Why a Proxy?

Agent containers in this org run with egress restrictions: outbound traffic is allowed only
on ports 80/443, and reddit.com (and oauth.reddit.com) are blocked at the SNI level. As of
May 2026, Reddit also returns HTTP 403 for all unauthenticated requests, so even if egress
were unblocked, the `.json` API approach used by the plugin without credentials would fail.

The proxy solves both problems:

- Agents connect to `https://proxy-api.<domain>` (port 443, allowed egress).
- The proxy holds one Reddit OAuth2 `client_credentials` grant and forwards requests to
  `https://oauth.reddit.com` with a valid Bearer token.
- Each agent authenticates to the proxy with its own per-agent API key; the proxy is the
  only component that knows Reddit credentials.

---

## Architecture

### Components

| Component       | Image                           | Role                                                          |
| --------------- | ------------------------------- | ------------------------------------------------------------- |
| APISIX 3.9      | `apache/apisix:3.9.0-debian`    | API gateway: key-auth, proxy-rewrite, prometheus, embedded UI |
| etcd            | `bitnami/etcd:3.5`              | APISIX configuration store                                    |
| Prometheus      | `prom/prometheus:latest`        | Scrapes APISIX metrics on port 9091                           |
| Grafana         | `grafana/grafana:latest`        | Per-consumer usage dashboards                                 |
| cloudflared     | `cloudflare/cloudflared:latest` | Cloudflare Tunnel daemon (connects proxy host to CF edge)     |
| token-refresher | `alpine` + curl/jq              | Hourly Reddit OAuth token refresh → APISIX Admin API          |

### End-to-End Request Flow

```mermaid
sequenceDiagram
    participant A as Agent Container<br/>(egress: 80/443 only<br/>reddit.com blocked by SNI)
    participant CE as Cloudflare Edge<br/>(SNI: proxy-api.example.com)
    participant CFAccess as CF Access<br/>(Bypass policy)
    participant CD as cloudflared daemon<br/>(Docker host)
    participant GW as APISIX Gateway<br/>(docker-compose, port 9080)
    participant TR as token-refresher<br/>(sidecar)
    participant RD as oauth.reddit.com

    A->>CE: HTTPS GET /r/python.json<br/>apikey: sk-agent-01-xxx<br/>Host: proxy-api.example.com
    CE->>CFAccess: Check Access policy
    CFAccess-->>CE: Bypass — pass through unconditionally
    CE->>CD: Encrypted tunnel to cloudflared
    CD->>GW: HTTP GET /r/python.json<br/>apikey: sk-agent-01-xxx
    GW->>GW: key-auth plugin: validate apikey<br/>→ consumer = agent-01
    GW->>GW: proxy-rewrite plugin:<br/>add Authorization: Bearer <token><br/>add User-Agent: <configured UA>
    GW->>RD: HTTPS GET /r/python.json<br/>Authorization: Bearer <reddit_token>
    RD-->>GW: 200 JSON response
    GW-->>CD: 200 JSON (logged; metrics consumer=agent-01)
    CD-->>CE: Tunnel response
    CE-->>A: 200 JSON

    TR-->>GW: PATCH route every 55 min<br/>(update Bearer token via Admin API)
    TR-->>RD: POST /api/v1/access_token<br/>(client_credentials grant)
```

**What the agent-side plugin sends:**

- `REDDIT_PROXY_URL=https://proxy-api.example.com`
- `REDDIT_PROXY_TOKEN=sk-agent-01-xxx` (sent as `apikey` header by default)
- No Reddit credentials or CF service tokens are required in the agent container.

---

## Docker-Compose Stack

The full stack lives in `deploy/docker-compose.yaml`.

**Service summary:**

| Service           | Purpose                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `etcd`            | APISIX's config/discovery store. Uses named volume for persistence.                                                                 |
| `apisix`          | The gateway. Exposes `:9080` (proxy), `:9180` (Admin API + embedded UI), `:9091` (Prometheus metrics). Mounts `apisix/config.yaml`. |
| `prometheus`      | Scrapes APISIX metrics. Mounts `prometheus/prometheus.yml`.                                                                         |
| `grafana`         | Dashboard UI on `:3000`. Provisioned from `grafana/provisioning/`.                                                                  |
| `cloudflared`     | Runs the CF Tunnel daemon; connects the host to Cloudflare edge.                                                                    |
| `token-refresher` | Alpine sidecar; refreshes Reddit OAuth token and patches APISIX route.                                                              |

All secrets (admin key, Reddit credentials, Grafana password) are injected via the `.env`
file. **Never commit `.env`** — only `.env.example` is in version control.

### Starting the stack

```bash
cd deploy/
cp .env.example .env
# Edit .env with real values (see section below)
docker compose up -d
docker compose logs -f token-refresher  # watch first token fetch
```

### Bootstrap consumers and routes

After the stack is healthy, run the bootstrap script to provision APISIX:

```bash
# Set env vars or export them, then:
bash bootstrap/bootstrap.sh
```

See `deploy/bootstrap/bootstrap.sh` for full usage.

---

## Cloudflare Tunnel (cloudflared) Configuration

The tunnel connects the Docker host to Cloudflare's edge. Two hostnames are exposed:

| Hostname                    | Backend port | Purpose                                  |
| --------------------------- | ------------ | ---------------------------------------- |
| `proxy-ui.example.com`      | 9180         | APISIX embedded dashboard (Admin UI)     |
| `proxy-grafana.example.com` | 3000         | Grafana — per-consumer usage graphs      |
| `proxy-api.example.com`     | 9080         | APISIX proxy endpoint for agent requests |

The example config is at `deploy/cloudflared/config.example.yml`.

**Rename to `config.yml` and replace placeholders before running:**

```bash
cp deploy/cloudflared/config.example.yml /path/to/cloudflared/config.yml
# edit tunnel ID and hostnames
```

The cloudflared container in docker-compose mounts `./cloudflared:/etc/cloudflared:ro`.
Place your real `config.yml` and the tunnel `credentials.json` file in `deploy/cloudflared/`
(the credentials JSON is obtained from `cloudflared tunnel create <name>` and must not be
committed to version control).

---

## Cloudflare Zero Trust Setup — API Token Bypass

> **This is the most important section.** The Bypass policy on the API hostname is what
> allows agents to reach APISIX without CF intercepting or validating their requests.
> APISIX's `key-auth` plugin is the sole authentication layer on the API path.

### Two CF Access Applications

You need two separate Self-Hosted applications in the CF Zero Trust dashboard.

#### Application 1 — Dashboard / UI (Allow policy)

1. Zero Trust dashboard → **Access** → **Applications** → **Add application** → **Self-hosted**
2. **Application name:** `Reddit Proxy UI`
3. **Application domain:** `proxy-ui.example.com`
4. Click **Next** → **Add a policy**
5. **Policy name:** `Owner only`
6. **Action:** `Allow`
7. **Include rule:** `Emails` → `owner@example.com`
8. Save and deploy.

Repeat these steps for a second Self-Hosted application with **Application domain**
`proxy-grafana.example.com` and the same `Allow` / owner-email policy, so Grafana is
reachable only by the owner.

Effect: Only the owner's browser session (after IdP login) can reach the APISIX
dashboard and Grafana. No automated agent can access these hostnames.

#### Application 2 — Proxy API (Bypass policy)

1. **Add application** → **Self-hosted**
2. **Application name:** `Reddit Proxy API`
3. **Application domain:** `proxy-api.example.com`
4. Click **Next** → **Add a policy**
5. **Policy name:** `Bypass all`
6. **Action:** `Bypass`
7. **Include rule:** `Everyone`
8. Save and deploy.

Effect: Cloudflare passes **all** traffic to `proxy-api.example.com` through to cloudflared
without any CF authentication check. The APISIX `key-auth` plugin validates the `apikey`
header on every request, identifying the consumer and blocking requests without a valid key.

> **Why Bypass and not CF Service Auth?**
>
> The stated intent is "defer API authentication to the backend." Bypass is the CF primitive
> that literally passes traffic through. Service Auth would have CF validate a
> `CF-Access-Client-Id`/`CF-Access-Client-Secret` pair at the edge — that means CF (not
> APISIX) validates the token, contradicting the intent.
>
> **Tradeoff:** With Bypass, if APISIX's `key-auth` plugin is accidentally removed or
> misconfigured, the endpoint is publicly reachable over the internet. Service Auth adds a
> CF-level defense-in-depth layer at the cost of CF doing the validation. If defense-in-depth
> is required, switch to Service Auth: create one CF service token per agent, distribute
> `CF-Access-Client-Id`/`CF-Access-Client-Secret` to each agent alongside the APISIX key,
> and configure the API application with a Service Auth policy.

#### cloudflared JWT Validation Caveat

If cloudflared is configured with an `access` block in the ingress stanza, its
`AccessJWTValidator` middleware may reject requests even for Bypass-policy applications
(known CF community issue). **Do not add an `access:` block to the API ingress rule** in
`config.yml`. The example config in this repo has none.

---

## Minting Per-Agent Tokens

Each agent gets its own APISIX Consumer. Create one via the Admin API:

```bash
# Replace APISIX_ADMIN_KEY and values as appropriate
curl -s -X PUT "http://apisix:9180/apisix/admin/consumers" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "agent-01",
    "plugins": {
      "key-auth": {"key": "sk-agent-01-secretkey"}
    }
  }'
```

Or use the bootstrap script with the `AGENT_KEYS` env var (see `deploy/bootstrap/bootstrap.sh`).

### Revoking an agent

Delete the consumer by username:

```bash
curl -s -X DELETE "http://apisix:9180/apisix/admin/consumers/agent-01" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}"
```

The agent's key immediately stops working; no restart needed.

---

## Reddit OAuth App Setup

1. Go to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps).
2. Click **"are you a developer? create an app"**.
3. Choose type **script** (confidential client; supports `client_credentials` grant).
4. Fill in a name, description, and a redirect URI (any valid URI; not used for
   `client_credentials`).
5. Note the **client ID** (shown below the app name) and **client secret**.

> **November 2025 caveat:** Reddit closed self-service app registration and now requires
> manual approval via the "Responsible Builder Policy" form. Apply early; approval may take
> days to weeks. If your existing credentials predate November 2025, they continue to work.
> Reference: [Wappkit guide](https://www.wappkit.com/blog/reddit-api-credentials-guide-2025).

### Token Refresh

The `token-refresher` sidecar handles token acquisition automatically:

- On startup, it POSTs to `https://www.reddit.com/api/v1/access_token` with
  `grant_type=client_credentials` and Basic auth (`client_id:client_secret`).
- Every 55 minutes it re-requests a fresh token (tokens expire after 60 minutes;
  `client_credentials` has no refresh token — you must re-request).
- On success, it PATCHes the APISIX route via the Admin API to update the
  `proxy-rewrite` `Authorization: Bearer <token>` header.

The route ID used by the refresher is configured via the `APISIX_ROUTE_ID` env var
(default: `reddit-route`). Set `REDDIT_USER_AGENT` to a string matching Reddit's required
format: `<platform>:<app-id>/<version> by u/<reddit-username>`.

---

## Observability

The APISIX Prometheus plugin emits metrics on port 9091 at
`/apisix/prometheus/metrics`. Key metrics for per-consumer monitoring:

| Metric                | Labels                      | Use                               |
| --------------------- | --------------------------- | --------------------------------- |
| `apisix_http_status`  | `consumer`, `route`, `code` | Request counts per agent and code |
| `apisix_http_latency` | `consumer`, `route`, `type` | Latency percentiles per agent     |
| `apisix_bandwidth`    | `consumer`, `route`, `type` | Bytes transferred per agent       |

**PromQL for per-agent request rate:**

```
sum(rate(apisix_http_status[5m])) by (consumer)
```

**Grafana setup:**

1. Grafana is provisioned automatically from `deploy/grafana/provisioning/`.
2. Import dashboard **ID 11719** from Grafana.com (APISIX official dashboard):
   Grafana → Dashboards → Import → enter `11719` → select Prometheus datasource.
3. A minimal per-consumer panel JSON is included at
   `deploy/grafana/dashboards/per-consumer.json` for quick-start.

**Accessing dashboards:**

The APISIX embedded UI (`:9180/ui/`) is exposed via `proxy-ui.example.com` and Grafana
(`:3000`) via `proxy-grafana.example.com`. Both sit behind CF Access **Allow** policies —
open in a browser and authenticate with the owner email.

Request logs go to APISIX's stdout (visible via `docker compose logs apisix`). For
persistent log shipping, add the `http-logger` or `kafka-logger` APISIX plugin to the route.

---

## Plugin Client Configuration (Env Vars)

Add these to the agent's environment to enable proxy mode:

```bash
# Required: base URL of the APISIX proxy API hostname
export REDDIT_PROXY_URL="https://proxy-api.example.com"

# Required: per-agent APISIX consumer key
export REDDIT_PROXY_TOKEN="sk-agent-01-secretkey"

# Optional: header name to send the token in (default: apikey)
export REDDIT_PROXY_HEADER="apikey"
```

With these set, `reddit-fetch.sh` sends all fetch requests to the proxy instead of
directly to reddit.com. Without them, the script uses `https://www.reddit.com` (original
behavior, unchanged).

See the plugin `README.md` for more details on proxy mode usage.

---

## Deploying via nsheaps/iac "arcane" Workflow

> [!WARNING]
> **PROVISIONAL** — The iac/arcane deployment contract could not be read from this
> environment. The description below documents the **assumed** contract based on common
> patterns in this org. Every item marked `TODO(nate):` requires confirmation before this
> section can be relied upon.

**Assumed contract:**

The `nsheaps/iac` repository contains infrastructure-as-code for this org. The "arcane"
workflow is assumed to be a GitHub Actions workflow that:

1. Detects changes to a docker-compose stack committed under a known path in `nsheaps/iac`.
2. Deploys the stack to a cloudflared-connected Docker host (assumed reachable via SSH or
   a dedicated deploy mechanism).
3. Injects secrets from a secrets store (1Password or GitHub Actions secrets) into the
   host's environment or the stack's `.env` at deploy time.

**`TODO(nate):` items that must be confirmed:**

- `TODO(nate): Where do compose stacks live in nsheaps/iac?` (e.g. `stacks/reddit-proxy/`,
  `services/reddit/`, or another convention)
- `TODO(nate): What is the exact directory naming convention for stack registration?`
- `TODO(nate): How is the arcane workflow triggered?` (push to main, manual dispatch, PR merge?)
- `TODO(nate): How are secrets injected at deploy time?` (op run, OIDC, encrypted env file,
  GitHub Actions secrets → host env via SSH, or another mechanism)
- `TODO(nate): How is the compose stack wired to cloudflared?` (cloudflared is a container
  in the same compose network, or a host-level daemon with a separate config path?)
- `TODO(nate): Is there an existing cloudflared tunnel for this host, or must a new tunnel
be created?`
- `TODO(nate): Does the arcane workflow handle the APISIX bootstrap step, or must it be run
manually after first deploy?`

**Provisional deploy steps (to be verified against iac/arcane docs):**

1. Copy `deploy/` to the appropriate path in `nsheaps/iac`.
2. Fill in secrets in the iac secrets store per the org convention.
3. Commit and push; trigger the arcane workflow.
4. Once the stack is healthy, run `deploy/bootstrap/bootstrap.sh` to provision
   APISIX consumers and routes.
5. Configure the two CF Access applications (UI Allow, API Bypass) as described above.
6. Test with: `curl -H "apikey: sk-agent-01-xxx" https://proxy-api.example.com/r/ClaudeCode.json`

---

## Security Notes and Open Risks

| Risk                                             | Severity   | Mitigation                                                                                               |
| ------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| Reddit OAuth approval gating                     | HIGH       | Apply early via Responsible Builder Policy; ensure use-case description is compliant                     |
| 100 QPM rate limit shared across all agents      | MEDIUM     | Use APISIX `limit-count` per consumer; register additional Reddit apps if volume grows                   |
| Bypass policy leaves API unguarded at CF layer   | MEDIUM     | Accept (APISIX config is controlled) or switch to CF Service Auth for defense-in-depth                   |
| token-refresher SPOF                             | LOW-MEDIUM | Add health-check alerting; implement retry/backoff (included in the script); consider two-token rotation |
| cloudflared Bypass + AccessJWTValidator conflict | LOW        | Do not add `access:` block to API ingress rule; validate in staging; fallback: Service Auth              |

---

## References

- [Apache APISIX Prometheus plugin](https://apisix.apache.org/docs/apisix/plugins/prometheus/) — consumer label, metric names, export URI
- [Apache APISIX Dashboard docs](https://apisix.apache.org/docs/apisix/dashboard/) — embedded UI in 3.x
- [APISIX Docker deploy docs](https://apisix.apache.org/docs/docker/manual/)
- [APISIX key-auth plugin](https://apisix.apache.org/docs/apisix/plugins/key-auth/)
- [Reddit OAuth2 wiki](https://github.com/reddit-archive/reddit/wiki/oauth2) — client_credentials grant, token endpoint
- [Reddit API Rate Limits 2026](https://painonsocial.com/blog/reddit-api-rate-limits-guide) — 100 QPM, 10-min window
- [Reddit API Credentials 2025 (Wappkit)](https://www.wappkit.com/blog/reddit-api-credentials-guide-2025) — approval process changes Nov 2025
- [Reddit API Is Officially Dead in 2026 (Medium)](https://medium.com/@alex_79882/reddits-api-is-officially-dead-in-2026-here-s-what-i-use-instead-f88ee5b809c8) — 403 on unauthenticated endpoints
- [CF Access policies docs](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [CF Access service tokens docs](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [cloudflared configuration file docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- [CF community: Bypass + AccessJWTValidator issue](https://community.cloudflare.com/t/access-policy-to-bypass-auth-requirements-for-specific-subpath/455603)
- [Grafana dashboard APISIX ID 11719](https://grafana.com/grafana/dashboards/11719)
