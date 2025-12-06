import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

/**
 * API Route: List all public study rooms.
 *
 * GET /api/rooms/list
 *
 * Returns:
 * [
 *   { id: string, name: string, subject: string }
 * ]
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Fetch all rooms that are not private
  const rooms = await prisma.room.findMany({
    where: { isPrivate: false },
    select: { id: true, name: true, subject: true },
  });
  logApiUsage('/api/rooms/list', 'GET');
  // Return the list of rooms as JSON
  return NextResponse.json(rooms);
}
