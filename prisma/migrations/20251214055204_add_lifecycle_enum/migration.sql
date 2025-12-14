/*
  Warnings:

  - The `status` column on the `GeneratedTest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isActive` on the `TopicDef` table. All the data in the column will be lost.
  - The `status` column on the `TopicDef` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isActive` on the `TopicNote` table. All the data in the column will be lost.
  - The `status` column on the `TopicNote` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SoftDeleteStatus" AS ENUM ('active', 'deleted');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalStatus" ADD VALUE 'pending';
ALTER TYPE "ApprovalStatus" ADD VALUE 'archived';

-- AlterTable
ALTER TABLE "ChapterDef" ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "GeneratedTest" ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
DROP COLUMN "status",
ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "TopicDef" DROP COLUMN "isActive",
ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
DROP COLUMN "status",
ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "TopicNote" DROP COLUMN "isActive",
ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active',
DROP COLUMN "status",
ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "ApprovalAudit" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" "ApprovalStatus" NOT NULL,
    "toStatus" "ApprovalStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAudit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApprovalAudit" ADD CONSTRAINT "ApprovalAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
