-- Create ReferralReward table to store pending/applied referral credits
CREATE TABLE IF NOT EXISTS "ReferralReward" (
  "id" text PRIMARY KEY NOT NULL,
  "referralId" text,
  "userId" text NOT NULL,
  "amount" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "appliedAt" timestamptz,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys
-- Foreign keys (use guarded DO blocks for compatibility with older Postgres)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referralreward_referral'
  ) THEN
    ALTER TABLE "ReferralReward" ADD CONSTRAINT fk_referralreward_referral FOREIGN KEY ("referralId") REFERENCES "Referral" (id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referralreward_user'
  ) THEN
    ALTER TABLE "ReferralReward" ADD CONSTRAINT fk_referralreward_user FOREIGN KEY ("userId") REFERENCES "User" (id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Indexes (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_referralreward_userid'
  ) THEN
    CREATE INDEX idx_referralreward_userid ON "ReferralReward" ("userId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_referralreward_status'
  ) THEN
    CREATE INDEX idx_referralreward_status ON "ReferralReward" ("status");
  END IF;
END
$$;
