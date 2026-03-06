-- CreateEnum
CREATE TYPE "ParentInviteStatus" AS ENUM ('pending', 'consumed', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "ParentInvite" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ParentInviteStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByParentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationTrace" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentInvite_code_key" ON "ParentInvite"("code");

-- CreateIndex
CREATE INDEX "ParentInvite_studentId_idx" ON "ParentInvite"("studentId");

-- CreateIndex
CREATE INDEX "ParentInvite_status_expiresAt_idx" ON "ParentInvite"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ParentInvite_consumedByParentId_idx" ON "ParentInvite"("consumedByParentId");

-- CreateIndex
CREATE INDEX "RecommendationTrace_studentId_createdAt_idx" ON "RecommendationTrace"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationTrace_entityType_idx" ON "RecommendationTrace"("entityType");

-- AddForeignKey
ALTER TABLE "ParentInvite" ADD CONSTRAINT "ParentInvite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInvite" ADD CONSTRAINT "ParentInvite_consumedByParentId_fkey" FOREIGN KEY ("consumedByParentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
