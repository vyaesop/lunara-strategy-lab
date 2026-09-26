# Security notes

_Reviewed 2026-09-26 against the code as built._

## Authentication and sessions

- Better Auth handles email/password with hashed credentials and server
  sessions; web uses cookies, the Capacitor app uses bearer tokens stored in
  the native Preferences store.
- Every `/api/v1/*` route runs `requireUser`, which resolves the session from
  the request headers. There are no unauthenticated data routes except
  `/health` and the auth endpoints.
- Origins are allow-listed for CORS with credentials and mirrored into Better
  Auth `trustedOrigins`; sign-up from an unknown origin is rejected (observed
  in testing as `Invalid origin`).

## Authorization

- Ownership is enforced in queries: every per-user table has `user_id`, and
  loaders combine the record id with the caller's id. A foreign id returns
  404, never 403, so existence is not leaked. Tests cover sessions,
  investigations, trees, councils, documents, projects, decisions, review
  items, missions, negotiations, games and challenge attempts.
- Admin routes check a server-side `is_admin` flag; hiding the client route
  is a convenience only.
- Hidden material (solutions, rubrics, ground truth, hidden turns, personas,
  reservation values) is never included in list or detail responses; release
  goes through pure functions gated on persisted state. Tests assert absence
  of hidden fields in public payloads.

## AI boundary

- All provider calls go through `ModelRouter` with a per-user daily request
  budget and monthly cost budget checked before the call.
- Private user content (documents, projects, briefs, mission steps,
  negotiation text) is sent only to providers listed in
  `AI_ALLOW_USER_CONTENT`; the router refuses otherwise. Only a bounded
  passage (≤ 6,000 characters) of a document is ever sent.
- Prompts treat user text as data, and the system never lets the model decide
  authorization, acceptance, evidence release or scores: those are computed
  server-side from structured output validated with Zod.
- Usage records store tokens, latency, provider, model and error codes only.

## Transport and input

- `secureHeaders` middleware sets standard hardening headers.
- Request bodies are limited to 3 MB (20 MB for PDF upload); oversized
  bodies return 413.
- All request bodies are validated with Zod; validation failures return 400
  with field paths and no stack traces.
- Rate limiting is a per-user (or per-IP) fixed window stored in Postgres.

## Secrets

- No secrets in the repo; `.env*` is ignored and `.env.example` documents
  every variable. Provider keys travel in headers, never URLs.
- Production refuses to start without `BETTER_AUTH_SECRET` and
  `DATABASE_URL`.

## Data lifecycle

- Users can export all owned data (`GET /api/v1/me/export`) and delete their
  account (`DELETE /api/v1/me`), which cascades through every owned table.
- Real user data is never used as fixtures; tests create synthetic accounts
  on an in-memory database.

## Known gaps

- No email verification or password reset (needs an email provider).
- No CSRF token beyond origin checks; cookies are set by Better Auth with
  its defaults. Review cookie `SameSite` settings if the client and API end
  up on different sites.
- No automated dependency audit in CI yet; run `pnpm audit` before releases.
- Error monitoring is log-based; attach a hosted monitor to the JSON error
  lines and the client `ErrorBoundary` if needed.
