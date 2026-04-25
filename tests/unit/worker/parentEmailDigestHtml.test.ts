/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn() }));
jest.mock('@/lib/whatsapp', () => ({
  sendWhatsAppMessage: jest.fn(),
  buildWeeklyWhatsAppMessage: jest.fn(),
}));
jest.mock('@/lib/ai/tools/generateParentReport', () => ({
  generateParentReportAI: jest.fn(async () => ({ summary: 'AI paragraph' })),
}));
jest.mock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: jest.fn() }));
jest.mock('@/lib/i18n', () => ({
  t: (key: string, _params?: any, _lang?: string) =>
    key === 'digest.subject' ? 'Weekly Update' : key === 'digest.fallback_text' ? 'Fallback' : '',
}));

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('parentEmailDigest HTML generator', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('includes viewport meta and dark-mode style block and CTA', async () => {
    const { buildDigestHtml } = await import('@/worker/jobs/parentEmailDigest');
    const html = buildDigestHtml('Test Parent', ['<div>child</div>']);
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('View Full Dashboard');
  });

  it('sends zero-activity subject and includes teaser for free-tier parents', async () => {
    const { sendParentDigests } = await import('@/worker/jobs/parentEmailDigest');
    const { prismaMock } = require('../../helpers/prismaMock');
    const { sendParentMilestoneNotification } = require('@/lib/notifications/delivery');

    // parentStudent.findMany returns a single active link
    prismaMock.parentStudent.findMany.mockResolvedValueOnce([
      {
        parentId: 'p1',
        parent: {
          id: 'p1',
          email: 'p@test',
          name: 'Parent One',
          phone: null,
          whatsappPhone: null,
          language: 'en',
          subscriptionStatus: 'free',
        },
        student: { id: 's1', name: 'Child One', grade: '6', board: 'CBSE' },
      },
    ]);

    // Profiles/timezone defaults
    prismaMock.parentProfile.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ timezone: null });

    // Batch queries default to empty arrays which yields totalSessions === 0
    await sendParentDigests();

    expect(sendParentMilestoneNotification).toHaveBeenCalled();
    const args = (sendParentMilestoneNotification as jest.Mock).mock.calls[0][1];
    expect(args.subject).toMatch(/hasn't started this week/);
    expect(args.html).toContain('Unlock Premium Features');
  });

  it('does not include teaser for paid/premium parents', async () => {
    const { sendParentDigests } = await import('@/worker/jobs/parentEmailDigest');
    const { prismaMock } = require('../../helpers/prismaMock');
    const { sendParentMilestoneNotification } = require('@/lib/notifications/delivery');

    prismaMock.parentStudent.findMany.mockResolvedValueOnce([
      {
        parentId: 'p2',
        parent: {
          id: 'p2',
          email: 'p2@test',
          name: 'Parent Two',
          phone: null,
          whatsappPhone: null,
          language: 'en',
          subscriptionStatus: 'standard',
        },
        student: { id: 's2', name: 'Child Two', grade: '7', board: 'ICSE' },
      },
    ]);

    prismaMock.parentProfile.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ timezone: null });

    await sendParentDigests();

    expect(sendParentMilestoneNotification).toHaveBeenCalled();
    const args = (sendParentMilestoneNotification as jest.Mock).mock.calls[0][1];
    expect(args.html).not.toContain('Unlock Premium Features');
  });
});
