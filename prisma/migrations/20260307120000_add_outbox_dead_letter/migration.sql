-- CreateTable
CREATE TABLE "OutboxDeadLetter" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "meta" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "deadLetterReason" TEXT NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL,
    "originalOutboxId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxDeadLetter_queue_idx" ON "OutboxDeadLetter"("queue");
CREATE INDEX "OutboxDeadLetter_failedAt_idx" ON "OutboxDeadLetter"("failedAt");
