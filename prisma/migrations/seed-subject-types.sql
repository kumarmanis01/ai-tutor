-- Seed SubjectType and targetLanguage for existing SubjectDef rows.
-- Run once after applying the 20260527000001_add_subject_type_language migration.
--
-- Usage (from project root on VPS):
--   bash scripts/db-exec.sh "$(cat prisma/migrations/seed-subject-types.sql)"

BEGIN;

-- Language subjects
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'hi'  WHERE lower(name) = 'hindi';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'en'  WHERE lower(name) = 'english';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'sa'  WHERE lower(name) = 'sanskrit';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'fr'  WHERE lower(name) = 'french';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'de'  WHERE lower(name) = 'german';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'es'  WHERE lower(name) = 'spanish';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'ur'  WHERE lower(name) = 'urdu';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'ta'  WHERE lower(name) = 'tamil';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'te'  WHERE lower(name) = 'telugu';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'kn'  WHERE lower(name) = 'kannada';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'ml'  WHERE lower(name) = 'malayalam';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'bn'  WHERE lower(name) = 'bengali';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'mr'  WHERE lower(name) = 'marathi';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'gu'  WHERE lower(name) = 'gujarati';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'pa'  WHERE lower(name) = 'punjabi';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'or'  WHERE lower(name) = 'odia';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'as'  WHERE lower(name) = 'assamese';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'mai' WHERE lower(name) = 'maithili';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'sd'  WHERE lower(name) = 'sindhi';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'kok' WHERE lower(name) = 'konkani';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'ar'  WHERE lower(name) = 'arabic';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'ja'  WHERE lower(name) = 'japanese';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'zh'  WHERE lower(name) = 'chinese';
UPDATE "SubjectDef" SET "subjectType" = 'LANGUAGE', "targetLanguage" = 'ru'  WHERE lower(name) = 'russian';

-- STEM subjects
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'mathematics';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'physics';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'chemistry';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'biology';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'computer science';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'accountancy';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'statistics';
UPDATE "SubjectDef" SET "subjectType" = 'STEM' WHERE lower(name) = 'environmental science';

-- Social subjects
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'history';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'geography';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'civics';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'political science';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'economics';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'sociology';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'psychology';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'evs';
UPDATE "SubjectDef" SET "subjectType" = 'SOCIAL' WHERE lower(name) = 'social science';

COMMIT;
