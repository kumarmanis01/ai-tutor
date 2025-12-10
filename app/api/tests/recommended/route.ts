import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') || undefined;
  const grade = searchParams.get('grade') || undefined;
  const board = searchParams.get('board') || undefined;
  if (!session?.user?.id) return NextResponse.json({ items: [] });

  const questions = await prisma.question.findMany({
    where: {
      ...(subject ? { subject } : {}),
      ...(grade ? { grade } : {}),
      ...(board ? { board } : {}),
    },
    select: { id: true, subject: true, prompt: true },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });
  const items = questions.map((q) => ({ id: q.id, title: q.prompt, subject: q.subject || 'General' }));
  return NextResponse.json({ items });
}
