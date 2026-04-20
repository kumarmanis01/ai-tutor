-- FILE OBJECTIVE:
-- - Create the ReferralReward table to store pending/applied referral credits.
--   All DDL is fully idempotent (IF NOT EXISTS + DO $$ guards) so this
--   migration is safe to re-run and safe to apply against a DB that already
--   has objects from a previous partial run.
--
-- LINKED UNIT TEST:
-- - tests/unit/prisma/migrations/20260417_add_referral_reward.spec.ts
--
-- EDIT LOG:
-- - 2026-04-17T08:00:00Z | dev     | initial version — FKs used invalid syntax:
--                                    ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS
--                                    That is not valid Postgres SQL and caused P3009.
-- - 2026-04-20T00:00:00Z | copilot | rewrote FKs with DO $$ guards; table DDL
--                                    already used CREATE TABLE IF NOT EXISTS.
--
-- NOTE FOR PRODUCTION:
-- If prisma migrate deploy reports P3009 for this migration, the DB recorded a
-- failed run from the original (broken) SQL.  Run scripts/fix_prod_migrations.sql
-- against the production DB to recover before deploying.

-- 1. Table (idempotent)
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

-- 2. Foreign keys (guarded — ADD CONSTRAINT IF NOT EXISTS is NOT valid Postgres
--    syntax; the only safe idiom is a DO block with a pg_constraint existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referralreward_referral'
  ) THEN
    ALTER TABLE "ReferralReward" ADD CONSTRAINT fk_referralreward_referral FOREIGN KEY ("referralId") REFERENCES "Referral" (id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referralreward_user'
  ) THEN
    ALTER TABLE "ReferralReward" ADD CONSTRAINT fk_referralreward_user FOREIGN KEY ("userId") REFERENCES "User" (id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Indexes (guarded)
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
