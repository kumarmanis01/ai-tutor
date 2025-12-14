/*
  Warnings:

  - You are about to drop the column `costCents` on the `AIContentLog` table. All the data in the column will be lost.
  - You are about to drop the column `success` on the `AIContentLog` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `ChapterDef` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `ChapterDef` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ChapterDef` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `ClassLevel` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TopicDef` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `TopicNote` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `TopicNote` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[topicId,difficulty,language,version]` on the table `GeneratedTest` will be added. If there are existing duplicate values, this will fail.
  - Made the column `status` on table `AIContentLog` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `value` on the `SystemSetting` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "TopicDef" DROP CONSTRAINT "TopicDef_parentId_fkey";

-- DropIndex
DROP INDEX "TopicDef_isActive_idx";

-- DropIndex
DROP INDEX "TopicDef_parentId_idx";

-- DropIndex
DROP INDEX "TopicDef_status_idx";

-- AlterTable
ALTER TABLE "AIContentLog" DROP COLUMN "costCents",
DROP COLUMN "success",
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'success';

-- AlterTable
ALTER TABLE "Board" DROP COLUMN "active",
DROP COLUMN "state",
DROP COLUMN "type",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ChapterDef" DROP COLUMN "isActive",
DROP COLUMN "parentId",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "ClassLevel" DROP COLUMN "name",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "GeneratedQuestion" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "GeneratedTest" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SubjectDef" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "value",
ADD COLUMN     "value" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "TopicDef" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "TopicNote" DROP COLUMN "isActive",
DROP COLUMN "parentId",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "HydrationJob" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "board" TEXT,
    "grade" INTEGER,
    "subject" TEXT,
    "chapterId" TEXT,
    "topicId" TEXT,
    "language" TEXT,
    "difficulty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HydrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentContentPreference" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT,
    "difficulty" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentContentPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HydrationJob_jobType_status_idx" ON "HydrationJob"("jobType", "status");

-- CreateIndex
CREATE INDEX "StudentContentPreference_studentId_idx" ON "StudentContentPreference"("studentId");

-- CreateIndex
CREATE INDEX "AIContentLog_board_grade_subject_idx" ON "AIContentLog"("board", "grade", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedTest_topicId_difficulty_language_version_key" ON "GeneratedTest"("topicId", "difficulty", "language", "version");
