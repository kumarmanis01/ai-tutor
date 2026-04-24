-- Migration intentionally fails fast because the previously committed content was a
-- no-op placeholder. A no-op migration is unsafe because `prisma migrate deploy`
-- can record it as applied without applying the required schema changes, causing
-- schema drift and runtime failures.
--
-- Replace this file with the real Prisma-generated SQL for the intended schema
-- changes before deploying:
--   npx prisma migrate dev --name b4_changes --create-only
--
-- After generating the authoritative SQL, commit the generated statements in place
-- of this guard block.
DO $$
BEGIN
  RAISE EXCEPTION
    USING
      MESSAGE = 'Blocked placeholder Prisma migration 20260424_b4_changes: replace this file with the real Prisma-generated migration SQL before running prisma migrate deploy.',
      ERRCODE = 'P0001';
END
$$;
