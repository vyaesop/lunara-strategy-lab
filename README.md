# Lunara Strategy Lab

An AI-assisted training platform for strategic thinking, deduction and
decision-making. The coach asks before it explains; sessions follow a
server-enforced learning flow; scoring separates assisted learning from
unaided mastery.

## Quick start (no credentials needed)

```
pnpm install
pnpm dev            # API on :8787 (embedded PGlite, mock AI) + web on :5173
```

Open http://localhost:5173, create an account, and start "The Locked Archive".

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | API + web dev servers |
| `pnpm test` | Vitest: packages + API routes on in-memory PGlite |
| `pnpm typecheck` | `tsc --noEmit` in every workspace |
| `pnpm lint` | ESLint |
| `pnpm build` | Production client build (`apps/client/dist`) |
| `pnpm db:generate` | Generate a Drizzle migration after editing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` (or the local PGlite) |

## Configuration

Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL` (Neon),
`BETTER_AUTH_SECRET` and any AI provider keys. Without keys the deterministic
mock provider is used. See `docs/ARCHITECTURE.md` and `docs/AI_PROVIDERS.md`.

## Docs

- `docs/PROJECT_STATUS.md` — current phase, what works, what is next
- `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/MOBILE.md`
- `docs/adr/` — architecture decisions
