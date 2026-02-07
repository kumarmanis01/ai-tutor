/**
 * FILE OBJECTIVE:
 * - Provides enqueue functions for TOPIC-scoped hydration jobs (notes, questions, tests).
 * - Follows the same pattern as enqueueSyllabusHydration (idempotent, creates HydrationJob + Outbox).
 *
 * LINKED UNIT TEST:
 * - tests/lib/execution-pipeline/enqueueTopicHydration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T02:00:00Z | copilot | Phase 2: Created topic hydration enqueue functions
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { JobStatus } from '@/lib/ai-engine/types';
import { isSystemSettingEnabled } from '@/lib/systemSettings';
import { logger } from '@/lib/logger';
import { normalizeLanguage, normalizeDifficulty } from '@/lib/normalize';

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1';

/**
 * Result type for hydration enqueue functions.
 * Matches enqueueSyllabusHydration contract for consistency.
 */
type HydrationResult =
  | { created: true; jobId: string; bullJobId?: string | number; outboxId?: string }
  | { created: false; reason: string; jobId?: string };

/**
 * Common input for all topic-scoped hydration jobs.
 */
interface TopicHydrationInput {
  topicId: string;
  language?: string;
  difficulty?: string;
}

/**
 * Resolves topic and validates it exists with full academic context.
 * Returns resolved topic or null if not found.
 */
async function resolveTopicWithContext(topicId: string) {
  return prisma.topicDef.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } }
            }
          }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes Hydration Enqueue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enqueues a notes hydration job for a specific topic.
 * 
 * COPILOT RULES — NOTES HYDRATOR:
 * - Hydrators ONLY enqueue jobs
 * - NO AI calls allowed
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Must never mutate existing content
 * - Notes hydration is TOPIC-scoped
 */
export async function enqueueNotesHydration(input: TopicHydrationInput): Promise<HydrationResult> {
  const { topicId } = input;
  const language = normalizeLanguage(input.language) ?? 'en';

  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueNotesHydration called', { topicId, language });

  // 1️⃣ Global pause guard
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: HYDRATION_PAUSED');
    return { created: false, reason: 'hydration_paused' };
  }

  // 2️⃣ Resolve topic and validate it exists
  const topic = await resolveTopicWithContext(topicId);
  if (!topic) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: topic not found', { topicId });
    return { created: false, reason: 'resolve_not_found' };
  }

  // 3️⃣ Idempotency: if approved notes exist for this topic+language, skip
  const existingNotes = await prisma.topicNote.findFirst({
    where: {
      topicId,
      language,
      status: 'approved'
    }
  });
  if (existingNotes) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: notes_exist', { topicId, language });
    return { created: false, reason: 'content_exists' };
  }

  // 4️⃣ Prevent duplicate queued/running jobs for the same topic/language
  const existingJob = await (prisma.hydrationJob.findFirst ?? prisma.hydrationJob.findUnique)({
    where: {
      jobType: 'notes',
      topicId,
      language,
      status: { in: [JobStatus.Pending, JobStatus.Running] }
    }
  });
  if (existingJob) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: job_already_queued', { jobId: existingJob.id });
    return { created: false, reason: 'job_already_queued', jobId: existingJob.id };
  }

  // 5️⃣ Create HydrationJob row
  const jobData: any = {
    jobType: 'notes',
    topicId,
    language,
    difficulty: normalizeDifficulty('medium'), // notes don't use difficulty but schema requires it
    board: topic.chapter.subject.class.board.name,
    grade: topic.chapter.subject.class.grade,
    subject: topic.chapter.subject.name,
    subjectId: topic.chapter.subject.id,
    chapterId: topic.chapter.id,
    status: JobStatus.Pending
  };
  const generatedId = randomUUID();
  const job = await prisma.hydrationJob.create({ data: { id: generatedId, rootJobId: generatedId, ...jobData } });
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created HydrationJob for notes', { jobId: job.id });

  // 6️⃣ Create Outbox row for reliable enqueue
  try {
    const outbox = await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: 'NOTES', payload: { jobId: job.id } },
        meta: { hydrationJobId: job.id, topicId, language }
      }
    });
    if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created Outbox row for notes', { jobId: job.id, outboxId: outbox.id });
    return { created: true, jobId: job.id, outboxId: outbox.id };
  } catch (err) {
    logger.error('Failed to create outbox row for notes HydrationJob', { error: err, jobId: job.id });
    return { created: true, jobId: job.id };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Questions Hydration Enqueue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enqueues a questions hydration job for a specific topic.
 * 
 * COPILOT RULES — QUESTIONS HYDRATOR:
 * - Hydrators ONLY enqueue jobs
 * - NO AI calls allowed
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Must never mutate existing content
 * - Questions hydration is TOPIC-scoped
 */
export async function enqueueQuestionsHydration(input: TopicHydrationInput): Promise<HydrationResult> {
  const { topicId } = input;
  const language = normalizeLanguage(input.language) ?? 'en';
  const difficulty = normalizeDifficulty(input.difficulty) ?? 'medium';

  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueQuestionsHydration called', { topicId, language, difficulty });

  // 1️⃣ Global pause guard
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: HYDRATION_PAUSED');
    return { created: false, reason: 'hydration_paused' };
  }

  // 2️⃣ Resolve topic and validate it exists
  const topic = await resolveTopicWithContext(topicId);
  if (!topic) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: topic not found', { topicId });
    return { created: false, reason: 'resolve_not_found' };
  }

  // 3️⃣ Idempotency: if approved questions exist for this topic+language+difficulty, skip
  const existingQuestions = await prisma.generatedTest.findFirst({
    where: {
      topicId,
      language,
      difficulty,
      status: 'approved'
    }
  });
  if (existingQuestions) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: questions_exist', { topicId, language, difficulty });
    return { created: false, reason: 'content_exists' };
  }

  // 4️⃣ Prevent duplicate queued/running jobs for the same topic/language/difficulty
  const existingJob = await (prisma.hydrationJob.findFirst ?? prisma.hydrationJob.findUnique)({
    where: {
      jobType: 'questions',
      topicId,
      language,
      difficulty,
      status: { in: [JobStatus.Pending, JobStatus.Running] }
    }
  });
  if (existingJob) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: job_already_queued', { jobId: existingJob.id });
    return { created: false, reason: 'job_already_queued', jobId: existingJob.id };
  }

  // 5️⃣ Create HydrationJob row
  const jobData: any = {
    jobType: 'questions',
    topicId,
    language,
    difficulty,
    board: topic.chapter.subject.class.board.name,
    grade: topic.chapter.subject.class.grade,
    subject: topic.chapter.subject.name,
    subjectId: topic.chapter.subject.id,
    chapterId: topic.chapter.id,
    status: JobStatus.Pending
  };
  const generatedId = randomUUID();
  const job = await prisma.hydrationJob.create({ data: { id: generatedId, rootJobId: generatedId, ...jobData } });
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created HydrationJob for questions', { jobId: job.id });

  // 6️⃣ Create Outbox row for reliable enqueue
  try {
    const outbox = await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: 'QUESTIONS', payload: { jobId: job.id } },
        meta: { hydrationJobId: job.id, topicId, language, difficulty }
      }
    });
    if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created Outbox row for questions', { jobId: job.id, outboxId: outbox.id });
    return { created: true, jobId: job.id, outboxId: outbox.id };
  } catch (err) {
    logger.error('Failed to create outbox row for questions HydrationJob', { error: err, jobId: job.id });
    return { created: true, jobId: job.id };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests/Assemble Hydration Enqueue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enqueues a test assembly hydration job for a specific topic.
 * Tests are assembled from existing questions for a topic.
 * 
 * COPILOT RULES — TESTS HYDRATOR:
 * - Hydrators ONLY enqueue jobs
 * - NO AI calls allowed
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Must never mutate existing content
 * - Tests hydration is TOPIC-scoped
 */
export async function enqueueTestsHydration(input: TopicHydrationInput): Promise<HydrationResult> {
  const { topicId } = input;
  const language = normalizeLanguage(input.language) ?? 'en';
  const difficulty = normalizeDifficulty(input.difficulty) ?? 'medium';

  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueTestsHydration called', { topicId, language, difficulty });

  // 1️⃣ Global pause guard
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: HYDRATION_PAUSED');
    return { created: false, reason: 'hydration_paused' };
  }

  // 2️⃣ Resolve topic and validate it exists
  const topic = await resolveTopicWithContext(topicId);
  if (!topic) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: topic not found', { topicId });
    return { created: false, reason: 'resolve_not_found' };
  }

  // 3️⃣ Prevent duplicate queued/running jobs for the same topic/language/difficulty
  const existingJob = await prisma.hydrationJob.findFirst({
    where: {
      jobType: 'tests',
      topicId,
      language,
      difficulty,
      status: { in: [JobStatus.Pending, JobStatus.Running] }
    }
  });
  if (existingJob) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: job_already_queued', { jobId: existingJob.id });
    return { created: false, reason: 'job_already_queued', jobId: existingJob.id };
  }

  // 4️⃣ Create HydrationJob row
  const jobData: any = {
    jobType: 'tests',
    topicId,
    language,
    difficulty,
    board: topic.chapter.subject.class.board.name,
    grade: topic.chapter.subject.class.grade,
    subject: topic.chapter.subject.name,
    subjectId: topic.chapter.subject.id,
    chapterId: topic.chapter.id,
    status: JobStatus.Pending
  };
  const generatedId = randomUUID();
  const job = await prisma.hydrationJob.create({ data: { id: generatedId, rootJobId: generatedId, ...jobData } });
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created HydrationJob for tests', { jobId: job.id });

  // 5️⃣ Create Outbox row for reliable enqueue
  try {
    const outbox = await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: 'ASSEMBLE_TEST', payload: { jobId: job.id } },
        meta: { hydrationJobId: job.id, topicId, language, difficulty }
      }
    });
    if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created Outbox row for tests', { jobId: job.id, outboxId: outbox.id });
    return { created: true, jobId: job.id, outboxId: outbox.id };
  } catch (err) {
    logger.error('Failed to create outbox row for tests HydrationJob', { error: err, jobId: job.id });
    return { created: true, jobId: job.id };
  }
}

/**
 * Alias for enqueueTestsHydration - assemble and tests are the same operation.
 */
export const enqueueAssembleHydration = enqueueTestsHydration;
