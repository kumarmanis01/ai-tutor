/*
  Warnings:

  - Made the column `method` on table `ApiUsage` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ApiUsage" ALTER COLUMN "method" SET NOT NULL;
