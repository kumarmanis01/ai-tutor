-- CreateTable
CREATE TABLE "StudentConceptState" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "nextReviewAt" TIMESTAMP(3),
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentConceptState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "questionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "studentAnswer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentConceptState_studentId_idx" ON "StudentConceptState"("studentId");

-- CreateIndex
CREATE INDEX "StudentConceptState_nextReviewAt_idx" ON "StudentConceptState"("nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentConceptState_studentId_conceptId_key" ON "StudentConceptState"("studentId", "conceptId");

-- CreateIndex
CREATE INDEX "AnswerEvent_studentId_conceptId_idx" ON "AnswerEvent"("studentId", "conceptId");

-- CreateIndex
CREATE INDEX "AnswerEvent_studentId_createdAt_idx" ON "AnswerEvent"("studentId", "createdAt");
