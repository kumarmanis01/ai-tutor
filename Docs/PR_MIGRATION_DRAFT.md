PR: Add generated initial Prisma migration

Branch: prisma/add-initial-migration

Summary:
- Adds generated create-only SQL migration at `prisma/migrations/20251219_init/migration.sql`.
- This migration was produced with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.

Why:
- CI previously used `prisma db push` as a pragmatic fix because the migrations folder lacked a proper initial migration.
- Committing this migration allows running `prisma migrate deploy` in CI and removing `prisma db push`.

Files changed:
- prisma/migrations/20251219_init/migration.sql (new)

Testing steps (locally):
1. Ensure a clean DB or use a disposable DB.
2. Run `npx prisma migrate deploy` against the DB and confirm tables created.
3. Run the integration tests: `npm run test:integration` (or the appropriate script).

PR body suggestion (paste into GitHub when creating PR):
Title: feat(prisma): add generated initial migration (create-only)

Body:
This PR adds a generated, create-only SQL migration derived from the current `prisma/schema.prisma`.

Rationale:
- CI relied on `prisma db push` because there was no committed initial migration, causing drift and P2021 errors.
- Adding this migration allows the CI to rely on `prisma migrate deploy` and keeps schema history consistent.

Notes for reviewer:
- The migration is create-only and was generated as a schema diff from an empty DB; please review for any expected manual adjustments.
- After merge, we should remove the `prisma db push` fallback from the CI workflow and rely on `prisma migrate deploy` only.

Commands to open PR with `gh` CLI (if preferred):

```bash
# from repository root
git checkout prisma/add-initial-migration
git pull origin prisma/add-initial-migration
# create a PR (change flags as needed)
gh pr create --fill --base master --title "feat(prisma): add generated initial migration (create-only)"
```

Follow-up action (after PR merge):
- Update `.github/workflows/ci-alert-evaluator.yml`: remove `npx prisma db push` from the CI step and ensure `npx prisma migrate deploy` runs successfully in CI.

If you want, I can open the PR draft for you, but I need a GitHub token or GH CLI available in this environment to create the PR automatically.
