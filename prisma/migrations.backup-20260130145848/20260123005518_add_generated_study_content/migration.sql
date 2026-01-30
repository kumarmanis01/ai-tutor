-- CreateTable
CREATE TABLE "GeneratedStudyContent" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT,
    "grade" INTEGER,
    "board" TEXT,
    "language" "LanguageCode" NOT NULL DEFAULT 'en',
    "contentJson" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedStudyContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStudyBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "personalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStudyBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedStudyContent_contentHash_key" ON "GeneratedStudyContent"("contentHash");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_topic" ON "GeneratedStudyContent"("topic");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_context" ON "GeneratedStudyContent"("subject", "grade", "board");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_user" ON "GeneratedStudyContent"("generatedBy");

-- CreateIndex
CREATE INDEX "idx_generated_study_content_created" ON "GeneratedStudyContent"("createdAt");

-- CreateIndex
CREATE INDEX "StudentStudyBookmark_userId_createdAt_idx" ON "StudentStudyBookmark"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStudyBookmark_userId_contentType_contentId_key" ON "StudentStudyBookmark"("userId", "contentType", "contentId");

-- AddForeignKey
ALTER TABLE "GeneratedStudyContent" ADD CONSTRAINT "GeneratedStudyContent_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStudyBookmark" ADD CONSTRAINT "StudentStudyBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
