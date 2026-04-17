/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn() }));
jest.mock('@/lib/whatsapp', () => ({ sendWhatsAppMessage: jest.fn(), buildWeeklyWhatsAppMessage: jest.fn() }));
jest.mock('@/lib/ai/tools/generateParentReport', () => ({ generateParentReportAI: jest.fn(async () => ({ summary: 'AI paragraph' })) }));
jest.mock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: jest.fn() }));
jest.mock('@/lib/i18n', () => ({ t: (key: string, _params?: any, _lang?: string) => (key === 'digest.subject' ? 'Weekly Update' : (key === 'digest.fallback_text' ? 'Fallback' : '')) }));

import { describe, it, expect, beforeEach } from '@jest/globals'

describe('parentEmailDigest HTML generator', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('includes viewport meta and dark-mode style block and CTA', async () => {
    const { buildDigestHtml } = await import('@/worker/jobs/parentEmailDigest')
    const html = buildDigestHtml('Test Parent', ['<div>child</div>'])
    expect(html).toContain('<meta name="viewport"')
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('View Full Dashboard')
  })
})
