/*
  Warnings:

  - Added the required column `success` to the `AIContentLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('draft', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "AIContentLog" ADD COLUMN     "success" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "ChapterDef" ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "TopicNote" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
