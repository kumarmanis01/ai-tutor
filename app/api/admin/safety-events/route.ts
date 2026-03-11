import { getServerSessionForHandlers } from '@/lib/session'
import { requireAdmin } from '@/auth/adminGuard'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { logger } from '@/lib/logger'
import { listUnresolvedSafetyEvents } from '@/services/admin/safetyEvents'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    try {
      requireAdmin(session)
    } catch {
      const res = new Response('Forbidden', { status: 403 })
      logger.logAPI(req, res, { className: 'AdminSafetyEventsAPI', methodName: 'GET' }, start)
      return res
    }

    const url = new URL(req.url)
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : undefined

    const events = await listUnresolvedSafetyEvents({ limit })

    const res = new Response(JSON.stringify({ events }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    logger.logAPI(req, res, { className: 'AdminSafetyEventsAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    const res = new Response(JSON.stringify({ error: formatErrorForResponse(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
    logger.logAPI(req, res, { className: 'AdminSafetyEventsAPI', methodName: 'GET' }, start)
    return res
  }
}

