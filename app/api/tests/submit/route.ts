import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { applyGrading, SubmitPayload } from '@/lib/tests';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tests/submit
 * Body: { attemptId: string, answers: [{ questionId, answer, timeSpent? }] }
 */
export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = (await req.json().catch(() => null)) as SubmitPayload | null;
  if (!payload?.attemptId || !Array.isArray(payload.answers)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const attempt = await prisma.testResult.findFirst({ where: { id: payload.attemptId, studentId: user.id } });
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  const result = await applyGrading(attempt, payload);
  return NextResponse.json({ attemptId: attempt.id, ...result });
}
