# Lunara Strategy Lab — Architecture

_Last updated: 2026-09-25 (end of Phase 1)._

## 1. Origin and stack decision

The brief pointed at a GitHub repository that turned out to be an unrelated
Firebase cycle tracker; the owner clarified that the local `Downloads/apps/lunara`
project (Vite + React + Capacitor + Cloudflare Workers) was only a stack
*suggestion*, that Postgres on Neon is required, and that the stack choice was
delegated. The chosen stack (ADR-0001, ADR-0005):

| Layer | Choice | Why |
|---|---|---|
| Client (web + Android/iOS) | Vite 8, React 19, TypeScript strict, Tailwind 4, React Router 7, TanStack Query 5, Capacitor 8 | One UI codebase ships as a static web app and as a native-packaged mobile app with native plugins (preferences, haptics, status bar, notifications later). |
| API | Hono 4 on Node (`@hono/node-server`), portable to Cloudflare Workers | Web-standard Request/Response, tiny, runs anywhere free-tier hosting exists. |
| Database | Postgres on Neon via Drizzle ORM 0.45; embedded PGlite for local dev and tests | Owner requirement; Drizzle gives typed schema + SQL migrations; PGlite means zero-credential development and fast CI. |
| Auth | Better Auth 1.7 (email + password, bearer plugin) | Works with Drizzle/Postgres, cookies for web and bearer tokens for the Capacitor WebView. |
| AI | `packages/ai`: provider-agnostic layer with mock, OpenAI-compatible (Groq, OpenRouter, Ollama) and Gemini adapters | Cost control, no lock-in, deterministic tests. |
| Tests | Vitest 5 | Pure packages + API routes against in-memory PGlite. |

## 2. Workspace layout

```
.
├── apps/
│   ├── client/        Vite React SPA; Capacitor config (Android/iOS shells generated with `cap add`)
│   └── api/           Hono API, Drizzle schema + migrations, Better Auth, AI wiring
├── packages/
│   ├── schemas/       Zod domain models + API contracts (isomorphic)
│   ├── core/          Pure domain logic: session machine, hint ladder, scoring, skills, streaks
│   ├── curriculum/    Curated exercises (public + hidden parts); hidden parts are only read by the API
│   └── ai/            Server-only provider abstraction, router, usage accounting
├── docs/              Architecture, data model, status, ADRs, provider verification
├── tsconfig.base.json, vitest.config.mts, pnpm-workspace.yaml, .npmrc (hoisted)
```

Rule: anything that touches a secret, the database or hidden exercise material
lives in `apps/api` or `packages/ai` and is never imported by `apps/client`.
The client imports only `@lunara/schemas` and `@lunara/core` (pure functions
and definitions).

## 3. Runtime topology

```
   browser (web)           Capacitor WebView (Android/iOS)
        │ cookie + bearer            │ bearer (Preferences store)
        ▼                            ▼
   ┌─────────────────────────────────────────────┐
   │ apps/api (Hono)                             │
   │  /api/auth/*   Better Auth                  │
   │  /api/v1/*     requireUser → rateLimit →    │
   │                routes (me, exercises,       │
   │                sessions, ai)                │
   │  session phase machine  (packages/core)     │
   │  AI router + budgets    (packages/ai)       │
   └───────────┬───────────────────┬─────────────┘
               │ Drizzle           │ HTTPS
               ▼                   ▼
      Postgres (Neon) or      AI providers
      PGlite (local/test)     (mock by default)
```

In development Vite proxies `/api` to the API so the web app is same-origin.
In production the client is a static site (any CDN) and the API is a Node or
Workers deployment; `VITE_API_BASE_URL` points the client at it and
`CLIENT_ORIGINS` on the API allow-lists the client origins for CORS with
credentials (`capacitor://localhost` and `https://localhost` for the mobile shell).

## 4. Domain boundaries

| Domain | Where | Notes |
|---|---|---|
| Identity | Better Auth tables (`user`, `session`, `account`, `verification`) | Never modified directly except account deletion (cascade). |
| Profile & preferences | `profiles` table, `services/profile.ts` | Created on first `/api/v1/me`. Onboarding answers are preferences, never skill claims. |
| Exercises | `packages/curriculum` | Versioned typed data; `ExercisePublic` vs `ExerciseHidden`. DB-backed authoring arrives with the admin phase. |
| Coaching sessions | `coaching_sessions`, `session_messages`, `services/sessions.ts`, `packages/core/session` | Phase, hints, reveal and decision are server-authoritative (ADR-0003). |
| Skills | `skill_assessments`, `packages/core/skills` | Definitions with scoring method and evidence source; update rule is tested. Written by the assessment step (Phase 2). |
| AI | `packages/ai`, `services/coach.ts`, `services/usage.ts` | Task routing, budgets, `ai_usage` records without prompt text. |
| Limits | `rate_limits` table, `middleware.ts` | Fixed window per user/IP, works across instances. |

### Domains added in Phases 3–6

| Domain | Pure logic (`packages/core`) | Content (`packages/curriculum`) | API (`apps/api/src`) | Tables |
|---|---|---|---|---|
| Inference Lab | `investigation/engine` (actions, evidence release, links, deterministic evaluation) | `investigations/` | `services/investigations`, `routes/investigations` | `investigation_sessions` |
| Scenario trees | `tree/audit` (structural findings, diff) | — | `services/trees`, `routes/trees` | `scenario_trees` |
| Simulations | `simulation/engine` (turns, effects, bands, counterfactual labels) | `simulations/` (source records + claims) | `services/simulations`, `routes/simulations` | `simulation_sessions` |
| War Room | — | — | `services/council`, `routes/council` (5 roles, structured, no voting) | `council_sessions` |
| Reading & memory | `review/scheduler` (FSRS), `knowledge/concepts` (dedup) | — | `services/reading`, `knowledge`, `review` | `reading_*`, `knowledge_*`, `review_items` |
| Strategy Lab | `strategy/briefing` (deterministic daily picks) | `puzzles` | `services/strategy`, `routes/strategy` | `strategic_projects`, `decision_records`, `daily_briefings` |
| Negotiation | `negotiation/engine` (utility, acceptance, counters) | `negotiations` | `services/negotiation`, `routes/negotiations` | `negotiation_sessions` |
| Missions | — | `missions` | `services/missions`, `routes/missions` | `custom_missions`, `mission_sessions` |
| Game | `game/engine` (seeded, deterministic) | — | `services/game` | `game_sessions` |
| Challenge | — | `challenges` | `services/challenge` | `challenge_attempts` |

Every AI call in these domains goes through `ModelRouter` with a task, a
per-user budget check, and a Zod schema; every prompt carries an
`EXAMPLE_JSON` block so the mock provider exercises the full pipeline in
tests. Deterministic parts (evidence release, acceptance, effects, scores
aggregated from rubric criteria) never depend on the model.

## 5. Session phase machine (core invariant)

```
introduction → initial_understanding → hypothesis → evidence_challenge
            → revision → final_decision → debrief → skill_update → completed
   loops allowed: evidence_challenge→hypothesis, revision→evidence_challenge, revision→hypothesis
```

- Forward moves are one step at a time. `final_decision` needs a recorded
  hypothesis; `debrief` needs a decision or an explicit reveal.
- Hints are sequential (1→5); level 5 is the worked explanation and counts as
  a reveal; it unlocks only after a genuine attempt.
- `releaseHiddenMaterial(state, hidden)` is the single gate deciding which
  hidden fields a client may see. Route handlers never read hidden fields
  except through it (and the hint route, which returns exactly the level just
  earned).
- The coach prompt receives the solution only when the state already
  releases it to the learner; coach-only guidance (key insights, common
  errors, coach notes) is passed with a do-not-disclose instruction, and
  hidden-answer access is still enforced by the server, not by the prompt.

## 6. AI layer

- `AIProvider` interface (`generate`, `stream`, `generateStructured` via helper, `embed?`, `capabilities`).
- `ModelRouter.generate(task, messages, { containsUserContent })`: resolves
  provider/model per task, applies a timeout, one retry on retryable errors,
  then an explicit fallback if configured. It never escalates to an
  unconfigured route and refuses private user content on providers not in
  `AI_ALLOW_USER_CONTENT`.
- `buildAIFromEnv` maps env vars to providers and routes; without keys
  everything is the deterministic mock, so the platform works offline.
- Budgets: `assertWithinBudget` checks daily request count and monthly
  estimated cost per user before any provider call; `UsageSink` writes one
  `ai_usage` row per attempt.
- Provider facts and dates: `docs/AI_PROVIDERS.md`.

## 7. Data model

See `docs/DATA_MODEL.md` for tables, JSON column shapes and lifecycle.
Migrations live in `apps/api/drizzle` and are applied automatically on API
start (Neon or PGlite).

## 8. Environments

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | api | Neon/Postgres connection string; unset = PGlite in `apps/api/.data/pglite` |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | api | Auth secret (required in production) and public API URL |
| `CLIENT_ORIGINS` | api | Allowed client origins for CORS + Better Auth trusted origins |
| `AI_PROVIDER_DEFAULT`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`, `AI_MODEL_*`, `AI_ROUTE_*`, `AI_ALLOW_USER_CONTENT` | api | Provider selection and routing |
| `RATE_LIMIT_PER_MINUTE`, `AI_DAILY_REQUEST_LIMIT`, `AI_MONTHLY_COST_LIMIT_USD` | api | Limits |
| `VITE_API_BASE_URL` | client | API origin for the mobile app / split deployments |

Templates: `apps/api/.env.example`, `apps/client/.env.example`.

## 9. Testing

- `pnpm test` runs Vitest across packages and the API. API tests boot an
  in-memory PGlite, apply migrations, sign up through Better Auth over
  `app.request()` and exercise the routes with the mock AI provider. No
  credentials or network.
- `pnpm typecheck` runs `tsc --noEmit` in every workspace.
- Browser E2E (Playwright) and a Capacitor smoke test are planned for Phase 2/7.
