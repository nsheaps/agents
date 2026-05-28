---
name: k8s-controllers
status: draft
description: Kubernetes controllers for managing agent lifecycle — provisioning, health monitoring, and scaling agent pods
parent:
related:
  - agent-harness-lifecycle
  - agent-launcher
  - observability
  - tilt-orchestration
owner: jack
created: 2026-04-08
updated: 2026-04-08
tags:
  - kubernetes
  - infrastructure
  - deployment
---

# Kubernetes Controllers for Agent Lifecycle

## Problem Statement

Agents currently run as long-lived processes on a single machine managed by hand.
There is no automated provisioning, health monitoring, or recovery when an agent
crashes. Moving to Kubernetes controllers would allow agents to be declaratively
defined, automatically restarted on failure, and scaled across nodes as the agent
count grows.

## Known Requirements

- Custom CRD (e.g. `Agent`) that describes an agent: image, persona, env, channel config
- Controller reconciles desired vs. actual state (creates/deletes pods accordingly)
- Health probe integration with existing harness lifecycle signals
- Secrets injected via 1Password operator or external-secrets, not baked into manifests

## Open Questions

- Target cluster? (local k3s, cloud-hosted, or both?)
- Does the harness need changes to support k8s-style readiness/liveness probes?
- Operator framework preference: controller-runtime (Go), kopf (Python), or other?
- Needs handler input on cluster topology before implementation begins.
