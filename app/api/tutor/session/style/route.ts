/**
 * POST /api/tutor/session/style
 *
 * Sets a session-level explainStyle preference (simpler/harder/real_life_example/diagram)
 * that the tutor orchestrator will respect for subsequent turns when no per-turn
 * sentinel is provided. Optionally clearing the preference is supported by
 * sending null or an empty value.
 *
 * FILE OBJECTIVE:
 * - Allow the frontend to persist a session-level re-explain style preference.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/tutor-session-style.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created endpoint to set session explainStyle
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { updateTutorSession, getTutorSession } from '@/lib/redis/tutorSession'
import { logger } from '@/lib/logger'

const VALID = new Set(['simpler', 'harder', 'real_life_example', 'diagram'])

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const user = (session?.user as { id?: string } | null) ?? null
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: any = null
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    let explainStyle: string | null = null
    if (body?.explainStyle === null || body?.explainStyle === '') {
      explainStyle = null
    } else if (typeof body?.explainStyle === 'string') {
      if (!VALID.has(body.explainStyle)) return NextResponse.json({ error: 'Invalid explainStyle' }, { status: 400 })
      explainStyle = body.explainStyle
    } else {
      explainStyle = null
    }

    // Persist to Redis (best-effort). Redis helper never throws on failure.
    await updateTutorSession(sessionId, { explainStyle })

    const res = NextResponse.json({ ok: true })
    logger.logAPI(req, res, { className: 'TutorSessionStyleAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: 'Server error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'TutorSessionStyleAPI', methodName: 'POST', error: String(err) }, start)
    return res
  }
}

export default POST

export async function GET(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const user = (session?.user as { id?: string } | null) ?? null
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const sessionId = String(url.searchParams.get('sessionId') ?? '')
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const s = await getTutorSession(sessionId)
    const explainStyle = s && typeof (s as any).explainStyle === 'string' ? (s as any).explainStyle : null

    const res = NextResponse.json({ explainStyle })
    logger.logAPI(req, res, { className: 'TutorSessionStyleAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: 'Server error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'TutorSessionStyleAPI', methodName: 'GET', error: String(err) }, start)
    return res
  }
}
