# Release checklist

## Before

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green
- [ ] `pnpm audit` reviewed
- [ ] Neon branch `pre-<version>` created
- [ ] `docs/AI_PROVIDERS.md` verification date is recent; provider keys set;
      `AI_ALLOW_USER_CONTENT` lists only providers whose terms permit private
      content
- [ ] `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_ORIGINS`, `DATABASE_URL`
      set on the API host; `NODE_ENV=production`
- [ ] `VITE_API_BASE_URL` set for the client build (and for `cap sync`)

## Deploy

- [ ] API deployed; `GET /health` reports the intended provider, not `mock`
- [ ] Client deployed with SPA fallback; service worker updates on reload
- [ ] Mobile: `pnpm --filter @lunara/client cap:sync`, build, install on a
      device, sign in, complete one exercise

## After

- [ ] Sign up a fresh account; onboarding; start and complete "The Locked
      Archive"; assessment and skill evidence appear
- [ ] Inference Lab case, a scenario tree critique, a simulation turn, a
      council with two roles, a document ask, a review grade, a briefing
- [ ] `/app/admin` shows counts and non-mock usage; no provider errors
- [ ] Export downloads; account deletion on a test account removes everything
- [ ] Update `docs/PROJECT_STATUS.md` with the version and date
