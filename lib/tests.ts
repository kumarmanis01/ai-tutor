import { prisma } from '@/lib/prisma';
import type { Question, TestResult } from '@prisma/client';
// Type matches Prisma enum — defined inline to avoid build dependency on prisma generate
const MasteryLevel = { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced', expert: 'expert' } as const;
type MasteryLevel = (typeof MasteryLevel)[keyof typeof MasteryLevel];
import { createAIClient } from '@/lib/aiContext';
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
  difficulty?: string;
  type?: string;
};

/**
 * Selects questions from the bank using simple weighted filters.
 * Falls back to broad subject filters if narrow result is small.
 */
export async function selectQuestions(filters: QuestionFilters, count: number): Promise<Question[]> {
  const where = {
    ...(filters.subject ? { subject: filters.subject } : {}),
    ...(filters.grade ? { grade: filters.grade } : {}),
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.chapter ? { chapter: filters.chapter } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
  };

  let pool = await prisma.question.findMany({
    where,
    orderBy: [{ difficulty: 'asc' }, { updatedAt: 'desc' }],
    take: count * 3,
  });

  // Broaden if too few
  if (pool.length < count && filters.subject) {
    pool = await prisma.question.findMany({
      where: { subject: filters.subject },
      orderBy: [{ difficulty: 'asc' }, { updatedAt: 'desc' }],
      take: count * 3,
    });
  }

  // Simple sampling without replacement
  const selected: Question[] = [];
  const indices = new Set<number>();
  while (selected.length < Math.min(count, pool.length)) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      selected.push(pool[idx]);
    }
  }

  return selected;
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
export async function ensureQuestions(filters: QuestionFilters, count: number) {
  const bank = await selectQuestions(filters, count);
  if (bank.length >= count) return bank.slice(0, count);
  const needed = count - bank.length;
  const aiNew = await generateQuestionsAI(filters, needed);
  return [...bank, ...aiNew].slice(0, count);
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
 * Groups graded questions by subject+chapter and upserts mastery with rolling accuracy.
 */
export async function updateTopicMastery(studentId: string, attemptId: string): Promise<void> {
  const attemptQuestions = await prisma.attemptQuestion.findMany({
    where: { testResultId: attemptId },
    include: { question: true, answer: true },
  });

  if (!attemptQuestions.length) return;

  // Group results by subject + chapter
  const groups: Record<string, { correct: number; total: number; subject: string; chapter: string }> = {};
  for (const aq of attemptQuestions) {
    const subject = aq.question.subject || 'unknown';
    const chapter = aq.question.chapter || 'unknown';
    const key = `${subject}::${chapter}`;
    if (!groups[key]) groups[key] = { correct: 0, total: 0, subject, chapter };
    groups[key].total++;
    if (aq.answer?.autoScore != null && aq.answer.autoScore > 0) {
      groups[key].correct++;
    }
  }

  for (const [topicId, stats] of Object.entries(groups)) {
    const newAccuracy = stats.total > 0 ? stats.correct / stats.total : 0;

    const existing = await prisma.studentTopicMastery.findUnique({
      where: { studentId_topicId: { studentId, topicId } },
    });

    const prevAttempted = existing?.questionsAttempted ?? 0;
    const prevAccuracy = existing?.accuracy ?? 0;
    const totalAttempted = prevAttempted + stats.total;
    const rollingAccuracy = totalAttempted > 0
      ? ((prevAccuracy * prevAttempted) + (newAccuracy * stats.total)) / totalAttempted
      : newAccuracy;

    let masteryLevel: MasteryLevel = MasteryLevel.beginner;
    if (rollingAccuracy >= 0.9 && totalAttempted >= 20) masteryLevel = MasteryLevel.expert;
    else if (rollingAccuracy >= 0.75 && totalAttempted >= 10) masteryLevel = MasteryLevel.advanced;
    else if (rollingAccuracy >= 0.5 && totalAttempted >= 5) masteryLevel = MasteryLevel.intermediate;

    await prisma.studentTopicMastery.upsert({
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
        accuracy: newAccuracy,
        questionsAttempted: stats.total,
        masteryLevel,
        lastAttemptedAt: new Date(),
      },
    });

    logger.info('updateTopicMastery', { studentId, topicId, rollingAccuracy, totalAttempted, masteryLevel });
  }
}
