import { getServerSessionForHandlers } from '@/lib/session'
import { requireAdmin } from '@/auth/adminGuard'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { logger } from '@/lib/logger'
import { listSafetyEvents } from '@/services/admin/safetyEvents'
import { z } from 'zod'

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
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      category: z.string().optional(),
      severity: z.string().optional(),
      studentId: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      resolved: z.enum(['true', 'false']).optional(),
    })
    const parsed = schema.parse(Object.fromEntries(url.searchParams.entries()))

    const { events, total } = await listSafetyEvents({
      page: parsed.page,
      limit: parsed.limit,
      category: parsed.category,
      severity: parsed.severity,
      studentId: parsed.studentId,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      resolved: parsed.resolved ? parsed.resolved === 'true' : undefined,
    })

    const totalPages = Math.max(1, Math.ceil(total / parsed.limit))

    const res = new Response(JSON.stringify({ events, total, page: parsed.page, totalPages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    logger.logAPI(req, res, { className: 'AdminSafetyEventsAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    const res = new Response(JSON.stringify({ error: formatErrorForResponse(err), code: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
    logger.logAPI(req, res, { className: 'AdminSafetyEventsAPI', methodName: 'GET' }, start)
    return res
  }
}

