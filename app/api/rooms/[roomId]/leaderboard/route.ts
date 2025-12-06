import { NextResponse } from 'next/server';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logApiUsage('/api/rooms/[roomId]/leaderboard', 'GET');

  // Dummy leaderboard data
  const leaderboard = [
    { userId: '1', username: 'Alice', score: 120 },
    { userId: '2', username: 'Bob', score: 100 },
    { userId: '3', username: 'Charlie', score: 80 },
  ];

  return NextResponse.json({ leaderboard });
}
