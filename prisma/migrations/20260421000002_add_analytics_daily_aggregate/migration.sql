-- CreateTable: AnalyticsDailyAggregate
-- Daily rollup produced by analyticsAggregator worker; keyed on courseId + day.

CREATE TABLE "AnalyticsDailyAggregate" (
    "id"               TEXT NOT NULL,
    "courseId"         TEXT NOT NULL,
    "day"              TIMESTAMP(3) NOT NULL,
    "totalViews"       INTEGER NOT NULL DEFAULT 0,
    "totalCompletions" INTEGER NOT NULL DEFAULT 0,
    "avgTimePerLesson" DOUBLE PRECISION,
    "completionRate"   DOUBLE PRECISION,
    "uniqueUsers"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailyAggregate_courseId_day_key" ON "AnalyticsDailyAggregate"("courseId", "day");

-- CreateIndex
CREATE INDEX "AnalyticsDailyAggregate_day_idx" ON "AnalyticsDailyAggregate"("day");
