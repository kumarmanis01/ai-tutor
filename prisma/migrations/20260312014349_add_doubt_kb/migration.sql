-- CreateTable
CREATE TABLE "DoubtKb" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtKb_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoubtKb_studentId_conceptId_idx" ON "DoubtKb"("studentId", "conceptId");

-- CreateIndex
CREATE INDEX "DoubtKb_conceptId_idx" ON "DoubtKb"("conceptId");
