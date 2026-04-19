/**
 * GET /api/student/topbar-stats
 *
 * Returns minimal data needed for the global Topbar:
 *   { streak: number, level: number, shieldAvailable: boolean }
 *
 * Reads denormalized fields from the User row -- no join, single query.
 * Auth: session required -- 401 if missing.
 * Cache: 60s (stale-while-revalidate is fine for these low-urgency stats).
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { isShieldAvailable } from '@/lib/student/streakShield';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [user, shieldAvail] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, level: true, cosmeticUnlocks: true, longestStreak: true },
    }),
    isShieldAvailable(userId),
  ]);

  return NextResponse.json({
    streak: user?.currentStreak ?? 0,
    longestStreak: user?.longestStreak ?? 0,
    level: user?.level ?? 1,
    shieldAvailable: shieldAvail,
    cosmeticUnlocks: user?.cosmeticUnlocks ?? [],
  });
}
