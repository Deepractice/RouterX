# CLAUDE.md

## Language

Always respond in Chinese.

## The Iron Law: BDD First

> **Feature files are the documentation. Code is just implementation. No feature = no code.**

## Quick Reference

| What              | Where                                |
| ----------------- | ------------------------------------ |
| Router BDD        | `bdd/features/router.feature`        |
| Server BDD        | `bdd/features/server.feature`        |
| E2E Ark BDD       | `bdd/features/e2e-ark.feature`       |
| E2E AgentX BDD    | `bdd/features/e2e-agentx.feature`    |

## Commands

```bash
bun install && bun build        # Setup
bun run test:bdd                # Run BDD tests (unit)
bun run test:e2e                # Run E2E tests (requires .env.local)
bun run dev                     # Start local dev server (port 3700)
bun run check                   # Lint + format check (Biome)
bun run check:fix               # Auto-fix lint + format
```

## Architecture

- `@routerxjs/core` — Router engine (model matching, provider registry)
- `routerxjs` — Hono app + Vercel AI SDK for upstream LLM calls
- Vercel AI SDK handles all protocol-level complexity
- We only do routing + thin request/response formatting

## Environment

```bash
ARK_API_KEY                     # Volcengine Ark API key
ARK_BASE_URL                    # Ark base URL
```
