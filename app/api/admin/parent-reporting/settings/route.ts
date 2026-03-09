import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getReportsPaused, setReportsPaused } from '@/lib/admin/parentReportMonitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reportsPaused = await getReportsPaused();
  return NextResponse.json({ reportsPaused });
}

export async function PATCH(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { reportsPaused?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const reportsPaused = body.reportsPaused;
  if (typeof reportsPaused !== 'boolean') {
    return NextResponse.json({ error: 'reportsPaused must be a boolean' }, { status: 400 });
  }

  await setReportsPaused(reportsPaused);
  return NextResponse.json({ reportsPaused });
}
