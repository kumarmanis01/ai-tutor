import { prisma } from '@/lib/prisma';
import type { Question, TestResult } from '@prisma/client';
// Type matches Prisma enum -- defined inline to avoid build dependency on prisma generate
const MasteryLevel = { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced', expert: 'expert' } as const;
type MasteryLevel = (typeof MasteryLevel)[keyof typeof MasteryLevel];
import { createAIClient } from '@/lib/aiContext';
import { callTutorLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';

/**
 * Normalizes textual answers for comparison.
 */
export function normalizeAnswer(input?: string) {
  return (input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019\u201C\u201D]/g, '"');
}

export type QuestionFilters = {
  subject?: string;
  grade?: string;
  board?: string;
  chapter?: string;
  topicId?: string;
  difficulty?: string;
  type?: string;
};

/**
 * F-STU-020 AC-01: Lightweight Jaccard similarity approximation for semantic equivalence.
 *
 * Tokenises question prompts into word n-grams (unigrams) after lowercasing and stripping
 * punctuation. Returns the Jaccard index (intersection / union) of the two token sets.
 * A threshold >= 0.7 indicates the questions are likely semantically equivalent.
 *
 * This is a best-effort approximation; true embedding-based similarity requires pgvector
 * (deferred to Phase 2 infrastructure).
 */
export function computeJaccardSimilarity(a: string, b: string): number {
  const tokenise = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const setA = tokenise(a);
  const setB = tokenise(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((t) => { if (setB.has(t)) intersection++ });
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Returns question IDs the student has seen for the given chapter+subject in the past
 * `windowDays` days (default 90). Used by selectQuestionsWithMix to avoid repeating
 * recently seen questions (F-STU-020 AC-01).
 */
export async function getRecentlyUsedQuestionIds(
  studentId: string,
  chapter: string,
  subject: string,
  windowDays = 90,
): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const rows = await prisma.attemptQuestion.findMany({
    where: {
      testResult: {
        studentId,
        createdAt: { gte: since },
      },
      question: {
        chapter: { equals: chapter, mode: 'insensitive' },
        subject: { equals: subject, mode: 'insensitive' },
      },
    },
    select: { questionId: true },
  });
  return new Set(rows.map((r: { questionId: string }) => r.questionId));
}

/**
 * F-STU-020 AC-01: Returns the prompt text for recently attempted questions
 * so Jaccard similarity can be computed against candidate questions.
 * Limits to 200 rows to keep the payload bounded.
 */
export async function getRecentlyUsedQuestionPrompts(
  studentId: string,
  chapter: string,
  subject: string,
  windowDays = 90,
): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const rows = await prisma.attemptQuestion.findMany({
    where: {
      testResult: { studentId, createdAt: { gte: since } },
      question: {
        chapter: { equals: chapter, mode: 'insensitive' },
        subject: { equals: subject, mode: 'insensitive' },
      },
    },
    select: { question: { select: { prompt: true } } },
    take: 200,
  });
  return rows.map((r: { question: { prompt: string } }) => r.question.prompt);
}

/**
 * F-STU-020 AC-01: Returns true when the candidate question is semantically equivalent
 * (Jaccard >= 0.7) to any previously attempted question in the provided list.
 */
export function isSemanticallyDuplicate(candidatePrompt: string, usedPrompts: string[]): boolean {
  for (const used of usedPrompts) {
    if (computeJaccardSimilarity(candidatePrompt, used) >= 0.7) return true;
  }
  return false;
}

/**
 * Selects questions from the bank using simple weighted filters.
 * Falls back to GeneratedQuestion (hydration pipeline) if the Question table is empty.
 *
 * @param excludeIds  Optional set of question IDs to skip (AC-01 90-day uniqueness).
 */
export async function selectQuestions(
  filters: QuestionFilters,
  count: number,
  excludeIds?: Set<string>,
): Promise<Question[]> {
  const excludeClause =
    excludeIds && excludeIds.size > 0 ? { id: { notIn: Array.from(excludeIds) } } : {};

  const where: any = {
    status: 'ACTIVE' as const, // quarantined questions excluded -- do not remove this filter
    ...excludeClause,
    // Use case-insensitive matching for free-text fields to avoid slug vs display-name mismatches.
    ...(filters.subject ? { subject: { equals: filters.subject, mode: 'insensitive' } } : {}),
    ...(filters.topicId ? { topicId: filters.topicId } : {}),
    ...(filters.grade ? { grade: filters.grade } : {}),
    ...(filters.board ? { board: { equals: filters.board, mode: 'insensitive' } } : {}),
    ...(filters.chapter ? { chapter: { equals: filters.chapter, mode: 'insensitive' } } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
  };

  let pool = await prisma.question.findMany({
    where,
    orderBy: [{ difficulty: 'asc' }, { updatedAt: 'desc' }],
    take: count * 3,
  });

  try {
    logger.debug('selectQuestions.initial_pool', { filters, poolCount: pool.length });
  } catch {
    // best effort logging
  }

  // Broaden if too few
  if (pool.length < count && filters.subject) {
    pool = await prisma.question.findMany({
      // quarantined questions excluded -- do not remove this filter
      where: {
        status: 'ACTIVE',
        ...excludeClause,
        subject: { equals: filters.subject, mode: 'insensitive' },
      },
      orderBy: [{ difficulty: 'asc' }, { updatedAt: 'desc' }],
      take: count * 3,
    });
  }

  // Fallback: bridge from GeneratedQuestion (hydration pipeline) into Question table
  if (pool.length < count) {
    try {
      logger.debug('selectQuestions.sync_from_generated.before', { filters, need: count * 3 });
    } catch {}
    pool = await syncFromGeneratedQuestions(filters, count * 3);
    try {
      logger.debug('selectQuestions.sync_from_generated.after', { filters, poolCount: pool.length });
    } catch {}
  }

  // Deduplicate by prompt text to avoid showing the same question twice
  const seen = new Set<string>();
  const deduped: Question[] = [];
  for (const q of pool) {
    const key = (q.prompt ?? '').trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(q);
    }
  }

  try {
    logger.debug('selectQuestions.deduped', { filters, dedupedCount: deduped.length });
  } catch {}

  // Simple sampling without replacement
  const selected: Question[] = [];
  const indices = new Set<number>();
  while (selected.length < Math.min(count, deduped.length)) {
    const idx = Math.floor(Math.random() * deduped.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      selected.push(deduped[idx]);
    }
  }

  return selected;
}

/**
 * Query GeneratedQuestion via the topic/chapter/subject hierarchy,
 * upsert into the Question table (so AttemptQuestion FK works), and return them.
 */
async function syncFromGeneratedQuestions(filters: QuestionFilters, take: number): Promise<Question[]> {
  const subjectFilter: Record<string, unknown> = {};
  if (filters.subject) subjectFilter.name = { equals: filters.subject, mode: 'insensitive' };
  if (filters.board || filters.grade) {
    const classFilter: Record<string, unknown> = {};
    if (filters.board) classFilter.board = { slug: { equals: filters.board, mode: 'insensitive' } };
    if (filters.grade) classFilter.grade = Number(filters.grade);
    subjectFilter.class = classFilter;
  }

  const testWhere: Record<string, unknown> = {
    lifecycle: 'active',
    topic: {
      lifecycle: 'active',
      chapter: {
        lifecycle: 'active',
        ...(filters.chapter ? { name: { equals: filters.chapter, mode: 'insensitive' } } : {}),
        subject: Object.keys(subjectFilter).length > 0 ? subjectFilter : undefined,
      },
    },
  };
  // Only pass difficulty if it's a valid DifficultyLevel enum value
  const validDifficulties = ['easy', 'medium', 'hard'];
  if (filters.difficulty && validDifficulties.includes(filters.difficulty)) {
    testWhere.difficulty = filters.difficulty;
  }

  const rows = await prisma.generatedQuestion.findMany({
    where: { test: testWhere },
    include: {
      test: {
        select: {
          difficulty: true,
          topicId: true,
          topic: {
            select: {
              id: true,
              name: true,
              chapter: { select: { name: true, subject: { select: { name: true, class: { select: { grade: true, board: { select: { slug: true } } } } } } } },
            },
          },
        },
      },
    },
    take,
  });

  if (rows.length === 0) {
    try {
      logger.debug('syncFromGeneratedQuestions.rows_empty', { filters, take });
    } catch {}
    return [];
  }

  // Upsert into Question table so AttemptQuestion FK constraints work
  const ids: string[] = [];
  for (const gq of rows) {
    const ch = gq.test.topic?.chapter;
    const sub = ch?.subject;
    const cls = sub?.class;
    const correctAnswer = typeof gq.answer === 'string' ? gq.answer : JSON.stringify(gq.answer);

    const topicId = gq.test.topicId || gq.test.topic?.id || null;
    await prisma.question.upsert({
      where: { id: gq.id },
      update: { topicId },
      create: {
        id: gq.id,
        type: gq.type || 'mcq',
        prompt: gq.question,
        choices: gq.options ?? undefined,
        correctAnswer,
        difficulty: gq.test.difficulty ?? null,
        subject: sub?.name ?? null,
        chapter: ch?.name ?? null,
        grade: cls?.grade != null ? String(cls.grade) : null,
        board: cls?.board?.slug ?? null,
        topicId,
        source: 'generated',
      },
    });
    ids.push(gq.id);
  }

  return prisma.question.findMany({
    // quarantined questions excluded -- do not remove this filter
    where: { id: { in: ids }, status: 'ACTIVE' },
    take,
  });
}

/**
 * AI-assisted generation (stub):
 * Uses `lib/aiContext.ts` to request structured questions for the given filters.
 * In production, add validation and de-duplication before persisting.
 */
export async function generateQuestionsAI(filters: QuestionFilters, count: number): Promise<Question[]> {
  const ai = createAIClient();
  const prompt = `Generate ${count} ${filters.type ?? 'mixed'} questions for subject ${filters.subject ?? 'General'} grade ${filters.grade ?? '-'} board ${filters.board ?? '-'}. Return JSON array with fields: type, prompt, choices (for mcq), correctAnswer, difficulty.`;
  const result = await ai.complete({ prompt, maxTokens: 800 });
  let items: any[] = [];
  try {
    const text = String(result?.text ?? '').trim();
    items = JSON.parse(text);
  } catch {
    items = [];
  }
  const created: Question[] = [];
  for (const it of items.slice(0, count)) {
    try {
      const q = await prisma.question.create({
        data: {
          subject: filters.subject ?? null,
          chapter: filters.chapter ?? null,
          grade: filters.grade ?? null,
          board: filters.board ?? null,
          topicId: filters.topicId ?? null,
          type: String(it.type ?? filters.type ?? 'mcq'),
          difficulty: String(it.difficulty ?? filters.difficulty ?? 'medium'),
          prompt: String(it.prompt ?? ''),
          choices: it.choices ?? null,
          correctAnswer: String(it.correctAnswer ?? ''),
          source: 'ai',
        } as any,
      });
      created.push(q);
    } catch {
      // Skip invalid item
    }
  }
  return created;
}

/**
 * Hook to select or generate questions ensuring minimum count.
 * Attempts bank first; falls back to AI generation.
 */
export async function ensureQuestions(filters: QuestionFilters, count: number, excludeIds?: Set<string>) {
  const bank = await selectQuestions(filters, count, excludeIds);
  if (bank.length >= count) return bank.slice(0, count);
  const needed = count - bank.length;
  const aiNew = await generateQuestionsAI(filters, needed);
  return [...bank, ...aiNew].slice(0, count);
}

// F-STU-020 AC-03: board-calibrated time-per-mark ratio.
// marks awarded per question type (curriculum standard)
const MARKS_PER_TYPE: Record<string, number> = {
  mcq: 1,
  short: 2,
  long_answer: 5,
  long: 5,
  essay: 5,
};

// seconds per mark per board -- CBSE: 1 mark = 1 min; ICSE gives 20% more time per mark
const BOARD_TIME_PER_MARK_SECONDS: Record<string, number> = {
  cbse: 60,
  icse: 72,
  state: 60,
};
const DEFAULT_TIME_PER_MARK_SECONDS = 60;

function timeForType(type: string, board?: string | null): number {
  const marks = MARKS_PER_TYPE[type.toLowerCase()] ?? 2;
  const boardKey = (board ?? '').toLowerCase().replace(/\s+/g, '');
  const secPerMark = BOARD_TIME_PER_MARK_SECONDS[boardKey] ?? DEFAULT_TIME_PER_MARK_SECONDS;
  return marks * secPerMark;
}

/**
 * Select questions with a 40 / 30 / 30 type mix (MCQ / short / long_answer).
 * Fractions are floored; any remainder goes to the short bucket.
 * Each bucket is fetched independently; remaining slots are backfilled from
 * whichever bucket has surplus questions so count is always honoured.
 * Returns questions and the computed time-limit for the whole test.
 *
 * Used exclusively for chapter practice tests (F-STU-020 AC-02/AC-03).
 *
 * @param studentId  When provided, questions seen in the last 90 days are excluded (AC-01).
 */
export async function selectQuestionsWithMix(
  filters: Omit<QuestionFilters, 'type'>,
  count: number,
  studentId?: string,
): Promise<{ questions: Question[]; timeLimitSeconds: number }> {
  // AC-01: fetch recently seen question IDs and prompts for 90-day exclusion + semantic dedup.
  const [excludeIds, usedPrompts] = await (
    studentId && filters.chapter && filters.subject
      ? Promise.all([
          getRecentlyUsedQuestionIds(studentId, filters.chapter, filters.subject),
          getRecentlyUsedQuestionPrompts(studentId, filters.chapter, filters.subject),
        ])
      : Promise.resolve([new Set<string>(), [] as string[]])
  );

  const mcqTarget = Math.floor(count * 0.4)
  const longTarget = Math.floor(count * 0.3)
  const shortTarget = count - mcqTarget - longTarget // absorbs remainder

  const [mcqPool, shortPool, longPool] = await Promise.all([
    selectQuestions({ ...filters, type: 'mcq' }, mcqTarget * 3, excludeIds),
    selectQuestions({ ...filters, type: 'short' }, shortTarget * 3, excludeIds),
    selectQuestions({ ...filters, type: 'long_answer' }, longTarget * 3, excludeIds),
  ])

  function pickN(pool: Question[], n: number, exclude: Set<string>): Question[] {
    // F-STU-020 AC-01: additionally filter Jaccard-similar questions if prompts are available.
    const available = pool.filter(
      (q) =>
        !exclude.has(q.id) &&
        (usedPrompts.length === 0 || !isSemanticallyDuplicate(q.prompt, usedPrompts)),
    )
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }

  // Start `used` with recently-seen question IDs so they are excluded
  // from selection. This ensures selectQuestionsWithMix honours the
  // 90-day exclusion window (F-STU-020 AC-01).
  const used = new Set<string>(excludeIds ? Array.from(excludeIds) : [])

  const mcqSelected = pickN(mcqPool, mcqTarget, used)
  mcqSelected.forEach((q) => used.add(q.id))

  const longSelected = pickN(longPool, longTarget, used)
  longSelected.forEach((q) => used.add(q.id))

  let shortSelected = pickN(shortPool, shortTarget, used)
  shortSelected.forEach((q) => used.add(q.id))

  // Backfill: if long_answer pool was sparse, pull extras from short pool.
  if (longSelected.length < longTarget) {
    const extra = pickN(shortPool, longTarget - longSelected.length, used)
    extra.forEach((q) => used.add(q.id))
    // Push extras into shortSelected so they appear in the set; caller sees combined list.
    shortSelected = [...shortSelected, ...extra]
  }

  // Final backfill: if still below count, draw from whichever pool has surplus.
  const all = [...mcqSelected, ...longSelected, ...shortSelected]
  if (all.length < count) {
    const surplus = pickN([...mcqPool, ...shortPool, ...longPool], count - all.length, used)
    surplus.forEach((q) => used.add(q.id))
    all.push(...surplus)
  }

  const questions = all.slice(0, count)
  // AC-03: board-calibrated seconds = marks_per_type * board_time_per_mark
  const timeLimitSeconds = questions.reduce(
    (acc, q) => acc + timeForType(q.type, filters.board),
    0,
  )

  return { questions, timeLimitSeconds }
}

const EXPLANATION_TIMEOUT_MS = 8_000

/**
 * Enrich wrong-answer graded results with LLM-generated explanations.
 * Uses a single batch prompt for all wrong answers without an existing explanation.
 * Returns the original array (with explanations filled in) unchanged on any error.
 * Never throws.
 */
export async function addLLMExplanations(
  graded: GradedResult[],
  studentId: string,
  attemptId: string,
): Promise<GradedResult[]> {
  const wrong = graded.filter((g) => !g.correct && !g.explanation && g.questionText)
  if (wrong.length === 0) return graded

  const lines = wrong.map(
    (g, i) =>
      `${i + 1}. questionId: "${g.questionId}"\n   Question: ${g.questionText}\n   Correct answer: ${g.correctAnswer ?? '(see working)'}`,
  )

  const prompt = [
    'For each wrong answer below, write a brief 1-2 sentence explanation that helps the student understand the correct answer.',
    'Return ONLY a valid JSON array: [{ "questionId": "...", "explanation": "..." }, ...]',
    'Tone: encouraging, forward-looking. Never say "you were wrong" or "you failed".',
    '',
    ...lines,
  ].join('\n')

  try {
    const result = await callTutorLLM(
      prompt,
      { callType: 'tutor:eval', studentId, sessionId: attemptId },
      EXPLANATION_TIMEOUT_MS,
    )
    const text = (result?.content ?? '').trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return graded
    const parsed: Array<{ questionId: string; explanation: string }> = JSON.parse(match[0])
    const byId = new Map(parsed.map((e) => [e.questionId, e.explanation]))
    return graded.map((g) => ({
      ...g,
      explanation: g.explanation ?? byId.get(g.questionId),
    }))
  } catch {
    return graded
  }
}

export type GradedResult = {
  attemptQuestionId: string;
  questionId: string;
  correct: boolean;
  partial: boolean;
  autoScore: number;
  awardedPoints: number;
  // MVP: Include question details for instant feedback
  questionText?: string;
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  type?: string;
  choices?: Array<{ key: string; label: string }>;
};

/**
 * Auto-grade a single answer given a question.
 * - mcq: exact match on choice key or normalized text
 * - numeric: exact or tolerance match (0.01 by default)
 * - short: normalized string equality; (LLM rubric can be added later)
 */
export function gradeSingle(question: Question, rawAnswer?: string, options?: { tolerance?: number; points?: number }) {
  const type = question.type.toLowerCase();
  const points = options?.points ?? 1;
  const tolerance = options?.tolerance ?? 0.01;
  const correctAnswer = question.correctAnswer ?? '';

  let correct = false;
  const partial = false;

  if (type === 'mcq') {
    const a = normalizeAnswer(rawAnswer);
    const b = normalizeAnswer(correctAnswer);
    correct = !!a && a === b;
  } else if (type === 'numeric') {
    const a = Number(String(rawAnswer ?? '').replace(/[^0-9.-]/g, ''));
    const b = Number(String(correctAnswer).replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      correct = Math.abs(a - b) <= tolerance;
    }
  } else {
    const a = normalizeAnswer(rawAnswer);
    const b = normalizeAnswer(correctAnswer);
    // For now, accept exact normalized match as correct; partial is false.
    correct = !!a && !!b && a === b;
  }

  const autoScore = correct ? points : 0;
  return { correct, partial, autoScore, awardedPoints: autoScore } as const;
}

export type SubmitPayload = {
  attemptId: string;
  answers: Array<{ questionId: string; answer: string; timeSpent?: number }>;
};

/**
 * Compute final score percent and write AttemptQuestion + Answer records.
 */
export async function applyGrading(attempt: TestResult, payload: SubmitPayload) {
  const attemptQuestions = await prisma.attemptQuestion.findMany({
    where: { testResultId: attempt.id },
    include: { question: true },
    orderBy: { order: 'asc' },
  });

  const byQuestionId = new Map<string, (typeof payload.answers)[number]>();
  for (const a of payload.answers) byQuestionId.set(a.questionId, a);

  let totalPoints = 0;
  let earnedPoints = 0;
  const graded: GradedResult[] = [];

  for (const aq of attemptQuestions) {
    const ans = byQuestionId.get(aq.questionId);
    totalPoints += 1;
    const g = gradeSingle(aq.question, ans?.answer);
    earnedPoints += g.awardedPoints;
    
    // Parse choices for MCQ questions
    let parsedChoices: Array<{ key: string; label: string }> | undefined;
    if (aq.question.type?.toLowerCase() === 'mcq' && aq.question.choices) {
      try {
        const raw = typeof aq.question.choices === 'string' 
          ? JSON.parse(aq.question.choices) 
          : aq.question.choices;
        if (Array.isArray(raw)) {
          parsedChoices = raw.map((c: any) => ({
            key: String(c.key ?? c.id ?? ''),
            label: String(c.label ?? c.text ?? c.value ?? ''),
          }));
        }
      } catch {
        // Skip invalid choices
      }
    }
    
    graded.push({
      attemptQuestionId: aq.id,
      questionId: aq.questionId,
      correct: g.correct,
      partial: g.partial,
      autoScore: g.autoScore,
      awardedPoints: g.awardedPoints,
      // MVP: Include question details for instant feedback
      questionText: aq.question.prompt ?? undefined,
      userAnswer: ans?.answer ?? undefined,
      correctAnswer: aq.question.correctAnswer ?? undefined,
      explanation: (aq.question as any).explanation ?? undefined,
      type: aq.question.type?.toLowerCase() as 'mcq' | 'short_answer' | 'numeric' | undefined,
      choices: parsedChoices,
    });

    await prisma.answer.upsert({
      where: { attemptQuestionId: aq.id },
      update: {
        rawAnswer: ans?.answer ?? null,
        normalizedAnswer: normalizeAnswer(ans?.answer),
        autoScore: g.autoScore,
      },
      create: {
        attemptQuestionId: aq.id,
        rawAnswer: ans?.answer ?? null,
        normalizedAnswer: normalizeAnswer(ans?.answer),
        autoScore: g.autoScore,
      },
    });

    await prisma.attemptQuestion.update({
      where: { id: aq.id },
      data: {
        timeSpent: ans?.timeSpent ?? aq.timeSpent ?? null,
        result: g.correct ? 'correct' : g.partial ? 'partial' : 'wrong',
        awardedPoints: g.awardedPoints,
      },
    });
  }

  const scorePercent = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  await prisma.testResult.update({
    where: { id: attempt.id },
    data: {
      score: scorePercent,
      finishedAt: new Date(),
      rawResult: {
        totalPoints,
        earnedPoints,
        scorePercent,
        graded,
      },
    },
  });

  return { totalPoints, earnedPoints, scorePercent, graded };
}

/**
 * Update StudentTopicMastery records after a test submission.
 *
 * Resolves the canonical TopicDef.id via TestResult → GeneratedTest.topicId
 * so mastery records use the same UUID the engine's P4/P5 rules query.
 * For quick-practice attempts (no GeneratedTest), falls back to resolving
 * each Question's subject+chapter to a TopicDef via the curriculum hierarchy.
 *
 * Each topic update is wrapped in a prisma.$transaction to ensure atomic
 * read-modify-write.  Resolves AttentionFlag when accuracy reaches >= 0.6.
 */
export async function updateTopicMastery(studentId: string, attemptId: string): Promise<void> {
  const attemptQuestions = await prisma.attemptQuestion.findMany({
    where: { testResultId: attemptId },
    include: { question: true, answer: true },
  });

  if (!attemptQuestions.length) return;

  // ── Resolve canonical TopicDef.id from TestResult → GeneratedTest ─────────
  // GeneratedTest.topicId is the authoritative curriculum reference.
  // For quick-practice attempts (testId = 'quick-practice'), there is no
  // GeneratedTest -- fall back to resolving via Question subject+chapter.
  const testResult = await prisma.testResult.findUnique({
    where: { id: attemptId },
    select: { testId: true },
  });

  let canonicalTopicId: string | null = null;
  let topicSubject: string | null = null;
  let topicChapter: string | null = null;

  if (testResult?.testId) {
    const gt = await prisma.generatedTest.findUnique({
      where: { id: testResult.testId },
      select: {
        topicId: true,
        topic: {
          select: {
            chapter: {
              select: {
                name: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (gt) {
      canonicalTopicId = gt.topicId;
      topicSubject = gt.topic.chapter.subject.name;
      topicChapter = gt.topic.chapter.name;
    }
  }

  // ── Build per-topic stats keyed by canonical TopicDef.id ──────────────────
  // When canonical topicId is known (GeneratedTest path), all questions in the
  // attempt belong to that single topic -- aggregate under one key.
  // When unknown (quick-practice), group by subject+chapter and resolve each
  // group to a TopicDef.id via the curriculum hierarchy.
  const groups: Record<string, { correct: number; total: number; subject: string; chapter: string }> = {};

  if (canonicalTopicId) {
    // GeneratedTest path -- single canonical topic for all questions.
    const subject = topicSubject || attemptQuestions[0]?.question.subject || 'unknown';
    const chapter = topicChapter || attemptQuestions[0]?.question.chapter || 'unknown';
    groups[canonicalTopicId] = { correct: 0, total: 0, subject, chapter };
    for (const aq of attemptQuestions) {
      groups[canonicalTopicId].total++;
      if (aq.answer?.autoScore != null && aq.answer.autoScore > 0) {
        groups[canonicalTopicId].correct++;
      }
    }
  } else {
    // Quick-practice fallback: group by subject+chapter, resolve to TopicDef.id.
    const tempGroups: Record<string, { correct: number; total: number; subject: string; chapter: string }> = {};
    for (const aq of attemptQuestions) {
      const subject = aq.question.subject || 'unknown';
      const chapter = aq.question.chapter || 'unknown';
      const key = `${subject}::${chapter}`;
      if (!tempGroups[key]) tempGroups[key] = { correct: 0, total: 0, subject, chapter };
      tempGroups[key].total++;
      if (aq.answer?.autoScore != null && aq.answer.autoScore > 0) {
        tempGroups[key].correct++;
      }
    }

    for (const [, stats] of Object.entries(tempGroups)) {
      const topicDef = await prisma.topicDef.findFirst({
        where: {
          lifecycle: 'active',
          chapter: {
            lifecycle: 'active',
            name: { equals: stats.chapter, mode: 'insensitive' },
            subject: {
              lifecycle: 'active',
              name: { equals: stats.subject, mode: 'insensitive' },
            },
          },
        },
        orderBy: { order: 'asc' },
        select: { id: true },
      });

      if (topicDef) {
        // Merge if another question group resolved to the same TopicDef.
        if (groups[topicDef.id]) {
          groups[topicDef.id].correct += stats.correct;
          groups[topicDef.id].total += stats.total;
        } else {
          groups[topicDef.id] = stats;
        }
      } else {
        logger.warn('updateTopicMastery.skipOrphan', {
          studentId,
          attemptId,
          subject: stats.subject,
          chapter: stats.chapter,
          reason: 'No matching TopicDef found -- skipping mastery write',
        });
      }
    }
  }

  for (const [topicId, stats] of Object.entries(groups)) {
    // Defensive guard: never write composite "subject::chapter" keys to STM.
    if (topicId.includes('::')) {
      throw new Error(
        `Invalid mastery key format: topicId="${topicId}" contains "::". Expected canonical TopicDef UUID.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.studentTopicMastery.findUnique({
        where: { studentId_topicId: { studentId, topicId } },
      });

      const prevAttempted = existing?.questionsAttempted ?? 0;
      const prevAccuracy = existing?.accuracy ?? 0;
      const totalAttempted = prevAttempted + stats.total;
      // Weighted cumulative accuracy: use stats.correct (integer) directly
      // to avoid precision loss from an intermediate divide-then-multiply.
      const rollingAccuracy =
        totalAttempted > 0
          ? (prevAccuracy * prevAttempted + stats.correct) / totalAttempted
          : stats.total > 0 ? stats.correct / stats.total : 0;

      let masteryLevel: MasteryLevel = MasteryLevel.beginner;
      if (rollingAccuracy >= 0.9 && totalAttempted >= 20) masteryLevel = MasteryLevel.expert;
      else if (rollingAccuracy >= 0.75 && totalAttempted >= 10) masteryLevel = MasteryLevel.advanced;
      else if (rollingAccuracy >= 0.6 && totalAttempted >= 5) masteryLevel = MasteryLevel.intermediate;

      const firstSessionAccuracy = stats.total > 0 ? stats.correct / stats.total : 0;

      await tx.studentTopicMastery.upsert({
        where: { studentId_topicId: { studentId, topicId } },
        update: {
          accuracy: rollingAccuracy,
          questionsAttempted: totalAttempted,
          masteryLevel,
          lastAttemptedAt: new Date(),
        },
        create: {
          studentId,
          topicId,
          subject: stats.subject,
          chapter: stats.chapter,
          accuracy: firstSessionAccuracy,
          questionsAttempted: stats.total,
          masteryLevel,
          lastAttemptedAt: new Date(),
        },
      });

      // Bidirectional AttentionFlag sync -- aligned with engine P4 threshold (accuracy < 0.6).
      // Low accuracy: upsert flag as unresolved (creates if missing, re-opens if resolved).
      // High accuracy: resolve any open flag.  Both branches keep accuracy on the flag current.
      // HomeEngine P3 short-circuits on unresolved flags, so this must stay in-sync every session.
      const resolvedState = rollingAccuracy >= 0.6;
      if (rollingAccuracy < 0.6) {
        await tx.attentionFlag.upsert({
          where: { studentId_topicId: { studentId, topicId } },
          create: {
            studentId,
            topicId,
            subject: stats.subject,
            chapter: stats.chapter,
            reason: 'low_mastery',
            masteryLevel,
            accuracy: rollingAccuracy,
            resolved: false,
          },
          update: {
            resolved: false,
            accuracy: rollingAccuracy,
            masteryLevel,
          },
        });
      } else {
        await tx.attentionFlag.updateMany({
          where: { studentId, topicId, resolved: false },
          data: { resolved: true, accuracy: rollingAccuracy },
        });
      }

      logger.info('mastery.updated', { studentId, topicId, newAccuracy: rollingAccuracy });
      logger.info('attention.flag.sync', { studentId, topicId, rollingAccuracy, resolvedState });
    });
  }
}

/**
 * @deprecated Use `updateStudentTopicProgress` from `@/lib/learning/updateTopicProgress` instead.
 * This stub re-exports for backward compatibility during migration.
 */
export { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
