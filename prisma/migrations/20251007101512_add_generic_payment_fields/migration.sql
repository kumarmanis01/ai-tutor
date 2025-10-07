/*
  Warnings:

  - You are about to drop the column `action` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `amount` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- AlterTable
ALTER TABLE "public"."AuditLog" DROP COLUMN "action",
DROP COLUMN "details",
ADD COLUMN     "amount" INTEGER NOT NULL,
ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "transactionId" TEXT,
ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
