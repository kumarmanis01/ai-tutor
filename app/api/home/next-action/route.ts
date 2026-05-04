/**
 * FILE OBJECTIVE:
 * - Return the single most important next learning action for the authenticated student.
 *   Used by SessionCompletionScreen to populate "Start next session" CTA (AC-05, F-STU-015).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/home/next-action.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-04 | claude | created for F-STU-015 AC-05 -- reuses getNextAction engine
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getNextAction } from '@/lib/homeEngine/getNextAction'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id as string | undefined
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'HomeNextActionAPI', methodName: 'GET' }, start)
      return res
    }

    const result = await getNextAction(userId)
    const action =
      result && typeof result === 'object' && 'action' in result
        ? (result as { action: unknown }).action
        : result

    const res = NextResponse.json({ action }, { status: 200 })
    logger.logAPI(req, res, { className: 'HomeNextActionAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('HomeNextActionAPI failed', {
      className: 'HomeNextActionAPI',
      methodName: 'GET',
      error: String(err),
    })
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'HomeNextActionAPI', methodName: 'GET' }, start)
    return res
  }
}
