-- Migration: add Installment table + InstallmentStatus enum
-- Adds: Installment table (per-subscription EMI schedule)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'installmentstatus') THEN
    CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING','PAID','FAILED','CANCELLED');
  END IF;
END$$;

-- Create Installment table
CREATE TABLE IF NOT EXISTS "Installment" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "number" integer NOT NULL,
  "dueAt" timestamptz NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" text,
  "providerPaymentId" text,
  "paymentId" text,
  "attemptCount" integer NOT NULL DEFAULT 0,
  "lastAttemptAt" timestamptz,
  "paidAt" timestamptz,
  "meta" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS idx_installment_subscriptionId ON "Installment" ("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_installment_dueAt ON "Installment" ("dueAt");
CREATE UNIQUE INDEX IF NOT EXISTS uniq_installment_subscription_number ON "Installment" ("subscriptionId", "number");

-- Foreign keys
ALTER TABLE "Installment" ADD CONSTRAINT fk_installment_subscription FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT fk_installment_payment FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL;
