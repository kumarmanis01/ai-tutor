import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ items: [] });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const subjects = (user?.subjects || []) as string[];
  const board = user?.board || '';
  const grade = user?.grade || '';
  const language = user?.language || 'en';

  // Prefer catalog-backed recommendations; fallback to recent test-based suggestions
  const catalog = await prisma.contentCatalog.findMany({
    where: {
      active: true,
      board,
      grade,
      language,
      subject: subjects.length ? { in: subjects } : undefined,
    },
    take: 30,
    orderBy: { updatedAt: 'desc' },
  });

  let items = catalog.map((c) => ({
    id: c.contentId,
    type: c.type || 'article',
    subject: c.subject,
    title: c.title,
    reasoning: `Matched ${board} ${grade} ${language} ${c.subject}`,
    priority: 50,
  }));

  if (items.length === 0) {
    const results = await prisma.testResult.findMany({ where: { studentId: userId }, take: 10, orderBy: { createdAt: 'desc' } });
    items = (results || []).slice(0, 4).map((r) => ({
      id: r.id,
      type: 'practice',
      subject: 'General',
      title: `Practice based on recent test ${r.testId}`,
      reasoning: 'Recent performance suggests targeted practice',
      priority: 80,
    }));
  }

  return NextResponse.json({ items });
}
