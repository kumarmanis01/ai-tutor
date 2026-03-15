-- CreateTable
CREATE TABLE "DailyCostMetric" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sessions" INTEGER NOT NULL,
    "totalCostUsd" DOUBLE PRECISION NOT NULL,
    "costPerSession" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCostMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyCostMetric_date_key" ON "DailyCostMetric"("date");
