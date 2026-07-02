# Reddit Proxy Stack — Quick Start

> **Client-side proxy is OFF by default.** The `reddit-fetch.sh` script talks to Reddit directly unless you set `REDDIT_PROXY_URL`. Nothing in this deploy directory is required for normal plugin use.

For the full operator guide — architecture, Cloudflare Zero Trust setup, security model, and operational runbook — see [`../docs/proxy-deployment.md`](../docs/proxy-deployment.md).

---

## Prerequisites

- Docker + Docker Compose v2
- A Cloudflare account with Zero Trust enabled
- A Reddit OAuth2 "script" app (`client_id` + `client_secret`)
- `cloudflared` CLI to create a tunnel

---

## Deploy Steps

1. **Copy and fill in environment variables**

   ```bash
   cp .env.example .env
   $EDITOR .env
   ```

   Required: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`,
   `APISIX_ADMIN_KEY`, `GRAFANA_ADMIN_PASSWORD`, `AGENT_KEYS`, `TUNNEL_ID`.

2. **Create the Cloudflare Tunnel and place credentials**

   ```bash
   cloudflared tunnel create reddit-proxy
   # Copy the credentials JSON to:
   cp ~/.cloudflared/<tunnel-id>.json ./cloudflared/credentials.json
   ```

   See the full guide §4 (Cloudflare Zero Trust) for hostname and Access policy setup.

3. **Copy and fill in the cloudflared config**

   ```bash
   cp ./cloudflared/config.example.yml ./cloudflared/config.yml
   $EDITOR ./cloudflared/config.yml   # Replace <YOUR_TUNNEL_ID> and example.com hostnames
   ```

4. **Start the stack**

   ```bash
   docker compose up -d
   ```

5. **Bootstrap APISIX** (upstream, route, and agent consumer keys)

   ```bash
   # Run once after first start; safe to re-run (idempotent PUT calls).
   # The `bootstrap` service is profile-gated, so `up` never starts it; `run` does.
   docker compose run --rm bootstrap
   ```

   Or run directly from the host (APISIX must be reachable on localhost:9180):

   ```bash
   set -a; . ./.env; set +a
   APISIX_ADMIN_URL=http://localhost:9180 bash bootstrap/bootstrap.sh
   ```

6. **Verify**
   - APISIX proxy: `curl -H "apikey: <an-agent-key>" http://localhost:9080/r/test/.json`
   - APISIX UI: `https://proxy-ui.<your-domain>/ui/` (protected by CF Access)
   - Grafana: `https://proxy-grafana.<your-domain>/` (CF Access protected) or `http://localhost:3000` locally (admin / `GRAFANA_ADMIN_PASSWORD`)

---

## Connecting an Agent

Set these env vars in the agent's environment:

```bash
export REDDIT_PROXY_URL="https://proxy-api.your-domain.com"
export REDDIT_PROXY_TOKEN="sk-agent01-abc123"   # the agent's key from AGENT_KEYS
```

`REDDIT_PROXY_HEADER` defaults to `apikey`; override only if you changed the APISIX consumer key-auth header name.

---

## Stopping

```bash
docker compose down        # keeps volumes
docker compose down -v     # removes volumes (destroys etcd state — requires bootstrap re-run)
```
