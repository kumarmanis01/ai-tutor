-- Add missing timezone column to User to match Prisma schema
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "timezone" TEXT;

