import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getStudentLearningSummary } from '@/lib/admin/studentLearningAnalytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const summary = await getStudentLearningSummary();
  return NextResponse.json(summary);
}
