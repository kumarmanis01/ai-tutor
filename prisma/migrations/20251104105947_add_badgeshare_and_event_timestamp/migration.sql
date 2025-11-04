-- CreateTable
CREATE TABLE "BadgeShare" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BadgeShare_badgeId_idx" ON "BadgeShare"("badgeId");

-- CreateIndex
CREATE INDEX "BadgeShare_recipientId_idx" ON "BadgeShare"("recipientId");
