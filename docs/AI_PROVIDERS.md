# AI provider evaluation

_Verified on 2026-09-25 by reading the official documentation pages linked
below. Quotas and terms change; re-verify before relying on them in
production, and update the date here._

Nothing below implies a free tier permits unlimited commercial use. Free tiers
are treated as development and low-volume tiers only. The default provider in
every environment without keys is `mock`.

## Summary

| Provider | Adapter | Verified free tier (2026-09-25) | Data-use caveat | Suitable for |
|---|---|---|---|---|
| Google Gemini (AI Studio) | `gemini` | Exists per project; exact RPM/TPM/RPD are shown only in the AI Studio rate-limit dashboard, not on the public docs page | Unpaid Services: prompts and outputs may be human-reviewed and used to improve Google products. Docs say: "Do not submit sensitive, confidential, or personal information to the Unpaid Services." | Structured generation, coaching turns, embeddings (`gemini-embedding-001`) on a **paid** key when user content is involved |
| Groq | `openai-compatible` | Per-model free limits roughly 10–30 RPM, 100–14,400 RPD, 1.2K–15K TPM, 3.6K–500K TPD | Commercial-use permission on the free tier is not stated on the rate-limits page. Unverified. | Low-latency hints and short coaching turns |
| OpenRouter | `openai-compatible` | `:free` models: 20 RPM and 50 RPD without purchased credits; 1,000 RPD after $10 lifetime credits | Provider data policies vary per upstream model; not stated on the limits page | Model diversity, fallback routing, paid tiers |
| Ollama (local) | `openai-compatible` | No quota; local hardware | Data never leaves the machine | Local development and experimentation |
| Cloudflare Workers AI | not implemented | Not evaluated this pass | — | Deferred (ADR-0004) |

## Model identifiers seen in official docs (2026-09-25)

These are recorded so configuration does not rely on stale names. Confirm
availability in your region and tier before use.

- Gemini text models: `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`,
  `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`,
  `gemini-3.1-pro-preview`, `gemini-3-flash-preview`.
- Gemini embeddings: `gemini-embedding-001`, `gemini-embedding-2-preview`.
- Groq production text models: `llama-3.1-8b-instant`,
  `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`
  (131,072-token context). Speech: `whisper-large-v3`, `whisper-large-v3-turbo`.

## Policy decisions

1. **User-authored content** (notes, documents, project details) is sent only
   to providers configured with a paid key or to a local Ollama endpoint. The
   router enforces this via a `allowsUserContent` flag per provider config.
2. **Curated exercise coaching** (no private user documents) may use free
   tiers in development.
3. Every request records an `AIUsageRecord`; budgets are enforced per user per
   day and month before a provider is called.
4. Structured output is validated with Zod locally; one repair retry maximum.

## Sources

- Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini terms (Unpaid Services): https://ai.google.dev/gemini-api/terms
- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Groq rate limits: https://console.groq.com/docs/rate-limits
- Groq models: https://console.groq.com/docs/models
- OpenRouter limits: https://openrouter.ai/docs/api-reference/limits
