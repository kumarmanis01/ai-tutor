-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('LANGUAGE', 'STEM', 'SOCIAL', 'VOCATIONAL', 'OTHER');

-- AlterTable
ALTER TABLE "SubjectDef" ADD COLUMN "subjectType" "SubjectType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "SubjectDef" ADD COLUMN "targetLanguage" TEXT;
