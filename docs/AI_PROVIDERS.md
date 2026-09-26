# AI providers

_Verified on 2026-09-26 against official pricing, rate-limit and model-list
pages (sources below). Items marked [u] could not be confirmed on an official
page. Free lineups change monthly; re-check before relying on a number._

Free tiers are development and low-volume tiers. The default provider in every
environment without keys is `mock`.

## Free tiers (2026-09-26)

| Provider | Id | Free allowance | Card? | Trains on free prompts? | Default models (cheap / strong) |
|---|---|---|---|---|---|
| Groq | `groq` | 30 RPM, 1,000 RPD, 8K TPM, 200K TPD per model, per organisation | No [u] | No; not retained by default | `openai/gpt-oss-20b` / `openai/gpt-oss-120b` |
| OpenRouter | `openrouter` | `:free` models at 20 RPM; 50 RPD, or 1,000 RPD after $10 of lifetime credit | No | Providers that train are excluded unless you enable it | `qwen/qwen3.8-27b:free` / `nvidia/nemotron-3-super-120b-a12b:free` |
| Google Gemini | `gemini` | Limits shown only in AI Studio; third parties report about 20 RPD on Flash and 500 RPD on Flash-Lite [u] | No | **Yes**: free-tier content is used to improve Google products | `gemini-3.5-flash-lite` / `gemini-3.5-flash` |
| Mistral (Free/Experiment) | `mistral` | Not published; reported about 1 request/s and 1B tokens/month [u]; phone check [u] | No | **Yes by default**; opt out in the console | `mistral-small-latest` / `mistral-medium-latest` |
| Cloudflare Workers AI | `cloudflare` | 10,000 neurons/day | No | [u] | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (JSON mode only on some models) |
| NVIDIA build.nvidia.com | `nvidia` | Trial terms; about 40 RPM reported [u] | No [u] | [u] | `nvidia/nemotron-3-super-120b-a12b` / `nvidia/nemotron-3-ultra-550b-a55b` |
| Cerebras | `cerebras` | **Trial only**: $5 credit for 30 days, then paid | [u] | [u] | `gpt-oss-120b` |
| Ollama (local) | `ollama` | Unlimited on your own hardware | No | No; data stays local | `llama3.1` |
| Any OpenAI-compatible gateway | `openai_compatible` | Depends on service | | | Set `AI_MODEL_CHEAP` / `AI_MODEL_STRONG` |

Not usable as free providers: **GitHub Models** (retired 2026-07-30),
**Together AI** ($5 minimum purchase), **SambaNova** (official pages
contradict each other; treat as paid), **Cohere** trial keys (1,000
calls/month, evaluation only), **Hugging Face** Inference Providers ($0.10 per
month free).

## Using several providers interchangeably

Add every key you have to `apps/api/.env` (or the host's environment), pick a
default and list fallbacks in order:

```
AI_PROVIDER_DEFAULT=groq
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
GEMINI_API_KEY=...
MISTRAL_API_KEY=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
AI_FALLBACKS=openrouter,gemini,mistral,cloudflare
AI_ALLOW_USER_CONTENT=groq,openrouter
```

- Each task tries the default provider (with one retry), then each fallback
  once, in order. Plain calls and structured (JSON) calls both fall back; a
  structured call also moves on when a model's JSON still fails validation
  after its repair attempt.
- A bare name in `AI_FALLBACKS` uses that provider's default cheap or strong
  model for the task. Use `provider:model` to pick one, for example
  `gemini:gemini-3.5-flash-lite`.
- `AI_ROUTE_<TASK>=provider:model` still pins a single task, for example
  `AI_ROUTE_COACH_ASSESS=gemini:gemini-3.8-flash`.
- Providers without a key are skipped silently, so the same chain works on
  every machine.
- Every attempt, successful or not, is recorded in `ai_usage` and visible on
  the admin page, so you can see which provider actually answered.

Recommended free chain for this app: **Groq** first (fast, strict JSON, no
training), **OpenRouter** free models second (a one-time $10 top-up raises the
cap from 50 to 1,000 requests a day), **Gemini** Flash-Lite third,
**Mistral** fourth, **Cloudflare** last.

## Private content

Features that send your own writing (council, reading, strategy projects,
missions, negotiations) only use providers listed in `AI_ALLOW_USER_CONTENT`.
With private content, the router drops unlisted providers from the chain; if
none remain, the feature reports that no approved provider is configured.

Do **not** list `gemini` or `mistral` there on free keys unless you accept
that free-tier prompts may be used for training (or have opted out, for
Mistral). Groq and OpenRouter (with training providers excluded) are the
reasonable free choices; Ollama is the fully private one.

## Other policies

1. Every request records an `AIUsageRecord`; budgets are enforced per user per
   day and month before a provider is called.
2. Structured output is validated with Zod locally, with one repair attempt
   per provider.
3. The mock provider is used by all tests and E2E; it echoes the example JSON
   embedded in each prompt, so prompt quality still needs a real-provider run.

## Sources

- Groq: https://console.groq.com/docs/rate-limits, https://console.groq.com/docs/structured-outputs, https://console.groq.com/docs/your-data
- OpenRouter: https://openrouter.ai/docs/api-reference/limits, https://openrouter.ai/api/v1/models
- Gemini: https://ai.google.dev/gemini-api/docs/pricing, https://ai.google.dev/gemini-api/docs/rate-limits, https://ai.google.dev/gemini-api/docs/models
- Mistral: https://docs.mistral.ai/getting-started/models, help.mistral.ai (Free mode and training articles)
- Cloudflare: https://developers.cloudflare.com/workers-ai/platform/pricing
- NVIDIA: https://integrate.api.nvidia.com/v1/models, https://build.nvidia.com
- Cerebras: https://inference-docs.cerebras.ai/support/rate-limits
- Ollama: https://ollama.com/pricing
