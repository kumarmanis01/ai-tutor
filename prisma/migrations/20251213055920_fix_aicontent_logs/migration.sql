/*
  Warnings:

  - You are about to alter the column `costCents` on the `AIContentLog` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Added the required column `promptType` to the `AIContentLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `model` on table `AIContentLog` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AIContentLog" ADD COLUMN     "board" TEXT,
ADD COLUMN     "chapter" TEXT,
ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "promptType" TEXT NOT NULL,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokensUsed" INTEGER,
ADD COLUMN     "topic" TEXT,
ALTER COLUMN "model" SET NOT NULL,
ALTER COLUMN "costCents" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ChapterDef" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TopicNote" ADD COLUMN     "editedByTeacher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teacherNotes" TEXT;

-- CreateIndex
CREATE INDEX "AIContentLog_promptType_idx" ON "AIContentLog"("promptType");

-- CreateIndex
CREATE INDEX "AIContentLog_board_grade_subject_idx" ON "AIContentLog"("board", "grade", "subject");

-- CreateIndex
CREATE INDEX "AIContentLog_createdAt_idx" ON "AIContentLog"("createdAt");
