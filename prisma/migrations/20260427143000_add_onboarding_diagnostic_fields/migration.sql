-- Add onboarding quick diagnostic persistence fields (S1.3)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "onboardingDiagnosticScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "onboardingPlacement" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingDiagnosticCompletedAt" TIMESTAMP(3);
