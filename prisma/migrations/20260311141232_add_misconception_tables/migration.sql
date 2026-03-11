-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggerPatterns" TEXT[],
    "correction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Misconception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMisconception" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "misconceptionId" TEXT NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StudentMisconception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Misconception_subjectId_conceptId_idx" ON "Misconception"("subjectId", "conceptId");

-- CreateIndex
CREATE INDEX "StudentMisconception_studentId_idx" ON "StudentMisconception"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMisconception_studentId_misconceptionId_key" ON "StudentMisconception"("studentId", "misconceptionId");
