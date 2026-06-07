import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/syllabi
 * Returns an array of persisted syllabi ordered by createdAt desc.
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role ?? null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const rows = await prisma.syllabus.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    return NextResponse.json(rows);
  } catch (err) {
    logger.error('admin.syllabi.list_failed', { event: 'admin.syllabi.list_failed', error: String(err) });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
