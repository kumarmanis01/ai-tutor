## Dev DB reset + seed

For local development you can fully reset the Postgres schema and re-seed
all AI-tutor–related data with a single script:

```bash
node scripts/reset-and-seed-dev-db.cjs
```

**What this script does:**

- Drops and recreates the dev database schema:
  - `npx prisma migrate reset --force`
- Applies all Prisma migrations:
  - `npx prisma migrate dev`
- Regenerates the Prisma client:
  - `npx prisma generate`
- Runs seed scripts in order:
  - `npx tsx scripts/seed-taxonomy-launch-slice.ts`
  - `npx tsx scripts/seed-ai-data.cjs`
  - `npx tsx scripts/seed-misconceptions.ts`

**Safety notes:**

- Intended **only** for local development.
- This will **irreversibly delete all data** in the configured database.
- Do **not** run this against a production database.

To add new child seed scripts over time, append them to the `SEED_COMMANDS`
array in `scripts/reset-and-seed-dev-db.cjs` so they are included in the
standard dev reset workflow.
