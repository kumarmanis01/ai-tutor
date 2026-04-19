-- Create MarketingSpend table to record marketing spend for CAC/LTV calculations
CREATE TABLE IF NOT EXISTS "MarketingSpend" (
  "id" text PRIMARY KEY NOT NULL,
  "periodStart" timestamptz NOT NULL,
  "periodEnd" timestamptz NOT NULL,
  "channel" text,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "notes" text,
  "createdBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz
);

-- Foreign key to User (createdBy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketingspend_createdby'
  ) THEN
    ALTER TABLE "MarketingSpend" ADD CONSTRAINT fk_marketingspend_createdby FOREIGN KEY ("createdBy") REFERENCES "User" (id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_marketingspend_periodstart'
  ) THEN
    CREATE INDEX idx_marketingspend_periodstart ON "MarketingSpend" ("periodStart");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_marketingspend_periodend'
  ) THEN
    CREATE INDEX idx_marketingspend_periodend ON "MarketingSpend" ("periodEnd");
  END IF;
END
$$;
