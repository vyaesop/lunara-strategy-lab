# Deployment

Three pieces, each on a free tier if you want: a static client, a Node API,
and a Neon Postgres database.

## 1. Database (Neon)

1. Create a Neon project and copy the pooled connection string
   (`postgresql://…?sslmode=require`).
2. Set it as `DATABASE_URL` on the API host. Migrations in `apps/api/drizzle`
   run automatically on API start; to run them separately:
   `DATABASE_URL=… pnpm db:migrate`.
3. Neon keeps point-in-time history; see `docs/BACKUP.md` for the recovery
   procedure and the export path.

## 2. API (Node)

Any Node 22 host works (Render, Railway, Fly, a VPS). From the repo root:

```
pnpm install --frozen-lockfile
pnpm --filter @lunara/api start        # tsx src/index.ts
```

Environment (see `apps/api/.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV=production` | yes | enforces the two required secrets below |
| `DATABASE_URL` | yes | Neon connection string |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | public URL of the API, e.g. `https://api.example.com` |
| `CLIENT_ORIGINS` | yes | web origin plus `capacitor://localhost,https://localhost` for the mobile app |
| `ADMIN_EMAILS` | no | who gets the admin flag |
| `AI_PROVIDER_DEFAULT` + keys | no | without keys the mock provider answers; see `docs/AI_PROVIDERS.md` |
| `AI_ALLOW_USER_CONTENT` | no | providers approved to receive private content (council, reading, projects, missions, negotiations) |
| `RATE_LIMIT_PER_MINUTE`, `AI_DAILY_REQUEST_LIMIT`, `AI_MONTHLY_COST_LIMIT_USD` | no | defaults 60 / 200 / 5 |

Health check: `GET /health` returns `{ ok, ai, mock }`. Every response
carries `x-request-id`; 500s echo it in `error.details.requestId` and the
server logs a one-line JSON record with the same id and no user content.

A Cloudflare Workers deployment is possible (Hono is web-standard) by
swapping `openDb` to `drizzle-orm/neon-http`; not wired in this build.

## 3. Client (static)

```
VITE_API_BASE_URL=https://api.example.com pnpm --filter @lunara/client build
```

Upload `apps/client/dist` to any static host (Cloudflare Pages, Netlify,
Vercel static). Configure SPA fallback to `index.html`. The build includes a
service worker that caches the app shell and fonts; API calls are never
cached. If the client and API share an origin behind one reverse proxy,
leave `VITE_API_BASE_URL` empty.

## 4. Mobile

See `docs/MOBILE.md`. Set `VITE_API_BASE_URL` to the API origin before
`cap sync`, and include `capacitor://localhost,https://localhost` in
`CLIENT_ORIGINS`.

## 5. First admin

Sign up with an address listed in `ADMIN_EMAILS`; the profile is flagged on
first load. `/app/admin` shows aggregate usage, routing and content
validation.

## 6. Verify after deploy

- `GET /health` is 200 and reports the intended provider (not `mock`).
- Sign up, start "The Locked Archive", send a message, request a hint.
- `/app/admin` shows the sign-up in user counts and the calls in usage.
- Export from Settings downloads JSON.

## Current production setup (Vercel, 2026-09-26)

Both apps deploy from `main` of the GitHub repo as two Vercel projects in the
`vyaesops-projects` team. Every push to `main` redeploys both.

| Project | Root directory | Build | URL |
|---|---|---|---|
| `strat-api` | `apps/api` | `pnpm run build:vercel` (framework: Other) | https://strat-api.vercel.app |
| `lunara-strategy-lab` | `apps/client` | Vite preset (`pnpm build`, output `dist`) | https://lunara-strategy-lab.vercel.app |

- **API build** (`apps/api/scripts/build-vercel.mjs`): on production builds it
  applies migrations to `DATABASE_URL`, then bundles `src/vercel.ts` with
  esbuild into a single Node function using Vercel's Build Output API. Every
  path routes to that function. The function opens the Postgres pool once per
  warm instance and never migrates at request time.
- **API environment** (production and preview): `DATABASE_URL` and
  `BETTER_AUTH_SECRET` (sensitive), `BETTER_AUTH_URL`, `CLIENT_ORIGINS`, and
  the AI and limit variables from `apps/api/.env.example`. Do not set
  `NODE_ENV` as a project variable; Vercel sets it at runtime, and setting it
  at build time can make the install skip dev dependencies the build needs.
- **Client environment**: `VITE_API_BASE_URL=https://strat-api.vercel.app`.
  It is baked in at build time, so changing it needs a redeploy.
  `apps/client/vercel.json` rewrites unknown paths to `index.html` so deep
  links survive a refresh.
- **Auth across domains**: the client and API are on different domains, so
  the web app uses the bearer token from `set-auth-token` (stored locally),
  exactly as the Android app does. `CLIENT_ORIGINS` must list every client
  origin; preview deployments of the client get their own URLs and are not
  listed, so only the production client can sign in.
- **AI keys**: add them to `strat-api` (Settings, Environment Variables), then
  redeploy. See `docs/AI_PROVIDERS.md`.
