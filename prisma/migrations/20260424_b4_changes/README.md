Migration placeholder: 2026-04-24 B4 changes

This folder contains a placeholder migration created by the dev agent.

Do not apply this placeholder to production. Instead, on a developer machine with a
valid `DATABASE_URL` and the Prisma CLI installed run:

  npx prisma migrate dev --name b4_changes --create-only

Review the SQL produced under `prisma/migrations/<timestamp>_b4_changes/migration.sql` and
then apply with `npx prisma migrate dev` (or `npx prisma migrate deploy` in CI).

If you want me to attempt to run `prisma migrate` here, provide DB access or confirm
that you want to generate the migration against a local sqlite fallback.
