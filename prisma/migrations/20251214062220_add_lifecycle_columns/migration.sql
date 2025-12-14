/*
  Warnings:

  - You are about to drop the column `isActive` on the `Board` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Board" DROP COLUMN "isActive",
ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active';
