/**
 * FILE OBJECTIVE:
 * - GET: Retrieve any pending recovery nudge for the logged-in student
 * - POST: Mark recovery as responded to or dismissed
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created recovery nudge API endpoint for FRS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRecoveryNudge, markRecoveryResponded, dismissRecoveryNudge } from '@/lib/failureRecovery';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nudge = await getRecoveryNudge(session.user.id);
  return NextResponse.json({ nudge });
}

export async function POST(request: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, eventId } = body;
  const studentId = session.user.id;

  if (action === 'respond') {
    await markRecoveryResponded(studentId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'dismiss' && eventId) {
    await dismissRecoveryNudge(studentId, eventId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action must be "respond" or "dismiss"' }, { status: 400 });
}
