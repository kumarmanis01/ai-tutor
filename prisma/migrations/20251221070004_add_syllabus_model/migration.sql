-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Syllabus" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "SyllabusStatus" NOT NULL DEFAULT 'DRAFT',
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Syllabus_status_idx" ON "Syllabus"("status");
