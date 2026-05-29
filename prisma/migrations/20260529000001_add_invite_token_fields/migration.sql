-- Migration: add_invite_token_fields
-- Adds inviteToken, inviteTokenExpiry, inviteAcceptedAt to User for the parent-invite
-- child activation flow. Additive-only: three nullable columns, unique index on token.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" TIMESTAMP(3);

-- Unique index: tokens must be globally unique (also used for O(1) lookup)
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteToken_key" ON "User"("inviteToken");
