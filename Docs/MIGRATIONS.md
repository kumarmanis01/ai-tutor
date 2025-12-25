# Migrations: Dev / Staging / Production

This document describes the recommended Prisma migration workflow for local
development, staging, and production environments. Follow these rules to
prevent drift and to keep migrations safe and auditable.

Key principles
- Local development: use `npx prisma migrate dev` with a dedicated `SHADOW_DATABASE_URL`.
- CI / Staging / Production: use `npx prisma migrate deploy` (no shadow DB).
- Never run `migrate dev` directly against staging/production.
- Keep migration SQL files in Git and review them in PRs.

Environments
- `.env.local` (developer): `DATABASE_URL` for local dev + `SHADOW_DATABASE_URL` pointing to an empty Postgres instance.
- `.env.migrate` (optional runner): a single-purpose file with `DATABASE_URL` pointing to the target staging DB for migration testing.
- `.env.production`: `DATABASE_URL` for production DB (used by CI deploy job).

Local developer workflow
1. Ensure `SHADOW_DATABASE_URL` points to a clean Postgres instance.
2. Create and apply a migration locally:

```bash
# creates a migration and applies it using the shadow DB
npx prisma migrate dev --name feature/your-change
npx prisma generate
```

3. If you only want the SQL without applying locally:

```bash
npx prisma migrate dev --create-only --name feature/your-change
```

4. Commit the generated migration folder under `prisma/migrations`.

Staging workflow (validation)
1. Open a PR and merge the migrations into the main branch.
2. The staging CI job should run:

```bash
npx prisma migrate deploy
npx prisma generate
npm run test:integration
```

3. If anything fails, fix in a new migration and re-run on staging.

Production workflow (safe apply)
1. Take a DB backup or snapshot.
2. Run migrations from CI with `DATABASE_URL` set to production:

```bash
npx prisma migrate deploy
npx prisma generate
```

Handling failed migrations
- Inspect `_prisma_migrations` to find failing entries.
- If necessary, apply the SQL manually and then mark the migration as applied:

```bash
npx prisma db execute --file prisma/migrations/<migration>/migration.sql --url env:DATABASE_URL
npx prisma migrate resolve --applied <migration>
npx prisma migrate deploy
```

Notes
- Use per-developer or per-PR shadow DBs to avoid P3006 errors.
- Prefer small, tested migrations that are easy to review and rollback conceptually.
