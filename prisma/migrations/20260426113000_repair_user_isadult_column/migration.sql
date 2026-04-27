-- FILE OBJECTIVE:
-- - Repair schema drift by ensuring User.isAdult exists even when earlier migrations were marked applied.
--
-- LINKED UNIT TEST:
-- - tests/unit/prisma/schema.spec.ts
--
-- COPILOT INSTRUCTIONS FOLLOWED:
-- - /docs/COPILOT_GUARDRAILS.md
-- - .github/copilot-instructions.md
--
-- EDIT LOG:
-- - 2026-04-26T11:30:00Z | copilot | add idempotent repair migration for missing User.isAdult column

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isAdult" BOOLEAN NOT NULL DEFAULT false;
