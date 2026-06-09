/**
 * FILE OBJECTIVE:
 * - GET /api/admin/concepts/meta: returns boards (with nested grades and available subjects)
 *   from the DB, plus the static supported-language list. Powers the admin concept seeder
 *   form so dropdowns are always in sync with actual curriculum data.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial: board/grade/subject cascade from DB + language list
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '@/lib/validators/concepts';

export interface SubjectOption {
  slug: string;
  name: string;
}

export interface GradeOption {
  grade: number;
  subjects: SubjectOption[];
}

export interface BoardOption {
  slug: string;
  name: string;
  grades: GradeOption[];
}

export interface ConceptsMeta {
  boards: BoardOption[];
  languages: Array<{ code: string; label: string }>;
}

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const boards = await prisma.board.findMany({
    where: { lifecycle: 'active' },
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      name: true,
      classes: {
        where: { lifecycle: 'active' },
        orderBy: { grade: 'asc' },
        select: {
          grade: true,
          subjects: {
            where: { lifecycle: 'active', isAvailable: true },
            orderBy: { name: 'asc' },
            select: { slug: true, name: true },
          },
        },
      },
    },
  });

  type RawBoard = typeof boards[number];
  type RawClass = RawBoard['classes'][number];
  type RawSubject = RawClass['subjects'][number];

  const result: ConceptsMeta = {
    boards: boards.map((b: RawBoard) => ({
      slug: b.slug,
      name: b.name,
      grades: b.classes
        .filter((c: RawClass) => c.subjects.length > 0)
        .map((c: RawClass) => ({
          grade: c.grade,
          subjects: c.subjects.map((s: RawSubject) => ({ slug: s.slug, name: s.name })),
        })),
    })),
    languages: SUPPORTED_LANGUAGES.map((code) => ({ code, label: LANGUAGE_LABELS[code] })),
  };

  return NextResponse.json(result);
}
