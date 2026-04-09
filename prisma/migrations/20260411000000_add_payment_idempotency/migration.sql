-- Migration: add provider idempotency key to payments

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_provider_idempotency ON "Payment" ("provider", "providerIdempotencyKey");
