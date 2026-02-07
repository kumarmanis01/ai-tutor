export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';

// Single, consolidated handler for /api/notes/subjects
// Behavior:
// - If `?classId=` is provided, return active `subjectDef` rows for that class
// - Else, if there's a session user, return subjects derived from user's notes
//   with a question-bank fallback
// - Else, return all active `subjectDef` rows (lightweight)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');

    if (classId) {
      const subs = await prisma.subjectDef.findMany({
        where: { lifecycle: 'active', classId },
        include: { chapters: true },
        orderBy: { name: 'asc' },
      });
      const subjects = subs.map((s) => ({ id: s.id, name: s.name, meta: `${(s.chapters || []).length} chapters` }));
      return NextResponse.json({ subjects });
    }

    const session = await getServerSessionForHandlers();
    if (session?.user?.id) {
      // derive from user's notes
      const noteSubjects = await prisma.note.findMany({
        where: { studentId: session.user.id },
        select: { subject: true },
        distinct: ['subject'],
      });
      let subjects = noteSubjects
        .map((n) => n.subject || 'General')
        .filter((s, i, a) => a.indexOf(s) === i)
        .map((name) => ({ name, meta: '' }));

      // fallback to question subjects
      if (subjects.length === 0) {
        const questionSubjects = await prisma.question.findMany({
          select: { subject: true },
          distinct: ['subject'],
          take: 20,
          orderBy: { updatedAt: 'desc' },
        });
        subjects = questionSubjects
          .map((q) => q.subject || 'General')
          .filter((s, i, a) => a.indexOf(s) === i)
          .map((name) => ({ name, meta: '' }));
      }
      return NextResponse.json({ subjects });
    }

    // Default: return lightweight active subject defs
    const subs = await prisma.subjectDef.findMany({ where: { lifecycle: 'active' }, include: { chapters: true }, orderBy: { name: 'asc' } });
    const subjects = subs.map((s) => ({ id: s.id, name: s.name, meta: `${(s.chapters || []).length} chapters` }));
    return NextResponse.json({ subjects });
  } catch (err) {
    logger.error('/api/notes/subjects error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
