/*
  Warnings:

  - A unique constraint covering the columns `[userId,endpoint]` on the table `ApiUsage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_userId_endpoint_key" ON "public"."ApiUsage"("userId", "endpoint");
