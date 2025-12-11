import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : undefined;
  const event = typeof body.event === 'string' ? body.event : undefined; // 'shown'|'clicked'|'completed'
  if (!id || !event) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  // For now, log only; later persist to ContentRecommendation
  return NextResponse.json({ ok: true });
}
