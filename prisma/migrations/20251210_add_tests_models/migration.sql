-- Add Tests feature models: Question, AttemptQuestion, Answer
-- Generated via migrate diff; safe, incremental apply

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "chapter" TEXT,
    "grade" TEXT,
    "board" TEXT,
    "type" TEXT NOT NULL,
    "difficulty" TEXT,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctAnswer" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptQuestion" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "timeSpent" INTEGER,
    "result" TEXT,
    "awardedPoints" INTEGER,

    CONSTRAINT "AttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "attemptQuestionId" TEXT NOT NULL,
    "rawAnswer" TEXT,
    "normalizedAnswer" TEXT,
    "autoScore" INTEGER,
    "reviewerScore" INTEGER,
    "confidence" DOUBLE PRECISION
);

-- CreateIndex
CREATE INDEX "AttemptQuestion_testResultId_idx" ON "AttemptQuestion"("testResultId");

-- CreateIndex
CREATE INDEX "AttemptQuestion_questionId_idx" ON "AttemptQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptQuestionId_key" ON "Answer"("attemptQuestionId");

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptQuestion" ADD CONSTRAINT "AttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "AttemptQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;