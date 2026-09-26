# ADR-0004: Provider-agnostic AI layer with task routing and budgets

- Status: Accepted
- Date: 2026-09-25

## Context

Minimise recurring cost, avoid lock-in, keep tests free of network calls,
and make sure private user content only reaches approved providers.

## Decision

- `packages/ai` defines `AIProvider`, a capability registry and `ModelRouter`
  keyed by task (`coach.turn`, `coach.hint`, `coach.assess`,
  `exercise.generate`, `council.role`, `tree.audit`, `embed`, `health`).
- Adapters: `mock` (default), `openai-compatible` (Groq, OpenRouter, Ollama,
  any OpenAI-style endpoint), `gemini` (REST). Plain `fetch`, no vendor SDKs.
- Configuration is environment-driven (`buildAIFromEnv`); per-task overrides
  via `AI_ROUTE_<TASK>=provider:model`; fallbacks are explicit and never
  escalate to an unconfigured provider.
- `AI_ALLOW_USER_CONTENT` lists providers approved for private user content;
  calls flagged `containsUserContent` are refused elsewhere.
- Structured output is validated with Zod locally with one bounded repair
  retry regardless of provider support.
- Per-user daily request and monthly cost budgets are checked before any
  provider call; every attempt is recorded without prompt text.

## Consequences

- The platform is fully usable with no keys (mock), which also keeps CI free.
- Provider pricing, quotas and model names are recorded with verification
  dates in `docs/AI_PROVIDERS.md` and must be re-verified before production.
