-- CreateTable: Content
-- CreateTable: ContentVersion
-- CreateTable: ContentFlag
-- CreateTable: GenerationJob
-- All enums (ContentType, ContentStatus, FlagStatus, ContentGenerationJobStatus) already exist

CREATE TABLE IF NOT EXISTS "Content" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "board" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL DEFAULT 'en',
    "type" "ContentType" NOT NULL DEFAULT 'AI_GENERATED',
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "contentJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Content_jobId_key" ON "Content"("jobId");

CREATE INDEX IF NOT EXISTS "Content_subject_grade_board_status_idx" ON "Content"("subject", "grade", "board", "status");
CREATE INDEX IF NOT EXISTS "Content_createdById_createdAt_idx" ON "Content"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "Content_status_createdAt_idx" ON "Content"("status", "createdAt");

ALTER TABLE "Content" ADD CONSTRAINT "Content_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ContentVersion
CREATE TABLE IF NOT EXISTS "ContentVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentVersion_contentId_version_key" ON "ContentVersion"("contentId", "version");
CREATE INDEX IF NOT EXISTS "ContentVersion_contentId_version_idx" ON "ContentVersion"("contentId", "version");

ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ContentFlag
CREATE TABLE IF NOT EXISTS "ContentFlag" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "reason" "FlagReason" NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "flaggedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentFlag_contentId_status_idx" ON "ContentFlag"("contentId", "status");
CREATE INDEX IF NOT EXISTS "ContentFlag_status_createdAt_idx" ON "ContentFlag"("status", "createdAt");

ALTER TABLE "ContentFlag" ADD CONSTRAINT "ContentFlag_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: GenerationJob (depends on Content)
CREATE TABLE IF NOT EXISTS "GenerationJob" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "normalizedTopic" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "board" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL DEFAULT 'en',
    "status" "ContentGenerationJobStatus" NOT NULL DEFAULT 'PENDING',
    "subscriberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentId" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GenerationJob_normalizedTopic_status_idx" ON "GenerationJob"("normalizedTopic", "status");
CREATE INDEX IF NOT EXISTS "GenerationJob_createdById_createdAt_idx" ON "GenerationJob"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");

ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
