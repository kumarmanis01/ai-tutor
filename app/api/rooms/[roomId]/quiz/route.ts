import { logApiUsage } from '@/utils/logApiUsage';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logApiUsage('/api/rooms/[roomId]/quiz', 'GET');
  // Dummy function
  return new Response('Dummy function called');
}
