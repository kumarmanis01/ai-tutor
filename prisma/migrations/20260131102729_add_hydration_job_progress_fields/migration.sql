-- AlterTable
ALTER TABLE "HydrationJob" ADD COLUMN     "actualCostUsd" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "chaptersCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chaptersExpected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedCostUsd" DOUBLE PRECISION,
ADD COLUMN     "estimatedDurationMins" INTEGER,
ADD COLUMN     "hierarchyLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inputParams" JSONB,
ADD COLUMN     "notesCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notesExpected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "questionsCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "questionsExpected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topicsCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topicsExpected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "traceId" TEXT,
ALTER COLUMN "rootJobId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "HydrationJob_hierarchyLevel_idx" ON "HydrationJob"("hierarchyLevel");
