-- FILE OBJECTIVE:
-- - Add prompt versioning infrastructure and centralized AI generation logging.
-- - Seed MVP prompt versions for all Sprint 7 prompt types.
--
-- LINKED UNIT TEST:
-- - tests/unit/prisma/schema.spec.ts
--
-- COPILOT INSTRUCTIONS FOLLOWED:
-- - /docs/COPILOT_GUARDRAILS.md
-- - .github/copilot-instructions.md
--
-- EDIT LOG:
-- - 2026-04-26T15:00:00Z | copilot | add PromptVersion and AIGenerationLog schema with MVP prompt seeds

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromptTypeEnum') THEN
    CREATE TYPE "PromptTypeEnum" AS ENUM (
      'LESSON_GENERATION',
      'CONTENT_ENHANCEMENT',
      'DOUBT_SOLVING',
      'SIMPLE_EXPLANATION',
      'PRACTICE_QUESTIONS',
      'DIAGNOSTIC_QUIZ',
      'PROGRESSIVE_HINTS',
      'CONTENT_TAGGING',
      'WEEKLY_REPORT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromptStatus') THEN
    CREATE TYPE "PromptStatus" AS ENUM (
      'DRAFT',
      'TESTING',
      'ACTIVE',
      'DEPRECATED',
      'ARCHIVED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PromptVersion" (
  "id" TEXT NOT NULL,
  "promptType" "PromptTypeEnum" NOT NULL,
  "version" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "userPromptTemplate" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "maxTokens" INTEGER NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL,
  "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
  "changeNotes" TEXT,
  "createdBy" TEXT,
  "performanceScore" DOUBLE PRECISION,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "avgLatencyMs" DOUBLE PRECISION,
  "avgTokenUsage" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_promptType_version_key"
  ON "PromptVersion"("promptType", "version");

CREATE INDEX IF NOT EXISTS "PromptVersion_promptType_status_idx"
  ON "PromptVersion"("promptType", "status");

CREATE INDEX IF NOT EXISTS "PromptVersion_status_idx"
  ON "PromptVersion"("status");

CREATE INDEX IF NOT EXISTS "PromptVersion_createdAt_idx"
  ON "PromptVersion"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_active_per_type_unique"
  ON "PromptVersion"("promptType")
  WHERE "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "AIGenerationLog" (
  "id" TEXT NOT NULL,
  "promptType" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "abTestId" TEXT,
  "abVariant" TEXT,
  "requestVariables" JSONB,
  "requestTokens" INTEGER,
  "responseText" TEXT,
  "responseTokens" INTEGER,
  "totalTokens" INTEGER,
  "latencyMs" INTEGER,
  "modelName" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "qualityScore" DOUBLE PRECISION,
  "qualityDetails" JSONB,
  "userId" TEXT,
  "profileId" TEXT,
  "contentId" TEXT,
  "jobId" TEXT,
  "estimatedCostInr" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIGenerationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AIGenerationLog_promptType_idx"
  ON "AIGenerationLog"("promptType");

CREATE INDEX IF NOT EXISTS "AIGenerationLog_promptVersion_idx"
  ON "AIGenerationLog"("promptVersion");

CREATE INDEX IF NOT EXISTS "AIGenerationLog_createdAt_idx"
  ON "AIGenerationLog"("createdAt");

CREATE INDEX IF NOT EXISTS "AIGenerationLog_success_idx"
  ON "AIGenerationLog"("success");

CREATE INDEX IF NOT EXISTS "AIGenerationLog_qualityScore_idx"
  ON "AIGenerationLog"("qualityScore");

INSERT INTO "PromptVersion" (
  "id",
  "promptType",
  "version",
  "systemPrompt",
  "userPromptTemplate",
  "modelName",
  "maxTokens",
  "temperature",
  "status",
  "changeNotes",
  "createdBy",
  "createdAt",
  "updatedAt"
)
VALUES
  ('seed-lesson-generation-v1-0-0', 'LESSON_GENERATION', 'v1.0.0', 'You are Vidya, a curriculum-aligned tutor for K-12 students in India.', 'Generate a complete lesson for {{topic}} in {{language}} for Grade {{grade}} {{board}} students. Include objectives, explanation, examples, recap, and 3 Socratic checks.', 'gpt-4o-mini', 1400, 0.3, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-content-enhancement-v1-0-0', 'CONTENT_ENHANCEMENT', 'v1.0.0', 'You are a content quality improver. Preserve facts and improve pedagogy.', 'Enhance the provided content for {{topic}} and keep it grade-appropriate for Grade {{grade}} {{board}}. Return structured markdown only.', 'gpt-4o-mini', 1200, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-doubt-solving-v1-0-0', 'DOUBT_SOLVING', 'v1.0.0', 'You are Vidya. Solve doubts using Socratic guidance, not direct answer dumping.', 'Answer this student doubt: {{studentQuestion}} for {{subject}} Grade {{grade}} {{board}} in {{preferredLanguage}}. Ask a follow-up learning question.', 'gpt-4o-mini', 900, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-simple-explanation-v1-0-0', 'SIMPLE_EXPLANATION', 'v1.0.0', 'You simplify difficult ideas for school students with clear analogies.', 'Explain {{concept}} in simple terms for Grade {{grade}} {{board}} students in {{language}}. Keep it short and clear.', 'gpt-4o-mini', 700, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-practice-questions-v1-0-0', 'PRACTICE_QUESTIONS', 'v1.0.0', 'You create rigorous but fair practice questions.', 'Create {{count}} practice questions on {{topic}} for Grade {{grade}} {{board}} {{subject}} in {{language}}. Include answer and explanation.', 'gpt-4o-mini', 1100, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-diagnostic-quiz-v1-0-0', 'DIAGNOSTIC_QUIZ', 'v1.0.0', 'You create diagnostic quizzes that estimate student level reliably.', 'Generate a diagnostic quiz for {{subject}} Grade {{grade}} {{board}} in {{language}} with mixed difficulty and clear solutions.', 'gpt-4o-mini', 1100, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-progressive-hints-v1-0-0', 'PROGRESSIVE_HINTS', 'v1.0.0', 'You provide tiered hints from broad guidance to specific nudges.', 'Generate 3 progressive hints for this question: {{question}} for Grade {{grade}} {{board}} students. Do not reveal final answer in hint 1 or 2.', 'gpt-4o-mini', 500, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-content-tagging-v1-0-0', 'CONTENT_TAGGING', 'v1.0.0', 'You tag educational content consistently for indexing and retrieval.', 'Tag the content for {{subject}} Grade {{grade}} {{board}} with chapter, topic, skills, and difficulty metadata.', 'gpt-4o-mini', 500, 0.1, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW()),
  ('seed-weekly-report-v1-0-0', 'WEEKLY_REPORT', 'v1.0.0', 'You write concise parent-facing weekly progress reports.', 'Write a weekly report in {{language}} for student progress data {{summaryData}}. Tone must be encouraging and actionable.', 'gpt-4o-mini', 900, 0.2, 'ACTIVE', 'Initial MVP prompt seed', 'system', NOW(), NOW())
ON CONFLICT ("promptType", "version") DO NOTHING;
