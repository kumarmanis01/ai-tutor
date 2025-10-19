import { NextResponse } from 'next/server';

export async function GET() {
  // Dummy leaderboard data
  const leaderboard = [
    { userId: '1', username: 'Alice', score: 120 },
    { userId: '2', username: 'Bob', score: 100 },
    { userId: '3', username: 'Charlie', score: 80 },
  ];

  return NextResponse.json({ leaderboard });
}
