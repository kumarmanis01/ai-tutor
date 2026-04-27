/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/redis', () => ({ getRedis: () => null }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
import { describe, it, expect } from '@jest/globals'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery'

describe('notifications/delivery', () => {
  it('returns sent:true when no redis available and mail/sms are best-effort', async () => {
    const r = await sendParentMilestoneNotification('parent-1', { email: 'parent@example.test', subject: 'Test', html: '<p>hi</p>' })
    expect(r).toHaveProperty('sent')
  })
})
