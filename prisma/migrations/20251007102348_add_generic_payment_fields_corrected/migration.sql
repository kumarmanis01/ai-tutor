/*
  Warnings:

  - You are about to drop the column `amount` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `billingCycle` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `orderId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Added the required column `action` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `provider` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- AlterTable
ALTER TABLE "public"."AuditLog" DROP COLUMN "amount",
DROP COLUMN "billingCycle",
DROP COLUMN "meta",
DROP COLUMN "orderId",
DROP COLUMN "plan",
DROP COLUMN "provider",
DROP COLUMN "status",
DROP COLUMN "transactionId",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "details" JSONB,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "transactionId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE INTEGER,
ALTER COLUMN "provider" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
