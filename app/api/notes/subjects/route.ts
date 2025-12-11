import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ subjects: [] });
  // Derive subjects from user's notes or question bank fallback
  const noteSubjects = await prisma.note.findMany({
    where: { studentId: session.user.id },
    select: { subject: true },
    distinct: ['subject'],
  });
  let subjects = (noteSubjects
    .map((n) => n.subject || 'General')
    .filter((s, i, a) => a.indexOf(s) === i)
    .map((name) => ({ name, meta: '' })));

  // Fallback to question bank subjects if no notes yet
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
