# Backup and recovery

## What holds state

Only Postgres. The API is stateless; the client is static; PDFs are stored as
extracted text in the `reading_documents` table, not as files.

## Neon

- Neon retains point-in-time history for the project's configured window and
  supports branching from any point in that window. To recover from a bad
  migration or deletion: create a branch at the timestamp before the
  incident, verify it, then point `DATABASE_URL` at the branch (or restore
  the primary from it).
- Before every migration deployment, create a branch named
  `pre-<migration>` as a manual checkpoint.

## Logical backups

`pg_dump` works against Neon with the standard connection string:

```
pg_dump "$DATABASE_URL" --no-owner --format=custom --file=lunara-$(date +%F).dump
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" lunara-YYYY-MM-DD.dump
```

Schedule a weekly dump off-platform if the free tier's history window is
shorter than your recovery requirement.

## Per-user export

Users can download all their data from Settings (`GET /api/v1/me/export`).
Support can run the same endpoint on a user's behalf only with their session;
there is no admin impersonation by design.

## Migrations

Schema changes live in `apps/api/drizzle/*.sql` with `meta/` snapshots and are
applied on API start. Roll back by restoring a Neon branch; migrations are
forward-only.
