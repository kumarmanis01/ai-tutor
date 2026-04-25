import { pruneOldAnalyticsEvents } from '@/lib/jobs/retention';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    analyticsEvent: {
      deleteMany: jest.fn(async (args: any) => ({ count: 7 })),
    },
  },
}));

jest.mock('@/lib/audit/log', () => jest.fn(async () => {}));

describe('pruneOldAnalyticsEvents', () => {
  it('calls prisma.analyticsEvent.deleteMany and returns deleted count', async () => {
    const deleted = await pruneOldAnalyticsEvents(30);
    expect(deleted).toBe(7);
  });
});
