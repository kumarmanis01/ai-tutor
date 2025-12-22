/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No streaming or progress tracking
 * - Suggestions are immutable except status
 */

import { getServerSessionForHandlers } from '@/lib/session'
import { requireAdmin } from '@/auth/adminGuard'
import { updateSuggestionStatus } from '@/insights/store'
import { prisma as getPrismaClient } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSessionForHandlers()
  try { requireAdmin(session) } catch { return new Response('Forbidden', { status: 403 }) }
  const db = getPrismaClient
  const id = params.id
  const updated = await updateSuggestionStatus(db, id, 'ACCEPTED', session.user?.id)
  if (!updated) return new Response('Not Found', { status: 404 })
  return new Response(JSON.stringify(updated), { status: 200 })
}
