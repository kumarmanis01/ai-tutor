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
ALTER TABLE "ReferralReward" ADD CONSTRAINT IF NOT EXISTS fk_referralreward_referral FOREIGN KEY ("referralId") REFERENCES "Referral" (id) ON DELETE SET NULL;
ALTER TABLE "ReferralReward" ADD CONSTRAINT IF NOT EXISTS fk_referralreward_user FOREIGN KEY ("userId") REFERENCES "User" (id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referralreward_userid ON "ReferralReward" ("userId");
CREATE INDEX IF NOT EXISTS idx_referralreward_status ON "ReferralReward" ("status");
