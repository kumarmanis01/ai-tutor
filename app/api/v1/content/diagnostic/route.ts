/**
 * FILE OBJECTIVE:
 * - Serve the S1.3 quick onboarding diagnostic set (5 questions) with grade-aware composition.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/diagnostic/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created 5-question onboarding diagnostic endpoint with grade-band composition
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface DiagnosticQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string | null;
  subject: string | null;
  sourceGrade: number;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function parseOptions(choices: unknown): string[] {
  if (!choices) return [];
  if (Array.isArray(choices)) {
    return choices.map((item) => String(item));
  }
  return [];
}

async function pullQuestions(
  grade: number,
  board: string,
  subjectPool: string[],
  takeCount: number,
  excludedIds: string[]
): Promise<DiagnosticQuestion[]> {
  const candidateRows = await prisma.question.findMany({
    where: {
      status: 'ACTIVE',
      grade: String(grade),
      board,
      ...(subjectPool.length > 0 ? { subject: { in: subjectPool } } : {}),
      ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
    },
    take: 30,
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      subject: true,
      grade: true,
    },
  });

  const normalized = candidateRows
    .map((row) => ({
      id: row.id,
      prompt: row.prompt,
      options: parseOptions(row.choices).slice(0, 4),
      correctAnswer: row.correctAnswer,
      subject: row.subject,
      sourceGrade: Number(row.grade ?? grade),
    }))
    .filter((row) => row.options.length === 4);

  return shuffle(normalized).slice(0, takeCount);
}

export async function GET(req: Request) {
  const start = Date.now();

  try {
    const url = new URL(req.url);
    const gradeParam = url.searchParams.get('grade');
    const board = (url.searchParams.get('board') ?? '').trim();
    const selectedSubject = (url.searchParams.get('subject') ?? '').trim();

    const grade = Number(gradeParam);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
      const response = NextResponse.json({ error: 'invalid_grade' }, { status: 400 });
      logger.logAPI(req, response, { className: 'QuickDiagnosticAPI', methodName: 'GET' }, start);
      return response;
    }

    if (!board) {
      const response = NextResponse.json({ error: 'missing_board' }, { status: 400 });
      logger.logAPI(req, response, { className: 'QuickDiagnosticAPI', methodName: 'GET' }, start);
      return response;
    }

    const subjectPool =
      grade <= 8 ? ['Mathematics', 'Science'] : selectedSubject ? [selectedSubject] : ['Mathematics'];

    const lowerGrade = Math.max(1, grade - 1);
    const upperGrade = Math.min(12, grade + 1);

    const pickedLower = await pullQuestions(lowerGrade, board, subjectPool, 2, []);
    const pickedCurrent = await pullQuestions(
      grade,
      board,
      subjectPool,
      2,
      pickedLower.map((item) => item.id)
    );
    const pickedUpper = await pullQuestions(
      upperGrade,
      board,
      subjectPool,
      1,
      [...pickedLower, ...pickedCurrent].map((item) => item.id)
    );

    const assembled = [...pickedLower, ...pickedCurrent, ...pickedUpper];

    // Fallback fill for sparse banks.
    if (assembled.length < 5) {
      const filler = await pullQuestions(
        grade,
        board,
        subjectPool,
        5 - assembled.length,
        assembled.map((item) => item.id)
      );
      assembled.push(...filler);
    }

    const response = NextResponse.json({
      ok: true,
      questions: assembled.slice(0, 5),
    });

    logger.logAPI(req, response, { className: 'QuickDiagnosticAPI', methodName: 'GET' }, start);
    return response;
  } catch (error) {
    logger.error('quick.diagnostic.fetch_failed', { error: String(error) });
    const response = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, response, { className: 'QuickDiagnosticAPI', methodName: 'GET' }, start);
    return response;
  }
}
