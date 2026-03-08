-- Set default state for new StructuredSession rows to OVERVIEW.
-- Must be in a separate migration because PostgreSQL does not allow using
-- a newly added enum value in the same transaction as ADD VALUE.
ALTER TABLE "StructuredSession" ALTER COLUMN "state" SET DEFAULT 'OVERVIEW';
