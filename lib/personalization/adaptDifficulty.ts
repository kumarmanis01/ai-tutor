import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  calculateDifficultyAdjustment,
  DifficultyLevel,
  type StudentDifficultyContext,
} from './difficultyTuning';
import type { Grade } from '@/lib/ai/prompts/schemas';

/**
 * Map Prisma DifficultyLevel values (lowercase) to the engine's enum.
 */
const PRISMA_TO_ENGINE: Record<string, DifficultyLevel> = {
  easy: DifficultyLevel.EASY,
  medium: DifficultyLevel.MEDIUM,
  hard: DifficultyLevel.HARD,
};

const ENGINE_TO_PRISMA: Record<string, string> = {
  [DifficultyLevel.EASY]: 'easy',
  [DifficultyLevel.MEDIUM]: 'medium',
  [DifficultyLevel.HARD]: 'hard',
  [DifficultyLevel.EXAM]: 'hard', // clamp EXAM → hard since Prisma has no 'exam'
};

interface GradingResult {
  totalPoints: number;
  earnedPoints: number;
  scorePercent: number;
  graded: Array<{ correct: boolean; questionId: string }>;
}

interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
}

export interface DifficultyFeedback {
  changed: boolean;
  newDifficulty: string;
  humanReason: string;
  direction: 'up' | 'down' | 'same';
}

/**
 * Called after test grading to adjust the student's preferred difficulty
 * using the deterministic difficulty tuning engine.
 * Returns feedback for the UI to display.
 */
export async function adjustDifficultyAfterTest(
  userId: string,
  attempt: TestAttempt,
  result: GradingResult,
): Promise<DifficultyFeedback | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { grade: true, subjects: true },
  });
  if (!user?.grade) return null;

  const gradeNum = parseInt(String(user.grade), 10);
  if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) return null;

  // Get the subject from the test questions
  const aq = await prisma.attemptQuestion.findFirst({
    where: { testResultId: attempt.id },
    include: { question: { select: { subject: true, difficulty: true } } },
  });
  const subject = aq?.question?.subject ?? 'general';
  const currentPrismaDifficulty = aq?.question?.difficulty ?? 'medium';

  // Look up existing preference
  const pref = await prisma.studentContentPreference.findFirst({
    where: { studentId: userId, subject },
  });

  const currentDifficulty =
    PRISMA_TO_ENGINE[pref?.difficulty ?? currentPrismaDifficulty] ?? DifficultyLevel.MEDIUM;

  // Compute average time per question from AttemptQuestions
  const allAqs = await prisma.attemptQuestion.findMany({
    where: { testResultId: attempt.id },
    select: { timeSpent: true },
  });
  const timesWithValues = allAqs.filter((a) => a.timeSpent != null);
  const avgTime =
    timesWithValues.length > 0
      ? timesWithValues.reduce((sum, a) => sum + (a.timeSpent ?? 0), 0) / timesWithValues.length
      : 30; // default 30s if no time data

  const context: StudentDifficultyContext = {
    grade: gradeNum as Grade,
    currentDifficulty,
    subject,
    metrics: {
      accuracy: result.scorePercent,
      avgTimePerQuestion: avgTime,
      retryCount: 0,
      hintsUsed: 0,
      aiConfidenceScore: 0.8,
      questionsAttempted: result.totalPoints,
    },
  };

  const adjustment = calculateDifficultyAdjustment(context);

  logger.info('difficultyAdjustment', {
    userId,
    attemptId: attempt.id,
    subject,
    changed: adjustment.changed,
    direction: adjustment.direction,
    newDifficulty: adjustment.newDifficulty,
    reasonCode: adjustment.reasonCode,
    humanReason: adjustment.humanReason,
  });

  const directionLabel = adjustment.direction > 0 ? 'up' : adjustment.direction < 0 ? 'down' : 'same';
  const newPrismaDifficulty = ENGINE_TO_PRISMA[adjustment.newDifficulty] ?? 'medium';

  if (!adjustment.changed) {
    return {
      changed: false,
      newDifficulty: newPrismaDifficulty,
      humanReason: adjustment.humanReason,
      direction: directionLabel as 'up' | 'down' | 'same',
    };
  }

  if (pref) {
    await prisma.studentContentPreference.update({
      where: { id: pref.id },
      data: { difficulty: newPrismaDifficulty as any },
    });
  } else {
    await prisma.studentContentPreference.create({
      data: {
        studentId: userId,
        subject,
        difficulty: newPrismaDifficulty as any,
        language: 'en' as any,
      },
    });
  }

  return {
    changed: true,
    newDifficulty: newPrismaDifficulty,
    humanReason: adjustment.humanReason,
    direction: directionLabel as 'up' | 'down' | 'same',
  };
}
