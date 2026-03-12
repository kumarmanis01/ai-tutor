-- CreateTable
CREATE TABLE "LearningPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "unlockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LearningPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_studentId_key" ON "LearningPlan"("studentId");

-- CreateIndex
CREATE INDEX "LearningPlan_studentId_idx" ON "LearningPlan"("studentId");

-- CreateIndex
CREATE INDEX "LearningPlanItem_planId_orderIndex_idx" ON "LearningPlanItem"("planId", "orderIndex");

-- CreateIndex
CREATE INDEX "LearningPlanItem_planId_status_idx" ON "LearningPlanItem"("planId", "status");

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
