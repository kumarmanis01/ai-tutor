/**
 * FILE OBJECTIVE:
 * - API endpoint to create a 14-day trial record for prospective users.
 * - Validates input, prevents duplicate active trials for the same phone, and
 *   emits a `trial_start` analytics event.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/trial.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | created trial signup API route
 * - 2026-04-15T12:00:00Z | copilot | rename unused GET param to _req to satisfy lint
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const TrialSchema = z.object({
  parentName: z.string().min(1).optional(),
  phone: z.string().min(6),
  childClass: z.string().optional(),
  schoolName: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
})

export async function POST(req: Request) {
  const start = Date.now()
  const url = new URL(req.url)
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = TrialSchema.parse(body)

    // Normalize phone (basic): strip non-digits
    const phone = String(parsed.phone).replace(/[^0-9+]/g, '')

    // Prevent duplicate active trial for same phone
    const now = new Date()
    const existing = await prisma.trial.findFirst({
      where: {
        phone,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
    })
    if (existing) {
      const res = NextResponse.json({ ok: true, message: 'trial already active', trialId: existing.id })
      logger.logAPI(req, res, { className: 'TrialAPI', methodName: 'POST', phone }, start)
      return res
    }

    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const trial = await prisma.trial.create({
      data: {
        phone,
        parentName: parsed.parentName ?? null,
        childClass: parsed.childClass ?? null,
        schoolName: parsed.schoolName ?? null,
        utmSource: parsed.utm_source ?? null,
        utmMedium: parsed.utm_medium ?? null,
        utmCampaign: parsed.utm_campaign ?? null,
        expiresAt,
      },
    })

    // Emit server-side analytics event for funnel tracking
    try {
      await prisma.analyticsEvent.create({
        data: {
          eventType: 'trial_start',
          userId: null,
          courseId: null,
          lessonIdx: null,
          metadata: {
            phone,
            parentName: parsed.parentName ?? null,
            childClass: parsed.childClass ?? null,
            utm_source: parsed.utm_source ?? null,
            utm_medium: parsed.utm_medium ?? null,
            utm_campaign: parsed.utm_campaign ?? null,
            sourceUrl: url.pathname,
          },
        },
      })
    } catch (ae) {
      // analytics failures should not block trial creation
      logger.warn('trial: analyticsEvent.create failed', { error: String(ae), phone })
    }

    const res = NextResponse.json({ ok: true, trialId: trial.id, expiresAt: trial.expiresAt }, { status: 201 })
    logger.logAPI(req, res, { className: 'TrialAPI', methodName: 'POST', trialId: trial.id }, start)
    return res
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.errors.map((e) => e.message).join(', ') : (err instanceof Error ? err.message : 'invalid request')
    const res = NextResponse.json({ error: msg }, { status: 400 })
    logger.logAPI(req, res, { className: 'TrialAPI', methodName: 'POST', error: msg }, start)
    return res
  }
}

export async function GET(_req: Request) {
  return NextResponse.json({ ok: true, message: 'Trial endpoint active' })
}
