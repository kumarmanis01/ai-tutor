import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ items: [] });
  const profile = await prisma.studentLearningProfile.findUnique({ where: { studentId: session.user.id } });
  const results = await prisma.testResult.findMany({ where: { studentId: session.user.id }, take: 20, orderBy: { createdAt: 'desc' } });
  const items = (results || []).slice(0, 4).map((r) => ({
    id: r.id,
    type: 'practice',
    subject: 'General',
    title: `Practice based on recent test ${r.testId}`,
    reasoning: 'Recent performance suggests targeted practice',
    priority: 80,
  }));
  return NextResponse.json({ items, profile: profile ?? null });
}
