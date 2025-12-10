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

  // Use PracticeTest as upcoming items placeholder
  const upcoming = await prisma.practiceTest.findMany({
    where: {
      ...(subject ? { subject } : {}),
      ...(grade ? { grade } : {}),
    },
    select: { id: true, title: true, subject: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  const items = upcoming.map((t) => ({ id: t.id, title: t.title, subject: t.subject || 'General' }));
  return NextResponse.json({ items });
}
