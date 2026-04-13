-- Safely create PaymentEvent table and constraint if missing
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_paymentevent_payment'
  ) THEN
    BEGIN
      ALTER TABLE "PaymentEvent" ADD CONSTRAINT fk_paymentevent_payment FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE;
    EXCEPTION WHEN undefined_table THEN
      -- If Payment table doesn't exist or other issue, skip adding constraint for now.
      RAISE NOTICE 'Payment table not present; skipping fk_paymentevent_payment constraint';
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_paymentevent_provider_idempotency ON "PaymentEvent" ("provider", "providerIdempotencyKey");
CREATE INDEX IF NOT EXISTS idx_paymentevent_paymentId ON "PaymentEvent" ("paymentId");
CREATE INDEX IF NOT EXISTS idx_paymentevent_userId ON "PaymentEvent" ("userId");
