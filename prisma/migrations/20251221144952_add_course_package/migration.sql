-- CreateEnum
CREATE TYPE "CoursePackageStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CoursePackage" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CoursePackageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoursePackage_syllabusId_idx" ON "CoursePackage"("syllabusId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePackage_syllabusId_version_key" ON "CoursePackage"("syllabusId", "version");
