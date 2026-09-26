# Data model (Postgres / Drizzle)

_Last updated: 2026-09-25._ Source of truth: `apps/api/src/db/schema.ts` and
the Zod models in `packages/schemas/src`. Migrations: `apps/api/drizzle`.

## Conventions

- Ids are text, prefixed (`ses_`, `msg_`, `usg_`, `goal_`, `hyp_`); Better Auth
  generates its own user/session ids.
- Timestamps are `timestamptz`; the API converts to ISO-8601 strings at the
  boundary so clients never see driver-specific types.
- Structured sub-documents that are read and written whole (preferences,
  goals, stats, hypotheses, decision, assessment, recent evidence) are `jsonb`
  and are validated with Zod on every read and write. Anything that is
  queried, filtered or indexed is a real column.
- Ownership is a `user_id` column on every per-user table, always combined
  with the caller's id in the query (`getOwnedSession`), never trusted from
  the request body.

## Tables

### Better Auth: `user`, `session`, `account`, `verification`

Standard Better Auth layout (snake_case columns, camelCase Drizzle keys).
`account.password` stores the hash for email/password accounts. Deleting a
`user` row cascades to everything below.

### `profiles` (1:1 with `user`)

| column | type | notes |
|---|---|---|
| `user_id` | text PK, FK user | |
| `schema_version` | int | currently 1 |
| `onboarding_completed`, `onboarding_completed_at`, `onboarding_answers` | bool, timestamptz, jsonb | `OnboardingAnswers` |
| `preferences` | jsonb | `UserPreferences` (coaching intensity, session length, theme, notifications, focus modes) |
| `goals` | jsonb | `LearningGoal[]`, max 10 |
| `stats` | jsonb | `UserStats` (sessions started/completed, streak) |
| `is_admin` | bool | Admin routes (later phase) check this server-side |

### `coaching_sessions`

| column | type | notes |
|---|---|---|
| `id` | text PK | |
| `user_id` | text FK | index `(user_id, status, last_activity_at)` for the resume list |
| `exercise_id`, `exercise_version` | text, int | pins the content version |
| `mode`, `status`, `phase` | text | enums from `@lunara/schemas` |
| `hint_level` | int 0–5 | monotonic |
| `revealed` | bool | |
| `hypotheses` | jsonb | `UserHypothesis[]`, max 20 |
| `decision` | jsonb | `SessionDecision \| null` |
| `assessment` | jsonb | `SessionAssessment \| null` (written in Phase 2) |
| `message_count` | int | denormalised |
| `started_at`, `last_activity_at`, `completed_at` | timestamptz | |

### `session_messages` (append-only)

`id`, `session_id` (FK cascade, index with `created_at`), `user_id`, `role`
(`user` / `coach` / `system`), `kind` (`turn` / `hint` / `reveal` / `debrief` /
`phase_change`), `content`, `phase`, `model` (provider:model id only, never
prompt text), `created_at`.

### `skill_assessments` (PK `user_id`, `skill_id`)

`estimate`, `unaided_estimate` (nullable), `confidence`, `evidence_count`,
`last_evidence_at`, `recent_evidence` jsonb (≤ 10 refs). Update rule and
constants: `packages/core/src/skills/update.ts`.

### `ai_usage`

One row per provider attempt: `user_id` (nullable, `set null` on user delete),
`task`, `provider`, `model`, `input_tokens`, `output_tokens`, `latency_ms`,
`estimated_cost_usd`, `ok`, `error_code`, `created_at`. Index
`(user_id, created_at)` serves the daily/monthly budget queries. No prompt or
response text is stored.

### `rate_limits`

`key` (`u:<userId>` or `ip:<addr>`), `window_start`, `count`. Fixed one-minute
window updated with a single upsert.

## Lifecycle

- **Account deletion** (`DELETE /api/v1/me`): deletes the `user` row; cascades
  remove profile, sessions, messages, skills and auth sessions. `ai_usage`
  rows lose their user reference and remain for cost accounting.
- **Content versioning**: sessions pin `exercise_version`; a future content
  edit bumps the version and in-progress sessions keep the old text.
- **Retention**: no automatic purge yet; documented target is 90 days for
  `ai_usage` (Phase 7).
