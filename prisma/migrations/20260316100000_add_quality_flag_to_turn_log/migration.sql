-- This migration is not transactional (CREATE TYPE cannot run inside a transaction)

-- CreateEnum
CREATE TYPE "QualityFlag" AS ENUM ('HALLUCINATION', 'INCORRECT_EXPLANATION', 'POOR_PEDAGOGY', 'OFF_TOPIC', 'DIRECT_ANSWER_GIVEN', 'SAFETY_CONCERN');

-- AlterTable: add qualityFlag and qualityNote to AITutorTurnLog
ALTER TABLE "AITutorTurnLog" ADD COLUMN "qualityFlag" "QualityFlag";
ALTER TABLE "AITutorTurnLog" ADD COLUMN "qualityNote" TEXT;

-- CreateIndex
CREATE INDEX "AITutorTurnLog_qualityFlag_idx" ON "AITutorTurnLog"("qualityFlag");
