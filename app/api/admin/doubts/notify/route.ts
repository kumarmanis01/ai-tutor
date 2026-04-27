import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { processSingleDoubtEscalationNotification } from '@/worker/services/doubtEscalationNotifier'

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  try {
    if (body?.id) {
      const ok = await processSingleDoubtEscalationNotification(String(body.id))
      if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }

    // No id provided: trigger batch notifier (admin action)
    const processed = await (await import('@/worker/services/doubtEscalationNotifier')).processDoubtEscalationNotifications()
    return NextResponse.json({ ok: true, processed })
  } catch (e) {
    return NextResponse.json({ error: 'failed', message: String(e) }, { status: 500 })
  }
}
