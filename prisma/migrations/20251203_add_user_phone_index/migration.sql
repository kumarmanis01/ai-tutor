-- Migration: add unique index for User.phone if missing
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_key" ON "User"("phone");
