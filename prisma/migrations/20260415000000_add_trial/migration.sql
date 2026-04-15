-- Migration: add Trial table and TrialStatus enum
-- Creates a short-lived trial record used by marketing funnels and nudges.

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('ACTIVE','EXPIRED','CONVERTED','CANCELLED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Trial" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "parentName" TEXT,
    "childClass" TEXT,
    "schoolName" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "TrialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Trial_phone_idx" ON "Trial"("phone");
CREATE INDEX "Trial_status_idx" ON "Trial"("status");
