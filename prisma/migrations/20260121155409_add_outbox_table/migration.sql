-- AlterTable
ALTER TABLE "HydrationJob" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "contentReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "meta" JSONB,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outbox_queue_sentAt_idx" ON "Outbox"("queue", "sentAt");
