-- Migration: add creditBalance to Subscription (paise integer)
-- Generated manually to add column for prorated credits

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "creditBalance" integer DEFAULT 0;
