-- Convert User.onboardingPlacement from TEXT to enum with bounded values.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingPlacement') THEN
    CREATE TYPE "OnboardingPlacement" AS ENUM ('FOUNDATION', 'STANDARD', 'ADVANCED');
  END IF;
END
$$;

UPDATE "User"
SET "onboardingPlacement" = NULL
WHERE "onboardingPlacement" IS NOT NULL
  AND "onboardingPlacement" NOT IN ('FOUNDATION', 'STANDARD', 'ADVANCED');

ALTER TABLE "User"
ALTER COLUMN "onboardingPlacement" TYPE "OnboardingPlacement"
USING ("onboardingPlacement"::text::"OnboardingPlacement");
