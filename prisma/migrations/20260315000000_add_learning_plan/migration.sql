-- Migration: add_learning_plan
-- Replaces the old single-plan-per-student LearningPlan with a
-- per-student-per-subject plan model, adds week-based LearningPlanItem
-- with PlanItemStatus enum, and wires Concept → LearningPlanItem relation.

-- Step 1: drop old indexes and constraints before altering tables
DROP INDEX IF EXISTS "LearningPlan_studentId_idx";
DROP INDEX IF EXISTS "LearningPlanItem_planId_orderIndex_idx";
DROP INDEX IF EXISTS "LearningPlanItem_planId_status_idx";

-- Step 2: drop old unique constraint on LearningPlan.studentId
ALTER TABLE "LearningPlan" DROP CONSTRAINT IF EXISTS "LearningPlan_studentId_key";

-- Step 3: alter LearningPlan — remove gradeId, add new columns
ALTER TABLE "LearningPlan"
  DROP COLUMN IF EXISTS "gradeId",
  ADD COLUMN IF NOT EXISTS "examDate"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "weeklyGoal"  INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Rename createdAt → generatedAt semantics are kept via generatedAt above;
-- createdAt column stays for backward compat with any existing rows.

-- Step 4: create PlanItemStatus enum
DO $$ BEGIN
  CREATE TYPE "PlanItemStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 5: alter LearningPlanItem — drop old columns, add new ones
ALTER TABLE "LearningPlanItem"
  DROP COLUMN IF EXISTS "orderIndex",
  DROP COLUMN IF EXISTS "unlockedAt",
  ADD COLUMN IF NOT EXISTS "weekNumber"  INTEGER,
  ADD COLUMN IF NOT EXISTS "orderInWeek" INTEGER,
  ADD COLUMN IF NOT EXISTS "deferredAt"  TIMESTAMP(3);

-- Backfill weekNumber and orderInWeek for any existing rows (set to 1)
UPDATE "LearningPlanItem" SET "weekNumber" = 1, "orderInWeek" = 0 WHERE "weekNumber" IS NULL;

-- Make non-nullable now that backfill is done
ALTER TABLE "LearningPlanItem"
  ALTER COLUMN "weekNumber"  SET NOT NULL,
  ALTER COLUMN "orderInWeek" SET NOT NULL;

-- Step 6: migrate status column from String to PlanItemStatus enum
ALTER TABLE "LearningPlanItem"
  ALTER COLUMN "status" DROP DEFAULT;

UPDATE "LearningPlanItem"
  SET "status" = 'UPCOMING'
  WHERE "status" NOT IN ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED');

UPDATE "LearningPlanItem" SET "status" = 'COMPLETED' WHERE "status" = 'complete';
UPDATE "LearningPlanItem" SET "status" = 'UPCOMING'  WHERE "status" = 'pending';

ALTER TABLE "LearningPlanItem"
  ALTER COLUMN "status" TYPE "PlanItemStatus" USING "status"::"PlanItemStatus",
  ALTER COLUMN "status" SET DEFAULT 'UPCOMING';

-- Step 7: add unique constraint to LearningPlan
ALTER TABLE "LearningPlan"
  ADD CONSTRAINT "LearningPlan_studentId_subjectId_key" UNIQUE ("studentId", "subjectId");

-- Step 8: recreate indexes
CREATE INDEX IF NOT EXISTS "LearningPlanItem_planId_weekNumber_status_idx"
  ON "LearningPlanItem"("planId", "weekNumber", "status");
