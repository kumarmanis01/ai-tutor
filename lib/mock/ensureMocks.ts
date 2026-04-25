/**
 * FILE OBJECTIVE:
 * - Ensure a minimum number of unique full-syllabus MockExam records exist
 *   per subject / grade / board combination. Used for pre-launch seeding.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/mock/ensureMocks.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T10:00:00Z | copilot | created ensureMocks utility
 */

import { prisma } from '@/lib/prisma';
import { ensureQuestions } from '@/lib/tests';
import {
  MOCK_SECTION_DEFS,
  MOCK_TOTAL_MARKS,
  MOCK_DURATION_MIN,
} from '@/lib/mock/selectMockQuestions';
import { logger } from '@/lib/logger';

/**
 * Ensure at least `minPer` mock exams exist for each active SubjectDef's class (grade+board).
 *
 * Behaviour:
 * - Iterates active SubjectDefs that are marked `isAvailable`.
 * - Counts existing MockExam rows for the subjectId + grade + board.
 * - Generates and persists additional MockExam records until the minimum is reached,
 *   using the existing `selectMockQuestions` selection logic.
 * - Skips creation when the question bank is too sparse for the required sections.
 *
 * This function is intended to be run offline by an operator prior to launch.
 */
export async function ensureMinimumMocks(opts?: { minPer?: number; dryRun?: boolean }) {
  const minPer = opts?.minPer ?? 5;
  const dryRun = !!opts?.dryRun;
  const created: Array<{
    subjectId: string;
    subjectName: string;
    grade: number;
    board: string;
    examId: string;
  }> = [];

  // Fetch active subjects that are enabled by admin
  const subjects = await prisma.subjectDef.findMany({
    where: { lifecycle: 'active', isAvailable: true },
    include: { class: { include: { board: true } } },
  });

  for (const s of subjects) {
    const grade = s.class?.grade;
    const board = s.class?.board?.slug ?? null;
    if (!grade || !board) {
      logger.debug('ensureMocks.skip_missing_class_or_board', { subjectId: s.id, subject: s.name });
      continue;
    }

    const existingCount = await prisma.mockExam.count({
      where: { subjectId: s.id, grade, board: { equals: board, mode: 'insensitive' } },
    });

    let target = minPer - existingCount;
    if (target <= 0) continue;

    logger.info('ensureMocks.creating', {
      subjectId: s.id,
      subject: s.name,
      grade,
      board,
      need: target,
    });

    while (target > 0) {
      // Select or generate questions for each section (ensureQuestions falls back to AI generation)
      const sections = await Promise.all(
        MOCK_SECTION_DEFS.map(async (sectionDef) => {
          const questions = await ensureQuestions(
            { subject: s.name, grade: String(grade), board, type: sectionDef.type },
            sectionDef.count
          );
          return { sectionDef, questions };
        })
      );

      // Ensure we have at least one question per section; otherwise skip creation.
      const nonEmptySections = sections.filter((sec) => sec.questions && sec.questions.length > 0);
      if (nonEmptySections.length === 0) {
        logger.warn('ensureMocks.insufficient_questions', { subject: s.name, grade, board });
        break; // cannot create more mocks for this subject/grade/board
      }

      // Determine new version number (simple increment over existing count)
      const existingForVer = await prisma.mockExam.count({
        where: { subjectId: s.id, grade, board: { equals: board, mode: 'insensitive' } },
      });
      const ver = existingForVer + 1;
      const title = `${s.name} Full Mock -- Paper ${ver}`;

      if (dryRun) {
        // Simulate creation without writing to DB
        const simulatedId = `dryrun-${s.id}-${ver}-${Date.now()}`;
        created.push({ subjectId: s.id, subjectName: s.name, grade, board, examId: simulatedId });
        logger.info('ensureMocks.dryrun_created', {
          subject: s.name,
          grade,
          board,
          examId: simulatedId,
          title,
        });
      } else {
        try {
          const exam = await prisma.$transaction(async (tx) => {
            const mockExam = await tx.mockExam.create({
              data: {
                title,
                subjectId: s.id,
                grade,
                board,
                totalMarks: MOCK_TOTAL_MARKS,
                durationMin: MOCK_DURATION_MIN,
                version: ver,
                status: 'active',
              },
            });

            for (const { sectionDef, questions } of sections) {
              if (!questions || questions.length === 0) continue;
              const section = await tx.mockExamSection.create({
                data: {
                  mockExamId: mockExam.id,
                  title: sectionDef.title,
                  order: ['Section A', 'Section B', 'Section C'].indexOf(sectionDef.title) + 1,
                  totalMarks: sectionDef.marksPerQ * questions.length,
                  instructions: sectionDef.instructions,
                },
              });

              await tx.mockExamQuestion.createMany({
                data: questions.map((q, idx) => ({
                  sectionId: section.id,
                  questionId: q.id,
                  marks: sectionDef.marksPerQ,
                  order: idx + 1,
                })),
              });
            }

            return mockExam;
          });
          created.push({ subjectId: s.id, subjectName: s.name, grade, board, examId: exam.id });
          logger.info('ensureMocks.created', { subject: s.name, grade, board, examId: exam.id });
        } catch (err) {
          logger.error('ensureMocks.create_failed', {
            subject: s.name,
            grade,
            board,
            error: String(err),
          });
          break; // abort further attempts for this subject to avoid repeated failures
        }
      }

      target -= 1;
    }
  }

  return { created, minPer };
}

export default ensureMinimumMocks;
