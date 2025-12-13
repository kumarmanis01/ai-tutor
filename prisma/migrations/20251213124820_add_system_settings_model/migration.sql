/*
  Warnings:

  - A unique constraint covering the columns `[subjectId,slug,version]` on the table `ChapterDef` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[boardId,grade]` on the table `ClassLevel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[classId,slug]` on the table `SubjectDef` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chapterId,slug]` on the table `TopicDef` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[topicId,language,version]` on the table `TopicNote` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'national';

-- AlterTable
ALTER TABLE "ChapterDef" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "TopicDef" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "TopicNote" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterDef_subjectId_slug_version_key" ON "ChapterDef"("subjectId", "slug", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLevel_boardId_grade_key" ON "ClassLevel"("boardId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectDef_classId_slug_key" ON "SubjectDef"("classId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TopicDef_chapterId_slug_key" ON "TopicDef"("chapterId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TopicNote_topicId_language_version_key" ON "TopicNote"("topicId", "language", "version");
