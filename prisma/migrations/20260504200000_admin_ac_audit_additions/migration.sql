-- F-ADM-003 AC-05: IRT validation flag on Question
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "validated"   BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);

-- F-ADM-004 AC-01: Contrastive example on Misconception
ALTER TABLE "Misconception"
  ADD COLUMN IF NOT EXISTS "contrastiveExample" TEXT;

-- F-ADM-040 AC-01: Parent mobile hash on Consent (DPDP compliance)
ALTER TABLE "Consent"
  ADD COLUMN IF NOT EXISTS "parentMobileHash" TEXT;
