-- FILE OBJECTIVE:
-- - One-shot production recovery script for two migrations that can be stuck
--   in P3009 failed state when the database was first deployed with the old
--   (broken) SQL before April 20, 2026.
--
-- AFFECTED MIGRATIONS:
--   20260416000000_add_student_concept_state
--     Original error: constraint "StudentConceptState_conceptId_fkey" already
--     exists (error 42710).  Caused duplicate _prisma_migrations rows.
--
--   20260417_add_referral_reward
--     Original error: syntax error at or near "NOT"  (error 42601).
--     ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS is not valid Postgres SQL.
--     ReferralReward table was NEVER created.
--
-- LINKED UNIT TEST:
-- - tests/unit/scripts/fix_prod_migrations.spec.ts
--
-- COPILOT INSTRUCTIONS FOLLOWED:
-- - .github/copilot-instructions.md
-- - /docs/ENGINEERING_PRACTICES.md
--
-- EDIT LOG:
-- - 2026-04-20T00:00:00Z | copilot | created
--
-- PREREQUISITES:
--   1. Confirm both objects exist or that the script will create them safely:
--      SELECT table_name FROM information_schema.tables
--        WHERE table_schema = 'public'
--        AND table_name IN ('Referral','User','StudentConceptState','Concept');
--   2. Run with a user that has DDL rights on the database.
--   3. Run ONCE per affected environment (dev, staging, production).
--   4. After this script: run `npx prisma migrate deploy` and confirm output is
--      "All migrations have been successfully applied."
--
-- SAFETY:
--   All DDL uses IF NOT EXISTS or DO $$ guards.
--   The _prisma_migrations cleanup uses DELETE + re-INSERT, not UPDATE, so the
--   script is safe even if a previous partial run occurred.
--
-- RUN:
--   psql "$DATABASE_URL" -f scripts/fix_prod_migrations.sql
--   # or via docker:
--   Get-Content scripts/fix_prod_migrations.sql | docker compose exec -T postgres psql -U postgres -d <dbname>

BEGIN;

-- ============================================================
-- STEP 1: Create the ReferralReward table if it does not exist.
--         (It was never created because the original migration SQL
--          had a syntax error on the ALTER TABLE line.)
-- ============================================================

CREATE TABLE IF NOT EXISTS "ReferralReward" (
  "id"         text        PRIMARY KEY NOT NULL,
  "referralId" text,
  "userId"     text        NOT NULL,
  "amount"     integer     NOT NULL,
  "status"     text        NOT NULL DEFAULT 'PENDING',
  "appliedAt"  timestamptz,
  "metadata"   jsonb,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referralreward_referral'
  ) THEN
    ALTER TABLE "ReferralReward"
      ADD CONSTRAINT fk_referralreward_referral
      FOREIGN KEY ("referralId") REFERENCES "Referral" (id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referralreward_user'
  ) THEN
    ALTER TABLE "ReferralReward"
      ADD CONSTRAINT fk_referralreward_user
      FOREIGN KEY ("userId") REFERENCES "User" (id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_referralreward_userid'
  ) THEN
    CREATE INDEX idx_referralreward_userid ON "ReferralReward" ("userId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_referralreward_status'
  ) THEN
    CREATE INDEX idx_referralreward_status ON "ReferralReward" ("status");
  END IF;
END
$$;

-- ============================================================
-- STEP 2: Ensure StudentConceptState FKs exist (idempotent).
--         The table was created, but the constraints may have
--         been left off if the original migration partially ran.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'StudentConceptState_studentId_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE "StudentConceptState"
                   ADD CONSTRAINT "StudentConceptState_studentId_fkey"
                   FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'StudentConceptState_conceptId_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE "StudentConceptState"
                   ADD CONSTRAINT "StudentConceptState_conceptId_fkey"
                   FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE';
    END IF;
END;
$$;

-- ============================================================
-- STEP 3: Clean up all bad _prisma_migrations rows for these
--         two migrations (there may be 1-3 rows each, all with
--         applied_steps_count = 0 or finished_at IS NULL).
-- ============================================================
-- IMPORTANT: prefer using Prisma's CLI to mark migrations as applied.
-- Recommended safe recovery flow (preferred):
-- 1) Ensure the DB schema is correct (tables/constraints exist as expected).
-- 2) From a machine with access to the codebase, run:
--      npx prisma migrate resolve --applied 20260416000000_add_student_concept_state
--      npx prisma migrate resolve --applied 20260417_add_referral_reward
--    This marks the migrations as applied in Prisma's migration table without
--    fabricating checksums.

-- If you cannot use `prisma migrate resolve` in your environment (rare), you
-- can manually clean up `_prisma_migrations`. This is a destructive and
-- sensitive operation. The commented SQL below shows the manual steps; only
-- run them after taking a verified DB backup and with operator approval.

-- NOTE: gen_random_uuid() requires the pgcrypto extension. Create it if missing:
-- (uncomment if you will run the manual insert below)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

/*
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '20260416000000_add_student_concept_state',
  '20260417_add_referral_reward'
);

INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (
    gen_random_uuid()::text,
    'manually-applied-20260420',
    now(),
    '20260416000000_add_student_concept_state',
    NULL,
    NULL,
    now() - INTERVAL '10 seconds',
    1
  ),
  (
    gen_random_uuid()::text,
    'manually-applied-20260420',
    now(),
    '20260417_add_referral_reward',
    NULL,
    NULL,
    now() - INTERVAL '5 seconds',
    1
  );
*/

-- ============================================================
-- STEP 5: Verify
-- ============================================================

SELECT
  migration_name,
  applied_steps_count,
  finished_at IS NOT NULL AS done,
  logs IS NULL             AS no_error
FROM _prisma_migrations
WHERE migration_name IN (
  '20260416000000_add_student_concept_state',
  '20260417_add_referral_reward'
)
ORDER BY migration_name;

-- Expected output:
--                migration_name                | applied_steps_count | done | no_error
-- -------------------------------------------+---------------------+------+----------
--  20260416000000_add_student_concept_state   |                   1 | t    | t
--  20260417_add_referral_reward               |                   1 | t    | t
--
-- If the output matches, commit the transaction and then run:
--   npx prisma migrate deploy --schema=prisma/schema.prisma
-- If anything looks wrong, ROLLBACK and investigate before retrying.

COMMIT;
