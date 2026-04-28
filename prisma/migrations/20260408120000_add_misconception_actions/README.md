Migration: add enum values MISCONCEPTION_CREATE and MISCONCEPTION_UPDATE to AdminActionType

This migration contains a single non-transactional SQL step `migration.sql` which
adds two enum values to the existing PostgreSQL enum type `AdminActionType`.

Run with:

npx prisma migrate deploy

If your environment disallows non-transactional migrations, apply `migration.sql`
manually against the database before deploying application code that inserts
the new enum values into `audit_log.action`.
