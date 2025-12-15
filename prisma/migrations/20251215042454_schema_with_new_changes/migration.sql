/*
  Warnings:

  - The `language` column on the `AIContentLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `language` column on the `HydrationJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `difficulty` column on the `HydrationJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `HydrationJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `difficulty` column on the `StudentContentPreference` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `language` column on the `StudentContentPreference` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `difficulty` on the `GeneratedTest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `language` on the `GeneratedTest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `jobType` on the `HydrationJob` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `language` on the `TopicNote` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('en', 'hi');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'failed', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('syllabus', 'notes', 'questions', 'tests', 'assemble');

-- AlterTable
ALTER TABLE "AIContentLog" DROP COLUMN "language",
ADD COLUMN     "language" "LanguageCode";

-- AlterTable
ALTER TABLE "GeneratedTest" DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" "DifficultyLevel" NOT NULL,
DROP COLUMN "language",
ADD COLUMN     "language" "LanguageCode" NOT NULL;

-- AlterTable
ALTER TABLE "HydrationJob" DROP COLUMN "jobType",
ADD COLUMN     "jobType" "JobType" NOT NULL,
DROP COLUMN "language",
ADD COLUMN     "language" "LanguageCode",
DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" "DifficultyLevel",
DROP COLUMN "status",
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "StudentContentPreference" DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" "DifficultyLevel",
DROP COLUMN "language",
ADD COLUMN     "language" "LanguageCode";

-- AlterTable
ALTER TABLE "TopicNote" DROP COLUMN "language",
ADD COLUMN     "language" "LanguageCode" NOT NULL;

-- CreateIndex
CREATE INDEX "ApprovalAudit_entityType_entityId_idx" ON "ApprovalAudit"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalAudit_createdAt_idx" ON "ApprovalAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedTest_topicId_difficulty_language_version_key" ON "GeneratedTest"("topicId", "difficulty", "language", "version");

-- CreateIndex
CREATE INDEX "HydrationJob_jobType_status_idx" ON "HydrationJob"("jobType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TopicNote_topicId_language_version_key" ON "TopicNote"("topicId", "language", "version");
