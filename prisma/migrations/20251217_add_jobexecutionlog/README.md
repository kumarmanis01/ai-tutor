Migration 20251217_add_jobexecutionlog

This migration adds the `job_execution_log` table used for append-only job lifecycle events.

To apply locally run:

```bash
# ensure DATABASE_URL is set
psql "$DATABASE_URL" -f prisma/migrations/20251217_add_jobexecutionlog/migration.sql
```

Or let `prisma migrate deploy` run migrations in CI/prod.
