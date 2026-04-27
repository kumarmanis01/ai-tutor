-- CreateEnum
CREATE TYPE "RetryIntentStatus" AS ENUM ('PENDING', 'CONSUMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RetryReasonCode" AS ENUM ('TRANSIENT_FAILURE', 'BAD_INPUT', 'IMPROVED_PROMPT', 'INFRA_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublishScope" AS ENUM ('COURSE', 'MODULE', 'LESSON');

-- CreateTable
CREATE TABLE "RetryIntent" (
    "id" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "sourceOutputRef" JSONB,
    "reasonCode" "RetryReasonCode" NOT NULL,
    "reasonText" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "RetryIntentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetryIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionCandidate" (
    "id" TEXT NOT NULL,
    "scope" "PublishScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "regenerationJobId" TEXT NOT NULL,
    "outputRef" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" JSONB,

    CONSTRAINT "PromotionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedOutput" (
    "id" TEXT NOT NULL,
    "scope" "PublishScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "outputRef" TEXT NOT NULL,
    "promotedBy" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_retryintent_sourceJobId" ON "RetryIntent"("sourceJobId");

-- CreateIndex
CREATE INDEX "idx_promotioncandidate_scope_ref" ON "PromotionCandidate"("scope", "scopeRefId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCandidate_scope_scopeRefId_outputRef_key" ON "PromotionCandidate"("scope", "scopeRefId", "outputRef");

-- CreateIndex
CREATE INDEX "idx_publishedoutput_scope" ON "PublishedOutput"("scope", "scopeRefId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedOutput_scope_scopeRefId_key" ON "PublishedOutput"("scope", "scopeRefId");
