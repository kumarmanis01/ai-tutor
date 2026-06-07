-- Migration: drop duplicate / unused indexes
-- ---------------------------------------------------------------------------
-- pg_stat_user_indexes on 2026-06-07 showed these indexes had idx_scan = 0
-- and are duplicates of auto-generated unique-constraint indexes. Dropping
-- saves write throughput on the hot User upsert path (signup, JWT cache
-- write-through, etc).
--
-- These are also untracked by Prisma -- they were added manually (no
-- corresponding @@index entry in schema.prisma). Removing them brings the DB
-- back in sync with the declared schema.
--
-- IF EXISTS so the migration is safe to re-run / safe on environments where
-- the manual indexes were never applied.
-- ---------------------------------------------------------------------------

-- The User.email column already has User_email_key (auto from @unique).
-- idx_user_email is a redundant non-unique btree on the same column.
DROP INDEX IF EXISTS "idx_user_email";

-- Similarly redundant for the parentEmail column. parentEmail is not declared
-- @unique in the schema but signup / parent OTP flow uses User_email_key
-- exclusively for lookup; the parentEmail index sees no scans.
DROP INDEX IF EXISTS "idx_user_parent_email";
