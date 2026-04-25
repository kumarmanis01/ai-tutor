/**
 * GET /api/admin/concepts/[id]/history
 * F-ADM-002 AC-03: Audit history for concept IRT/prereq edits.
 *
 * Returns the most recent 50 ConceptHistory rows for a given concept,
 * ordered newest-first.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: conceptId } = await context.params;

  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, name: true },
  });
  if (!concept) {
    return NextResponse.json({ error: 'concept_not_found' }, { status: 404 });
  }

  const history = await prisma.conceptHistory.findMany({
    where: { conceptId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      adminId: true,
      reason: true,
      previousIrtB: true,
      newIrtB: true,
      previousPrereqIds: true,
      newPrereqIds: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    conceptId,
    conceptName: concept.name,
    history,
    total: history.length,
  });
}
