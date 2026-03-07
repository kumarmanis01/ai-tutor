-- Migration: add_overview_phase
-- Adds OVERVIEW as the first phase in the SessionPhase state machine so that
-- every new StructuredSession starts with a topic-overview gate before
-- advancing to EXPLANATION. Also adds SESSION_OVERVIEW_VIEWED event type.
--
-- Safe to apply on a live database:
--   - ALTER TYPE … ADD VALUE is non-destructive.
--   - Existing sessions in EXPLANATION/PRACTICE/TEST/HOMEWORK/COMPLETE are unaffected.
--   - The column default change only affects INSERT statements after this migration.

-- 1. Extend the SessionPhase enum with OVERVIEW (placed before EXPLANATION)
ALTER TYPE "SessionPhase" ADD VALUE IF NOT EXISTS 'OVERVIEW' BEFORE 'EXPLANATION';

-- 2. Extend SessionEventType with the new overview-viewed event
ALTER TYPE "SessionEventType" ADD VALUE IF NOT EXISTS 'SESSION_OVERVIEW_VIEWED';

-- 3. Column default for new sessions is set in the next migration (20260307000001)
--    because PostgreSQL does not allow using a newly added enum value in the same transaction.
