/**
 * FILE OBJECTIVE:
 * - Scheduled job to send WhatsApp trial nudges at day-2, day-5, and day-12.
 * - Uses sendWhatsAppTemplate() with Meta-approved template builders.
 * - Trial phone number is used as the WhatsApp target (pre-onboarding contact point).
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/trialNudges.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | added trial nudge worker job (skeleton)
 * - 2026-04-21T00:00:00Z | claude | replace mock provider with real sendWhatsAppTemplate + builders
 */

import { prisma } from '@/lib/prisma'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/sender'
import { buildTrialDay2Template } from '@/lib/whatsapp/templates'
import TRIAL_TEMPLATES from '@/lib/whatsapp/templates'
import { logger } from '@/lib/logger'

function utcDayRangeDaysAgo(daysAgo: number) {
  const now = new Date()
  const target = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export async function runTrialNudges() {
  logger.info('[trialNudges] job started')

  const appUrl = (
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    ''
  ).replace(/\/$/, '')

  if (!appUrl) {
    logger.warn('[trialNudges] no base URL configured (set NEXTAUTH_URL) -- skipping')
    return
  }

  const offsets = [2, 5, 12] as const

  for (const d of offsets) {
    const { start, end } = utcDayRangeDaysAgo(d)
    const trials = await prisma.trial.findMany({
      where: {
        startAt: { gte: start, lt: end },
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: { id: true, phone: true, parentName: true, userId: true },
    })
    logger.info('[trialNudges] found trials', { dayOffset: d, count: trials.length })

    for (const t of trials) {
      try {
        const parentName = t.parentName ?? 'Parent'
        const upgradeUrl = `${appUrl}/upgrade?trialId=${t.id}`
        const practiceUrl = `${appUrl}/dashboard`

        // Resolve student name from linked user when available
        let studentName = 'your child'
        if (t.userId) {
          const user = await prisma.user.findUnique({ where: { id: t.userId }, select: { name: true } })
          if (user?.name) studentName = user.name
        }

        let template
        if (d === 2) {
          template = buildTrialDay2Template(parentName, studentName, 0, practiceUrl)
        } else if (d === 5) {
          template = {
            name: TRIAL_TEMPLATES.DAY_5.templateName,
            language: TRIAL_TEMPLATES.DAY_5.language,
            components: [{
              type: 'body' as const,
              parameters: [
                { type: 'text' as const, text: parentName },
                { type: 'text' as const, text: studentName },
                { type: 'text' as const, text: 'all subjects' },
                { type: 'text' as const, text: 'maths & science' },
                { type: 'text' as const, text: practiceUrl },
              ],
            }],
          }
        } else {
          template = {
            name: TRIAL_TEMPLATES.DAY_12.templateName,
            language: TRIAL_TEMPLATES.DAY_12.language,
            components: [{
              type: 'body' as const,
              parameters: [
                { type: 'text' as const, text: parentName },
                { type: 'text' as const, text: studentName },
                { type: 'text' as const, text: upgradeUrl },
              ],
            }],
          }
        }

        const result = await sendWhatsAppTemplate(t.phone, template)
        if (result.ok) {
          logger.info('[trialNudges] sent', { trialId: t.id, dayOffset: d, messageId: result.messageId })
        } else {
          logger.warn('[trialNudges] send failed', { trialId: t.id, dayOffset: d, error: result.error })
        }
      } catch (e) {
        logger.warn('[trialNudges] unexpected error', { trialId: t.id, error: String(e) })
      }
    }
  }

  logger.info('[trialNudges] job completed')
}

export default runTrialNudges
