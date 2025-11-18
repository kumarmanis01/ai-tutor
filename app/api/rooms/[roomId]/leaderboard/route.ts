import { NextResponse } from 'next/server';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/rooms/[roomId]/leaderboard', 'GET');

  // Dummy leaderboard data
  const leaderboard = [
    { userId: '1', username: 'Alice', score: 120 },
    { userId: '2', username: 'Bob', score: 100 },
    { userId: '3', username: 'Charlie', score: 80 },
  ];

  return NextResponse.json({ leaderboard });
}
