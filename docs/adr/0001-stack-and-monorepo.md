# ADR-0001: Stack and monorepo layout

- Status: Accepted
- Date: 2026-09-25

## Context

The brief's repository link pointed at an unrelated Firebase app. The owner
clarified that the local Vite + Capacitor project was a stack suggestion
only, that Postgres on Neon is required, and delegated the stack choice
with efficiency as the priority. The product needs a web app, an installable
Android/iOS app, a trusted backend, and shared domain logic.

## Decision

- **pnpm workspace** with `apps/client`, `apps/api`, `packages/{schemas,core,curriculum,ai}`.
  `node-linker=hoisted` for Capacitor/Vite tooling compatibility. No task
  runner; pnpm `-r` scripts are enough.
- **Client**: Vite 8 + React 19 + TypeScript strict + Tailwind 4 + React
  Router 7 + TanStack Query 5. The same bundle is the web app and the
  Capacitor app.
- **API**: Hono 4 on Node via `@hono/node-server`; the app is a web-standard
  `fetch` handler so it can move to Cloudflare Workers (with the Neon HTTP
  driver) without rewriting routes.
- **Database**: Drizzle ORM with SQL migrations; Neon in production, PGlite
  locally and in tests (ADR-0002).
- **Auth**: Better Auth with the bearer plugin (ADR-0005 explains the mobile
  cookie constraint).
- Shared packages are consumed as TypeScript source; Vite and tsx compile
  them, so there is no package build step.

## Consequences

- One React codebase for all platforms; no duplicated UI logic.
- Deployment is three free-tier-friendly pieces: static client, Node/Workers
  API, Neon database.
- TypeScript 5.9 is pinned workspace-wide (Vite's template suggests 6; not
  adopted to keep one compiler).
