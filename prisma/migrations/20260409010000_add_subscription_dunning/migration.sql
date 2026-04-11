-- Migration: add subscription meta + dunning fields
-- Adds: meta (json), dunningAttempts (int), lastDunningAt (timestamptz), graceUntil (timestamptz)

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "meta" jsonb NULL;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "dunningAttempts" integer NOT NULL DEFAULT 0;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "lastDunningAt" timestamptz NULL;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "graceUntil" timestamptz NULL;

-- Index for querying subscriptions in grace quickly
CREATE INDEX IF NOT EXISTS idx_subscription_grace_until ON "Subscription" ("graceUntil");
