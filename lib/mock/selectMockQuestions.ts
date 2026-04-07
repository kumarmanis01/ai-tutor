import { prisma } from '@/lib/prisma';
import { selectQuestions } from '@/lib/tests';
import type { Question } from '@prisma/client';

/**
 * CBSE-style section definitions.
 * Section A: 20 MCQ × 1 mark  = 20 marks  (60 min)
 * Section B: 10 short × 3 marks = 30 marks (50 min)
 * Section C:  6 long × 5 marks = 30 marks  (70 min)
 * Total: 80 marks, 180 minutes
 */
export const MOCK_SECTION_DEFS = [
  {
    title: 'Section A',
    type: 'mcq' as const,
    marksPerQ: 1,
    count: 20,
    instructions: 'Each question carries 1 mark. Choose the correct option.',
  },
  {
    title: 'Section B',
    type: 'short' as const,
    marksPerQ: 3,
    count: 10,
    instructions: 'Each question carries 3 marks. Answer in 2-4 sentences.',
  },
  {
    title: 'Section C',
    type: 'long_answer' as const,
    marksPerQ: 5,
    count: 6,
    instructions: 'Each question carries 5 marks. Answer in detail.',
  },
] as const;

export const MOCK_TOTAL_MARKS = MOCK_SECTION_DEFS.reduce(
  (acc, s) => acc + s.marksPerQ * s.count,
  0,
); // 80

export const MOCK_DURATION_MIN = 180; // 3 hours standard board exam

export interface SectionWithQuestions {
  sectionDef: (typeof MOCK_SECTION_DEFS)[number];
  questions: Question[];
}

/**
 * Select full-syllabus questions for a mock exam.
 * Uses the existing question bank filtered by subject/grade/board.
 * Falls back gracefully when a type bucket has fewer questions than required.
 *
 * Returns sections with their questions, and the actual total marks
 * (may be < MOCK_TOTAL_MARKS if the question bank is sparse).
 */
export async function selectMockQuestions(params: {
  subject: string;
  grade: string;
  board: string;
}): Promise<SectionWithQuestions[]> {
  const { subject, grade, board } = params;
  const baseFilters = { subject, grade, board };

  const sections = await Promise.all(
    MOCK_SECTION_DEFS.map(async (sectionDef) => {
      const questions = await selectQuestions(
        { ...baseFilters, type: sectionDef.type },
        sectionDef.count,
      );
      return { sectionDef, questions };
    }),
  );

  return sections;
}

/**
 * Count how many unique question IDs are available for the student's profile.
 * Used to validate whether enough questions exist before generating a mock.
 */
export async function countAvailableQuestions(params: {
  subject: string;
  grade: string;
  board: string;
}): Promise<number> {
  return prisma.question.count({
    where: {
      status: 'ACTIVE',
      subject: { equals: params.subject, mode: 'insensitive' },
      grade: params.grade,
      board: { equals: params.board, mode: 'insensitive' },
    },
  });
}

/**
 * Compute section-wise scores from a set of section attempts.
 * Returns { sectionId, sectionTitle, scorePercent, marksEarned, totalMarks }.
 */
export function computeSectionScores(
  sections: Array<{ id: string; title: string; totalMarks: number }>,
  sectionAttempts: Array<{
    sectionId: string;
    scorePercent: number | null;
    answers: unknown;
  }>,
): Array<{
  sectionId: string;
  title: string;
  scorePercent: number;
  marksEarned: number;
  totalMarks: number;
}> {
  return sections.map((sec) => {
    const attempt = sectionAttempts.find((a) => a.sectionId === sec.id);
    const scorePercent = attempt?.scorePercent ?? 0;
    return {
      sectionId: sec.id,
      title: sec.title,
      scorePercent,
      marksEarned: Math.round((scorePercent / 100) * sec.totalMarks),
      totalMarks: sec.totalMarks,
    };
  });
}
