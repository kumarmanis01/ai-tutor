import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { assertNoStringFilters } from '@/lib/guards/noStringFilters';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const { searchParams } = new URL(req.url);

  try {
    assertNoStringFilters(req);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  const subjectId = searchParams.get('subjectId') || undefined;
  const classId = searchParams.get('classId') || undefined;
  const boardId = searchParams.get('boardId') || undefined;

  if (!session?.user?.id) return NextResponse.json({ items: [] });

  // Resolve filters
  let subjectNames: string[] | undefined;
  if (subjectId) {
    const subj = await prisma.subjectDef.findUnique({ where: { id: subjectId } });
    if (subj) subjectNames = [subj.name];
  } else if (classId) {
    const subs = await prisma.subjectDef.findMany({ where: { classId }, select: { name: true } });
    subjectNames = subs.map((s) => s.name);
  }

  let boardSlug: string | undefined;
  if (boardId) {
    const b = await prisma.board.findUnique({ where: { id: boardId } });
    if (b) boardSlug = b.slug;
  }

  const where: any = {};
  if (subjectNames && subjectNames.length) where.subject = { in: subjectNames };
  if (boardSlug) where.board = boardSlug;

  const questions = await prisma.question.findMany({
    where,
    select: { id: true, subject: true, prompt: true },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });
  const items = questions.map((q) => ({ id: q.id, title: q.prompt, subject: q.subject || 'General' }));
  return NextResponse.json({ items });
}
