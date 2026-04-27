/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

import { getServerSessionForHandlers } from '@/lib/session'
import { requireAdmin } from '@/auth/adminGuard'
import { listSuggestions } from '@/insights/store'
import { prisma as getPrismaClient } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers()
  try { requireAdmin(session) } catch { return new Response('Forbidden', { status: 403 }) }
  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId') || undefined
  const db = getPrismaClient
  const rows = await listSuggestions(db, { courseId })
  return new Response(JSON.stringify(rows), { status: 200 })
}
