
/*
FILE OBJECTIVE:
 - Add `inactivityOptOut` boolean column to `ParentStudent` table (dev migration)

LINKED UNIT TEST:
 - tests/unit/prisma/migrations/20260420000000_add_inactivity_opt_out_to_parent_student.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
 - .github/copilot-instructions.md
 - /docs/ENGINEERING_PRACTICES.md

EDIT LOG:
 - 2026-04-20T16:30:00Z | copilot | added header and idempotent migration (dev)
*/

ALTER TABLE "ParentStudent"
ADD COLUMN IF NOT EXISTS "inactivityOptOut" boolean NOT NULL DEFAULT false;
