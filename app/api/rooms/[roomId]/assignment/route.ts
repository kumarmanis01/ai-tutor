import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
export async function GET() {
  // Dummy function
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
