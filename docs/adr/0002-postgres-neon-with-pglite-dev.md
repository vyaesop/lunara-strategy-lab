# ADR-0002: Postgres on Neon in production, PGlite for development and tests

- Status: Accepted
- Date: 2026-09-25

## Context

The owner hosts Postgres on Neon's free tier. Development and CI must not
require credentials, and route tests must run against a real SQL engine so
migrations and queries are exercised, not mocked.

## Decision

- Drizzle ORM (`drizzle-orm/pg-core`) defines the schema once; `drizzle-kit
  generate` produces SQL migrations committed under `apps/api/drizzle`.
- `openDb()` picks the driver: `DATABASE_URL` set → node-postgres pool
  (Neon-compatible, standard `sslmode=require` string); unset → embedded
  PGlite at `apps/api/.data/pglite`, or `memory://` in tests.
- Migrations are applied automatically on API start for both drivers, so
  `pnpm dev` works on a fresh clone with no setup.
- A Cloudflare Workers deployment would swap in `drizzle-orm/neon-http`;
  the schema and queries are unchanged.

## Consequences

- Tests run in seconds against a real Postgres dialect; PGlite covers
  `jsonb`, upserts, indexes and cascades used here.
- Behavioural differences between PGlite and Neon (extensions, connection
  pooling) must be checked before relying on Postgres-specific features not
  yet used.
