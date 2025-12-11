-- Repaired baseline migration: create minimal required tables

-- Create enums used by User
DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('active', 'banned', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'moderator', 'support');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create minimal User table (referenced by TestResult)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE,
    "phone" TEXT UNIQUE,
    "status" "UserStatus" DEFAULT 'active',
    "role" "UserRole" DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create TestResult table (referenced by AttemptQuestion in next migration)
CREATE TABLE IF NOT EXISTS "TestResult" (
    "id" TEXT PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rawResult" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Foreign key from TestResult to User
DO $$ BEGIN
    ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Helpful index used by queries
CREATE INDEX IF NOT EXISTS "TestResult_studentId_idx" ON "TestResult"("studentId");
