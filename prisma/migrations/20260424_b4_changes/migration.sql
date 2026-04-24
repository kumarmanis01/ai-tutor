-- S0.1 / S0.3: Add isAdult boolean to User so registration can gate consent flow.
-- Generated: 2026-04-24T00:00:00Z | copilot | replaced placeholder with real SQL
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdult" BOOLEAN NOT NULL DEFAULT false;
