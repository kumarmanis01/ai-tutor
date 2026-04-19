-- Create LtvSnapshot table to persist periodic snapshots of LTV/CAC metrics
CREATE TABLE IF NOT EXISTS "LtvSnapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "snapshotAt" timestamptz NOT NULL DEFAULT now(),
  "windowStart" timestamptz,
  "windowEnd" timestamptz,
  "mrr_paise" integer NOT NULL DEFAULT 0,
  "active_subscriptions" integer NOT NULL DEFAULT 0,
  "arpu_paise" integer NOT NULL DEFAULT 0,
  "ltv_paise" integer NOT NULL DEFAULT 0,
  "marketing_spend_paise" integer NOT NULL DEFAULT 0,
  "new_customers" integer NOT NULL DEFAULT 0,
  "cac_paise" integer,
  "ltv_cac_ratio" double precision,
  "createdBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_ltvsnapshot_snapshotat'
  ) THEN
    CREATE INDEX idx_ltvsnapshot_snapshotat ON "LtvSnapshot" ("snapshotAt");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ltvsnapshot_createdby'
  ) THEN
    ALTER TABLE "LtvSnapshot" ADD CONSTRAINT fk_ltvsnapshot_createdby FOREIGN KEY ("createdBy") REFERENCES "User" (id) ON DELETE SET NULL;
  END IF;
END
$$;
