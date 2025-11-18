/*
  Warnings:

  - A unique constraint covering the columns `[userId,endpoint,method]` on the table `ApiUsage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ApiUsage_userId_endpoint_key";

-- AlterTable
ALTER TABLE "ApiUsage" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "method" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_userId_endpoint_method_key" ON "ApiUsage"("userId", "endpoint", "method");
