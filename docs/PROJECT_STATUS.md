# Project status

_Last updated: 2026-09-26._ Resume here: read this file, then
`docs/ARCHITECTURE.md`, then the ADRs.

## Current phase

**Phases 0–7 implemented and verified against the mock AI provider, plus a
Lenis + GSAP design pass (ADR-0006). Code lives in the private repo
`vyaesop/lunara-strategy-lab`. Live on Vercel since 2026-09-26:
web https://lunara-strategy-lab.vercel.app, API https://strat-api.vercel.app
(Neon database, OpenRouter free models since 2026-09-26).**

## What exists and is verified

| Phase | Delivered | Verified by |
|---|---|---|
| 1 Foundation | pnpm monorepo; Zod schemas; pure core; provider-agnostic AI layer with budgets; Hono API on Drizzle (Neon in prod, PGlite locally); Better Auth (cookies + bearer); rate limits; design system; responsive shell; Capacitor config | typecheck, lint, unit + API tests |
| 2 Training loop | 6 curated exercises (deduction, critical thinking, strategic planning, abduction, Bayesian, negotiation prep); Socratic coach; sequential hints; hypotheses; decision; server-gated solution/debrief; AI rubric assessment → skill evidence; streaks; explained recommendations (7 rules incl. repeated error patterns and due reviews) | API tests, `training-loop.spec.ts` |
| 3 Inference Lab + trees | 2 investigations with deterministic evidence release, costed actions, evidence-linked hypotheses, confidence history, deterministic + AI evaluation, ground truth reveal; React Flow scenario tree editor with versions, structural audit and AI critique (independent / hints / audit) | engine + audit tests, API tests, `inference-lab.spec.ts` |
| 4 Simulations + War Room | Turn engine with hidden resources (bands), deterministic effects, counterfactual labelling, source records with certainty labels; Bismarck 1866 and Carnegie 1873; council of 5 roles with independent structured analyses, cross-critique, follow-ups, user decision record (no voting) | engine tests, API tests, `phase4.spec.ts` |
| 5 Reading + memory | Library (text/markdown/link/PDF via unpdf), paged reader, excerpts with locators, browser dictation, bounded-passage ask + question generation, per-document AI toggle; knowledge graph with dedup, merge, relations; FSRS spaced repetition with retention evidence | scheduler + concept tests, API tests, `phase5.spec.ts` |
| 6 Real-world | Strategy Lab projects (10 sections, AI suggestions accepted per item); decision journal with predictions, resolution and Brier calibration (shown after 10); precomputed daily briefing (10 puzzles, 14 questions, review, prediction prompt); negotiation role-play with deterministic acceptance and AI-voiced counterpart (2 scenarios); missions (2 curated + custom from projects) with debrief; Meridian trading game (seeded, deterministic, quarterly reports, personal rank); monthly master challenge (8 stages incl. adversarial review, compared with own attempts) | engine tests, API tests, `phase6*.spec.ts` |

| 7 Hardening | Data export, admin overview (usage, routing, content validation) behind a server-side flag, body limits, request ids and structured error logs, client error boundary, route-level code splitting, PWA service worker, deployment, security, backup and release docs, Capacitor Android project | API tests, full E2E |
| Providers + Neon | The owner's Neon database is connected through a gitignored `apps/api/.env` (loaded automatically, ignored by tests); migrations applied and a sign-up/session smoke test passed on 2026-09-26. Presets for Groq, OpenRouter, Gemini, Mistral, Cerebras, NVIDIA, Cloudflare, Ollama and any OpenAI-compatible endpoint; an ordered `AI_FALLBACKS` chain for plain and structured calls; private content only reaches approved providers | AI unit tests, API tests, full E2E |
| Hosting | Vercel projects `strat-api` (bundled Node function, migrations on production builds) and `lunara-strategy-lab` (static Vite build with SPA rewrite), both deploying from `main`; see `docs/DEPLOYMENT.md` | Live smoke test: sign-up, session, coach reply, reload, CORS, deep links, in a phone-sized browser with no console errors |
| Design | Lenis smooth scroll on GSAP's ticker; SplitText headings; DrawSVG compass; pinned landing narrative; route transitions; gliding sidebar indicator; count-ups; reduced-motion safe | screenshots in both themes and on a phone viewport, full E2E with animations on |

Totals at this update: 17 test files, 151 unit/API tests; 13 Playwright tests
booting the API (PGlite memory, mock AI) and Vite themselves.

## Not yet done

1. **Real-provider run (partial)**: on 2026-09-26 a full coached session ran
   against OpenRouter's free `nvidia/nemotron-3-super-120b-a12b:free`: a
   Socratic coach turn (about 4 s) and a validated rubric assessment with
   evidence-quoting feedback (about 30 s). Output caps were raised because
   reasoning tokens count against them (a 2,000-token cap truncated the first
   assessment). Not yet exercised on a real model: investigations, tree
   critique, simulations, the War Room council, reading, strategy, missions,
   negotiation and the monthly challenge.
2. **Free-tier capacity**: the OpenRouter key has no credits, so it allows 50
   free-model requests a day across all users. A one-time $10 purchase raises
   that to 1,000; adding a Groq key to `AI_FALLBACKS` adds more.
3. **Content authoring UI**: the admin overview reads metrics and validates
   content, but exercises, investigations, simulations, negotiations,
   missions and challenges are still authored as typed data in
   `packages/curriculum`, with no in-app editor or review queue.
4. **Remaining hardening**: hosted error monitoring, a formal accessibility
   audit, an `ai_usage` retention job, CI workflow.
5. **Mobile**: a debug APK pointed at the hosted API works on an emulator
   (see `docs/MOBILE.md`). Still missing: a signed release build, icons and
   splash assets, and local notifications for briefing reminders.
6. **OCR / photo capture** for reading; only PDFs with a text layer import.
7. **Email verification / password reset** (needs an email provider).

## Known limitations

- Coach prompts include coach-only guidance with a do-not-disclose rule;
  answer access is enforced server-side regardless.
- Transcript windows are bounded (20 messages coaching, 16 negotiation).
- Streaks and briefings use UTC days. Rate limit is a fixed one-minute window.
- Calibration and repeated-error signals need several sessions before they
  show; new accounts see honest empty states.
- Tree editor mobile editing is basic.

## Required external setup (none for development)

Production: `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`CLIENT_ORIGINS`, provider keys and `AI_ALLOW_USER_CONTENT` for features that
send private content (council, reading, projects, missions, negotiations). See
`apps/api/.env.example` and `docs/AI_PROVIDERS.md`. Android: `docs/MOBILE.md`.

## Commands used to verify this state

```
pnpm install
pnpm typecheck          # 6 workspaces clean
pnpm lint               # clean
pnpm test               # 17 files, 151 tests
pnpm test:e2e           # 13 Playwright tests
pnpm --filter @lunara/client build
pnpm dev                # api :8787 + web :5173
```

## Decisions log

See `docs/adr/`.
