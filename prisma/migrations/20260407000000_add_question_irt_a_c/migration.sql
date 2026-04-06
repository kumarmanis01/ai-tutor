-- AddColumn: irt_a (discrimination) and irt_c (pseudo-guessing) to Question
-- Additive migration only -- no columns dropped or renamed.
-- Selector falls back to defaults (a=1.0, c=0.2) when values are NULL.

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "irt_a" DOUBLE PRECISION;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "irt_c" DOUBLE PRECISION;
