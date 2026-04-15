/**
 * FILE OBJECTIVE:
 * - Worker job to enqueue or send WhatsApp trial nudges for day-2, day-5, day-12.
 * - Uses a provider adapter (mock) to send messages for Sprint A (non-blocking).
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/trialNudges.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | added trial nudge worker job (skeleton)
 */

import { prisma } from '@/lib/prisma'
import { sendTemplate } from '@/lib/whatsapp/provider'
import TRIAL_TEMPLATES from '@/lib/whatsapp/templates'
import { logger } from '@/lib/logger'

function utcDayRangeDaysAgo(daysAgo: number) {
  const now = new Date()
  const target = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  // Start of day (UTC)
  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function runTrialNudges() {
  logger.info('[trialNudges] job started')
  const offsets = [2, 5, 12]
  for (const d of offsets) {
    const { start, end } = utcDayRangeDaysAgo(d)
    const trials = await prisma.trial.findMany({
      where: {
        startAt: { gte: start, lt: end },
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    })
    logger.info('[trialNudges] found trials', { dayOffset: d, count: trials.length })

    for (const t of trials) {
      try {
        const templateKey = d === 2 ? TRIAL_TEMPLATES.DAY_2.key : d === 5 ? TRIAL_TEMPLATES.DAY_5.key : TRIAL_TEMPLATES.DAY_12.key
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
        const params = {
          count: 0,
          strong: '-',
          weak: '-',
          link: `${appUrl}/upgrade?trialId=${t.id}`,
        }
        await sendTemplate(t.phone, templateKey, params)
        logger.info('[trialNudges] sent', { trialId: t.id, phone: t.phone, dayOffset: d })
      } catch (e) {
        logger.warn('[trialNudges] send failed', { trialId: t.id, error: String(e) })
      }
    }
  }
  logger.info('[trialNudges] job completed')
}

export default runTrialNudges
