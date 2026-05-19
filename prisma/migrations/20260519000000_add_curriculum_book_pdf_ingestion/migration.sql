-- Migration: add_curriculum_book_pdf_ingestion
-- Adds CurriculumBook, BookChapter, BookTopic models and links ChapterDef/TopicDef back to PDF source.

-- 0. Enum type for PDF parse lifecycle
CREATE TYPE "CurriculumBookParseStatus" AS ENUM ('pending', 'parsing', 'parsed', 'failed');

-- 1. CurriculumBook: one PDF per subject per language
CREATE TABLE "CurriculumBook" (
    "id" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subjectId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "edition" TEXT,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "parseStatus" "CurriculumBookParseStatus" NOT NULL DEFAULT 'pending',
    "parseError" TEXT,
    "parsedAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumBook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurriculumBook_subjectId_language_key" ON "CurriculumBook"("subjectId", "language");
CREATE INDEX "CurriculumBook_parseStatus_idx" ON "CurriculumBook"("parseStatus");

-- 2. BookChapter: chapters extracted from a CurriculumBook
CREATE TABLE "BookChapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "startPage" INTEGER,
    "endPage" INTEGER,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookChapter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookChapter_bookId_chapterNumber_key" ON "BookChapter"("bookId", "chapterNumber");
CREATE INDEX "BookChapter_bookId_idx" ON "BookChapter"("bookId");

-- 3. BookTopic: sections within a BookChapter
CREATE TABLE "BookTopic" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "topicOrder" INTEGER NOT NULL,
    "topicTitle" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "exerciseText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookTopic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookTopic_chapterId_topicOrder_key" ON "BookTopic"("chapterId", "topicOrder");
CREATE INDEX "BookTopic_chapterId_idx" ON "BookTopic"("chapterId");

-- 4. Link ChapterDef back to BookChapter (nullable)
ALTER TABLE "ChapterDef" ADD COLUMN "bookChapterId" TEXT;
CREATE UNIQUE INDEX "ChapterDef_bookChapterId_key" ON "ChapterDef"("bookChapterId");

-- 5. Link TopicDef back to BookTopic (nullable)
ALTER TABLE "TopicDef" ADD COLUMN "bookTopicId" TEXT;
CREATE UNIQUE INDEX "TopicDef_bookTopicId_key" ON "TopicDef"("bookTopicId");

-- 6. Foreign keys
ALTER TABLE "CurriculumBook" ADD CONSTRAINT "CurriculumBook_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "SubjectDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookChapter" ADD CONSTRAINT "BookChapter_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "CurriculumBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookTopic" ADD CONSTRAINT "BookTopic_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "BookChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterDef" ADD CONSTRAINT "ChapterDef_bookChapterId_fkey"
    FOREIGN KEY ("bookChapterId") REFERENCES "BookChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TopicDef" ADD CONSTRAINT "TopicDef_bookTopicId_fkey"
    FOREIGN KEY ("bookTopicId") REFERENCES "BookTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
