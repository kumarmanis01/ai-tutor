-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pseudonymisedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "retainAuditLog" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletionRequest_userId_key" ON "DeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "DeletionRequest_pseudonymisedAt_idx" ON "DeletionRequest"("pseudonymisedAt");

-- CreateIndex
CREATE INDEX "DeletionRequest_purgedAt_idx" ON "DeletionRequest"("purgedAt");

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
