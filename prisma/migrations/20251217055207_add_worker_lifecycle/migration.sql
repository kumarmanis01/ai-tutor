-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('STARTING', 'RUNNING', 'DRAINING', 'STOPPED', 'FAILED');

-- CreateTable
CREATE TABLE "WorkerLifecycle" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT,
    "pid" INTEGER,
    "status" "WorkerStatus" NOT NULL DEFAULT 'STARTING',
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerLifecycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerLifecycle_status_idx" ON "WorkerLifecycle"("status");

-- CreateIndex
CREATE INDEX "WorkerLifecycle_lastHeartbeatAt_idx" ON "WorkerLifecycle"("lastHeartbeatAt");
