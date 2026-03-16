-- CreateTable
CREATE TABLE "PushSubscriptionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscriptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushSubscriptionRecord_userId_idx" ON "PushSubscriptionRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscriptionRecord_userId_endpoint_key" ON "PushSubscriptionRecord"("userId", "endpoint");

-- AddForeignKey
ALTER TABLE "PushSubscriptionRecord" ADD CONSTRAINT "PushSubscriptionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
