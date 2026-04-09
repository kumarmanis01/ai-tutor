-- Migration: add PaymentEvent audit table and providerIdempotencyKey on PaymentOrder

-- Add providerIdempotencyKey to PaymentOrder (if not already present)
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "providerIdempotencyKey" TEXT;

-- Create PaymentEvent table
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT,
  "userId" TEXT,
  "provider" TEXT NOT NULL,
  "providerIdempotencyKey" TEXT,
  "transactionId" TEXT,
  "orderId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "amount" INT,
  "status" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Foreign key to Payment (nullable)
ALTER TABLE "PaymentEvent" ADD CONSTRAINT IF NOT EXISTS fk_paymentevent_payment FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_paymentevent_provider_idempotency ON "PaymentEvent" ("provider", "providerIdempotencyKey");
CREATE INDEX IF NOT EXISTS idx_paymentevent_paymentId ON "PaymentEvent" ("paymentId");
CREATE INDEX IF NOT EXISTS idx_paymentevent_userId ON "PaymentEvent" ("userId");
