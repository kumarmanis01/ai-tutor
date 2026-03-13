-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "irt_b" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "irt_b" DOUBLE PRECISION,
    "bloomLevel" TEXT,
    "prerequisiteConceptIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commonlyConfusedWithIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardChapterWeight" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "weightMarks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardChapterWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardSubjectConfig" (
    "id" TEXT NOT NULL,
    "subjectDefId" TEXT NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardSubjectConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumChunk" (
    "id" TEXT NOT NULL,
    "conceptIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT,
    "board" TEXT,
    "subject" TEXT,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Concept_subjectId_idx" ON "Concept"("subjectId");

-- CreateIndex
CREATE INDEX "Concept_topicId_idx" ON "Concept"("topicId");

-- CreateIndex
CREATE INDEX "BoardChapterWeight_chapterId_idx" ON "BoardChapterWeight"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardChapterWeight_chapterId_key" ON "BoardChapterWeight"("chapterId");

-- CreateIndex
CREATE INDEX "BoardSubjectConfig_subjectDefId_idx" ON "BoardSubjectConfig"("subjectDefId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardSubjectConfig_subjectDefId_key" ON "BoardSubjectConfig"("subjectDefId");

-- CreateIndex
CREATE INDEX "CurriculumChunk_conceptIds_idx" ON "CurriculumChunk"("conceptIds");

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "SubjectDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardChapterWeight" ADD CONSTRAINT "BoardChapterWeight_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "ChapterDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardSubjectConfig" ADD CONSTRAINT "BoardSubjectConfig_subjectDefId_fkey" FOREIGN KEY ("subjectDefId") REFERENCES "SubjectDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
