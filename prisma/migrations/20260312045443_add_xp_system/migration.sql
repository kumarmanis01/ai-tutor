-- AlterTable
ALTER TABLE "User" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalXp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StudentXP" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sessionId" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentXP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentXP_studentId_idx" ON "StudentXP"("studentId");

-- CreateIndex
CREATE INDEX "StudentXP_studentId_awardedAt_idx" ON "StudentXP"("studentId", "awardedAt");

-- AddForeignKey
ALTER TABLE "StudentXP" ADD CONSTRAINT "StudentXP_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
