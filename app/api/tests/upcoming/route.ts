import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { assertNoStringFilters } from '@/lib/guards/noStringFilters';

export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const { searchParams } = new URL(req.url);

  try {
    assertNoStringFilters(req);
  } catch (e) {
    res = NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    logger.logAPI(req, res, { className: 'TestsUpcomingAPI', methodName: 'GET' }, start);
    return res;
  }

  const subjectId = searchParams.get('subjectId') || undefined;
  const classId = searchParams.get('classId') || undefined;

  if (!session?.user?.id) {
    res = NextResponse.json({ items: [] });
    logger.logAPI(req, res, { className: 'TestsUpcomingAPI', methodName: 'GET' }, start);
    return res;
  }

  // Resolve subject/class IDs to subject names for filtering stored string fields
  let subjectNames: string[] | undefined;
  if (subjectId) {
    const subj = await prisma.subjectDef.findUnique({ where: { id: subjectId } });
    if (!subj) {
      res = NextResponse.json({ items: [] });
      logger.logAPI(req, res, { className: 'TestsUpcomingAPI', methodName: 'GET' }, start);
      return res;
    }
    subjectNames = [subj.name];
  } else if (classId) {
    const subs = await prisma.subjectDef.findMany({ where: { classId }, select: { name: true } });
    subjectNames = subs.map((s) => s.name);
  }

  // Use PracticeTest as upcoming items placeholder
  const where: any = {};
  if (subjectNames && subjectNames.length > 0) where.subject = { in: subjectNames };

  const upcoming = await prisma.practiceTest.findMany({
    where,
    select: { id: true, title: true, subject: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  const items = upcoming.map((t) => ({ id: t.id, title: t.title, subject: t.subject || 'General' }));
  res = NextResponse.json({ items });
  logger.logAPI(req, res, { className: 'TestsUpcomingAPI', methodName: 'GET' }, start);
  return res;
}
