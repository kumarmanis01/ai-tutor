import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  selectMockQuestions,
  MOCK_TOTAL_MARKS,
  MOCK_DURATION_MIN,
} from '@/lib/mock/selectMockQuestions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mock/generate
 * Body: { subjectName: string }
 *
 * Generates a new MockExam for the student's grade/board/subject from the
 * existing question bank.  Each call creates a new version (AC-06: up to 5+
 * unique mocks available per subject/grade).
 *
 * Returns: { examId: string, title: string }
 * Auth-guarded: 401 before any DB query.
 */
export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user as { id: string } | undefined;

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MockGenerateAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const { subjectName } = body ?? {};

  if (!subjectName || typeof subjectName !== 'string') {
    const res = NextResponse.json({ error: 'subjectName required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'MockGenerateAPI', methodName: 'POST' }, start);
    return res;
  }

  // Resolve student profile
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { grade: true, board: true },
  });

  const grade = profile?.grade ? Number(profile.grade) : null;
  const board = profile?.board ?? null;

  if (!grade || !board) {
    const res = NextResponse.json(
      { error: 'Student profile incomplete (grade/board required)' },
      { status: 422 }
    );
    logger.logAPI(req, res, { className: 'MockGenerateAPI', methodName: 'POST' }, start);
    return res;
  }

  // Resolve SubjectDef
  const subjectDef = await prisma.subjectDef.findFirst({
    where: {
      lifecycle: 'active',
      OR: [
        { name: { equals: subjectName, mode: 'insensitive' } },
        { slug: { equals: subjectName, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!subjectDef) {
    const res = NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'MockGenerateAPI', methodName: 'POST' }, start);
    return res;
  }

  // Count existing versions so we can number this one
  const existingCount = await prisma.mockExam.count({
    where: { subjectId: subjectDef.id, grade, board: { equals: board, mode: 'insensitive' } },
  });
  const version = existingCount + 1;
  const title = `${subjectDef.name} Full Mock -- Paper ${version}`;

  // Select questions (full-syllabus)
  const sections = await selectMockQuestions({
    subject: subjectDef.name,
    grade: String(grade),
    board,
  });

  // Persist in a transaction
  const exam = await prisma.$transaction(async (tx) => {
    const mockExam = await tx.mockExam.create({
      data: {
        title,
        subjectId: subjectDef.id,
        grade,
        board,
        totalMarks: MOCK_TOTAL_MARKS,
        durationMin: MOCK_DURATION_MIN,
        version,
        status: 'active',
      },
    });

    for (const { sectionDef, questions } of sections) {
      if (questions.length === 0) continue;
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

  logger.info('mock.generated', { studentId: user.id, examId: exam.id, version });

  const res = NextResponse.json({ examId: exam.id, title: exam.title });
  logger.logAPI(req, res, { className: 'MockGenerateAPI', methodName: 'POST' }, start);
  return res;
}
