import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') || undefined;
  const grade = searchParams.get('grade') || undefined;
  // board parameter not used currently; omit to avoid lint warning
  if (!session?.user?.id) {
    res = NextResponse.json({ items: [] });
    logger.logAPI(req, res, { className: 'TestsUpcomingAPI', methodName: 'GET' }, start);
    return res;
  }

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
  res = NextResponse.json({ items });
  logger.logAPI(req, res, { className: 'TestsUpcomingAPI', methodName: 'GET' }, start);
  return res;
}
