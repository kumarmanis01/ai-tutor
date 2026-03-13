import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSessionForHandlers } from '@/lib/session'
import { logger } from '@/lib/logger'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { checkFreeTierCap, incrementFreeTierUsage } from '@/lib/freemium'
import { isAiTutorEnabledForStudent, isAiTutorGloballyEnabled } from '@/lib/features/aiTutor'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  conceptId: z.string().min(1),
  subjectId: z.string().min(1),
})

export async function POST(req: Request) {
  const start = Date.now()
  let res: Response

  try {
    const session = await getServerSessionForHandlers()
    const userId = (session as any)?.user?.id as string | undefined

    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized', code: 'LOGIN_REQUIRED' }, { status: 401 })
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start)
      return res
    }

    // Global + per-student feature flag check
    if (!isAiTutorGloballyEnabled() || !(await isAiTutorEnabledForStudent(userId))) {
      res = NextResponse.json({ error: 'AI Tutor is not enabled for your account.', code: 'FEATURE_DISABLED' }, { status: 403 })
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start)
      return res
    }

    const rawBody = await req.json().catch(() => null)
    const parseResult = bodySchema.safeParse(rawBody)
    if (!parseResult.success) {
      res = NextResponse.json({ error: 'Invalid request body', code: 'BAD_REQUEST' }, { status: 400 })
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start)
      return res
    }

    const { conceptId, subjectId } = parseResult.data

    // Free tier enforcement — never throws.
    const freeTierUsage = await checkFreeTierCap(userId)
    if (!freeTierUsage.allowed) {
      res = NextResponse.json(
        {
          error: 'Free tier session cap reached.',
          code: 'SESSION_CAP_REACHED',
          freeTierUsage,
        },
        { status: 402 },
      )
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start)
      return res
    }

    // TODO: wire real session persistence once the Tutor Session model is finalized.
    const sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `tutor_${Date.now().toString(36)}`

    // TODO: use Redis-backed resume detection via hasIncompleteTurn(sessionId) when available.
    const resumeContext = {
      hasIncompleteSession: false,
      lastStage: null as string | null,
    }

    // TODO: fetch real prerequisites from ConceptPrereqs once available.
    const prereqs: string[] = []
    void conceptId
    void subjectId

    // Only increment after "session creation" is considered successful.
    await incrementFreeTierUsage(userId)

    res = NextResponse.json({
      sessionId,
      resumeContext,
      prereqs,
      freeTierUsage,
    })
    logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const formatted = formatErrorForResponse(err)
    res = NextResponse.json({ error: formatted, code: 'INTERNAL_ERROR' }, { status: 500 })
    logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start)
    return res
  }
}

