/*
  Warnings:

  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Made the column `provider` on table `Payment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."ApiUsage" ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "count" DROP DEFAULT,
ALTER COLUMN "lastUsed" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "subscriptionId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE INTEGER,
ALTER COLUMN "provider" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
