/**
 * FILE OBJECTIVE:
 * - GET /api/student/weak-topics
 * - Returns up to 5 topics where mastery < 0.4, ordered by mastery asc.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for WeakTopicsCard dashboard widget
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getWeakTopicsWithNames } from '@/lib/learning/getWeakTopics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const topics = await getWeakTopicsWithNames(session.user.id);

  return NextResponse.json({
    topics: topics.map((t) => ({
      topicId: t.topicId,
      topicName: t.topicName,
      mastery: t.mastery,
    })),
  });
}
