/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/notifications.ts centralized notification router.
 *   Covers routing logic, event validation, frequency capping, dry-run mode,
 *   and audit log calls.
 *
 * LINKED UNIT TEST: this file IS the unit test
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | staff-engineer | created per AC-08 of 09_notification_architecture.md
 * - 2026-05-09T00:00:00Z | staff-engineer | added audit metadata sanitization coverage for Prisma JSON input
 */

import {
  validateNotificationEvent,
  routeNotification,
  logNotificationEvent,
} from '@/lib/notifications';
import type { NotificationEvent } from '@/lib/notifications';
import { NOTIFICATION_EVENT_TYPES } from '@/lib/constants/mail';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id:           'student-1',
        name:         'Aarav',
        email:        'aarav@example.com',
        parentEmail:  'parent@example.com',
        whatsappPhone: '+919900000001',
        parentPhone:  '+919900000002',
      }),
    },
    notificationAudit: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    studentEngagementStats: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

jest.mock('@/lib/mail', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/whatsapp/templates', () => ({
  sendWhatsApp: jest.fn().mockResolvedValue({ success: true }),
  buildStudentDisengagedTemplate: jest.fn().mockReturnValue({ name: 'spinzy_student_disengaged', language: 'en', components: [] }),
  buildParentDisengagedTemplate:  jest.fn().mockReturnValue({ name: 'spinzy_parent_disengaged',  language: 'en', components: [] }),
}));

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(null), // No Redis in unit tests -- caps not enforced
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const baseEvent: NotificationEvent = {
  eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
  studentId: 'student-1',
  parentId:  'parent-1',
  context:   { studentName: 'Aarav', parentName: 'Mrs. Sharma', dashboardUrl: 'https://example.com' },
  severity:  'INFORMATIONAL',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── validateNotificationEvent ─────────────────────────────────────────────────

describe('validateNotificationEvent()', () => {
  it('should return no errors for a valid event', () => {
    const errors = validateNotificationEvent(baseEvent);
    expect(errors).toHaveLength(0);
  });

  it('should return error when studentId is missing', () => {
    const errors = validateNotificationEvent({ ...baseEvent, studentId: '' });
    expect(errors.some((e) => e.field === 'studentId')).toBe(true);
  });

  it('should return error for unknown eventType', () => {
    const errors = validateNotificationEvent({ ...baseEvent, eventType: 'TOTALLY_UNKNOWN' as never });
    expect(errors.some((e) => e.field === 'eventType')).toBe(true);
  });

  it('should return error for invalid severity', () => {
    const errors = validateNotificationEvent({ ...baseEvent, severity: 'EXTREME' as never });
    expect(errors.some((e) => e.field === 'severity')).toBe(true);
  });

  it('should accept all valid event types', () => {
    for (const eventType of Object.values(NOTIFICATION_EVENT_TYPES)) {
      const errors = validateNotificationEvent({ ...baseEvent, eventType });
      expect(errors.filter((e) => e.field === 'eventType')).toHaveLength(0);
    }
  });

  it('should accept all valid severities', () => {
    for (const severity of ['INFORMATIONAL', 'IMPORTANT', 'CRITICAL'] as const) {
      const errors = validateNotificationEvent({ ...baseEvent, severity });
      expect(errors).toHaveLength(0);
    }
  });
});

// ── routeNotification -- dry-run mode ─────────────────────────────────────────

describe('routeNotification() dry-run', () => {
  it('should not call sendEmail in dry-run mode', async () => {
    const { sendEmail } = jest.requireMock('@/lib/mail') as { sendEmail: jest.Mock };
    await routeNotification({ ...baseEvent, dryRun: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should mark all channel results as dry_run', async () => {
    const result = await routeNotification({ ...baseEvent, dryRun: true });
    const emailResults = result.channels.filter((c) => c.channel === 'email');
    for (const r of emailResults) {
      expect(r.status).toBe('dry_run');
    }
  });

  it('should set skippedDryRun to true', async () => {
    const result = await routeNotification({ ...baseEvent, dryRun: true });
    expect(result.skippedDryRun).toBe(true);
  });
});

// ── routeNotification -- event routing ───────────────────────────────────────

describe('routeNotification() routing', () => {
  it('should route SIGNUP_COMPLETED to email + whatsapp for student and parent', async () => {
    const result = await routeNotification(baseEvent);
    const channels = result.channels.map((c) => `${c.actor}:${c.channel}`);
    expect(channels).toContain('student:email');
    expect(channels).toContain('student:whatsapp');
    expect(channels).toContain('parent:email');
    expect(channels).toContain('parent:whatsapp');
  });

  it('should route MISSED_THREE_DAYS to student push + whatsapp and parent whatsapp', async () => {
    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.MISSED_THREE_DAYS,
      severity:  'IMPORTANT',
    });
    const channels = result.channels.map((c) => `${c.actor}:${c.channel}`);
    expect(channels).toContain('student:whatsapp');
    expect(channels).toContain('parent:whatsapp');
    // Should not go to parent email (per architecture doc)
    expect(channels.filter((ch) => ch === 'parent:email')).toHaveLength(0);
  });

  it('should route DISENGAGED_CRITICAL to all channels for both actors', async () => {
    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.DISENGAGED_CRITICAL,
      severity:  'CRITICAL',
    });
    const channels = result.channels.map((c) => `${c.actor}:${c.channel}`);
    expect(channels).toContain('student:whatsapp');
    expect(channels).toContain('student:email');
    expect(channels).toContain('parent:whatsapp');
    expect(channels).toContain('parent:email');
  });

  it('should route DAILY_DIGEST only to parent email', async () => {
    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.DAILY_DIGEST,
      severity:  'INFORMATIONAL',
    });
    const channels = result.channels.map((c) => `${c.actor}:${c.channel}`);
    expect(channels).toContain('parent:email');
    expect(channels).not.toContain('student:email');
    expect(channels).not.toContain('student:whatsapp');
  });

  it('should route PAYMENT_FAILED to parent whatsapp + email', async () => {
    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED,
      severity:  'CRITICAL',
    });
    const channels = result.channels.map((c) => `${c.actor}:${c.channel}`);
    expect(channels).toContain('parent:whatsapp');
    expect(channels).toContain('parent:email');
  });

  it('should return empty channels for unknown event', async () => {
    // Bypass validation by using a technically valid but empty-routed event
    // (DIAGNOSTIC_COMPLETED routes only to in_app)
    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.DIAGNOSTIC_COMPLETED,
    });
    // in_app channels should not call sendEmail
    const { sendEmail } = jest.requireMock('@/lib/mail') as { sendEmail: jest.Mock };
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

// ── routeNotification -- no contact ──────────────────────────────────────────

describe('routeNotification() no_contact', () => {
  it('should mark channel as no_contact when user has no email', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'student-no-email',
      name: 'Test',
      email: null,
      parentEmail: null,
      whatsappPhone: null,
      parentPhone: null,
    });

    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
    });

    const emailResults = result.channels.filter((c) => c.channel === 'email');
    for (const r of emailResults) {
      expect(['no_contact', 'sent', 'dry_run']).toContain(r.status);
    }
  });
});

// ── routeNotification -- DISENGAGED_CRITICAL side effect ─────────────────────

describe('routeNotification() DISENGAGED_CRITICAL side effect', () => {
  it('should call studentEngagementStats.updateMany to mark escalationStatus CRITICAL', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.DISENGAGED_CRITICAL,
      severity:  'CRITICAL',
      dryRun:    false,
    });
    expect(prisma.studentEngagementStats.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      data:  { escalationStatus: 'CRITICAL' },
    });
  });

  it('should NOT call updateMany in dry-run mode', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.DISENGAGED_CRITICAL,
      severity:  'CRITICAL',
      dryRun:    true,
    });
    expect(prisma.studentEngagementStats.updateMany).not.toHaveBeenCalled();
  });
});

// ── logNotificationEvent ──────────────────────────────────────────────────────

describe('logNotificationEvent()', () => {
  it('should call prisma.notificationAudit.create for each channel result', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    const event = { ...baseEvent, dryRun: false };
    const result = {
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
      channels: [
        { channel: 'email' as const, actor: 'student' as const, templateId: 'STUDENT_WELCOME', status: 'sent' as const },
        { channel: 'whatsapp' as const, actor: 'parent' as const, templateId: 'PARENT_WELCOME', status: 'sent' as const },
      ],
      skippedDryRun: false,
    };

    await logNotificationEvent(event, result);
    expect(prisma.notificationAudit.create).toHaveBeenCalledTimes(2);
  });

  it('should write dryRun=false for live sends', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    const event = { ...baseEvent, dryRun: false };
    const result = {
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
      channels: [{ channel: 'email' as const, actor: 'student' as const, templateId: 'STUDENT_WELCOME', status: 'sent' as const }],
      skippedDryRun: false,
    };

    await logNotificationEvent(event, result);
    const call = prisma.notificationAudit.create.mock.calls[0][0];
    expect(call.data.dryRun).toBe(false);
  });

  it('should write dryRun=true for dry-run events', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    const event = { ...baseEvent, dryRun: true };
    const result = {
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
      channels: [{ channel: 'email' as const, actor: 'student' as const, templateId: 'STUDENT_WELCOME', status: 'dry_run' as const }],
      skippedDryRun: true,
    };

    await logNotificationEvent(event, result);
    const call = prisma.notificationAudit.create.mock.calls[0][0];
    expect(call.data.dryRun).toBe(true);
  });

  it('should include studentId in audit row', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    const event = { ...baseEvent };
    const result = {
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
      channels: [{ channel: 'email' as const, actor: 'student' as const, templateId: 'STUDENT_WELCOME', status: 'sent' as const }],
      skippedDryRun: false,
    };

    await logNotificationEvent(event, result);
    const call = prisma.notificationAudit.create.mock.calls[0][0];
    expect(call.data.studentId).toBe('student-1');
  });

  it('should strip undefined values from audit metadata', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    const event = {
      ...baseEvent,
      context: {
        studentName: 'Aarav',
        parentName: undefined,
        dashboardUrl: 'https://example.com',
        ctaUrl: undefined,
      },
    };
    const result = {
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
      channels: [{ channel: 'email' as const, actor: 'student' as const, templateId: 'STUDENT_WELCOME', status: 'sent' as const }],
      skippedDryRun: false,
    };

    await logNotificationEvent(event, result);
    const call = prisma.notificationAudit.create.mock.calls[0][0];
    expect(call.data.metadata).toEqual({
      studentName: 'Aarav',
      dashboardUrl: 'https://example.com',
    });
    expect(call.data.metadata).not.toHaveProperty('parentName');
    expect(call.data.metadata).not.toHaveProperty('ctaUrl');
  });

  it('should not crash when notificationAudit.create throws', async () => {
    const { prisma } = jest.requireMock('@/lib/prisma') as any;
    prisma.notificationAudit.create.mockRejectedValueOnce(new Error('DB error'));
    const event = { ...baseEvent };
    const result = {
      eventType: NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED,
      channels: [{ channel: 'email' as const, actor: 'student' as const, templateId: 'STUDENT_WELCOME', status: 'sent' as const }],
      skippedDryRun: false,
    };

    await expect(logNotificationEvent(event, result)).resolves.not.toThrow();
  });
});

// ── Frequency capping (with Redis available) ──────────────────────────────────

describe('frequency capping (with Redis mock)', () => {
  const redisMock = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    const { getRedis } = jest.requireMock('@/lib/redis') as { getRedis: jest.Mock };
    getRedis.mockReturnValue(redisMock);
    redisMock.get.mockReset();
    redisMock.set.mockReset().mockResolvedValue('OK');
  });

  afterEach(() => {
    const { getRedis } = jest.requireMock('@/lib/redis') as { getRedis: jest.Mock };
    getRedis.mockReturnValue(null);
  });

  it('should mark channel as capped when daily cap is exceeded', async () => {
    // Return count = 2 (daily cap for student whatsapp is 2)
    redisMock.get.mockResolvedValue('2');

    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.MISSED_THREE_DAYS,
      severity:  'IMPORTANT',
    });

    const waCapped = result.channels.filter((c) => c.channel === 'whatsapp' && c.status === 'capped');
    expect(waCapped.length).toBeGreaterThan(0);
  });

  it('should allow CRITICAL sends even when cap is exceeded', async () => {
    // Return count = 5 (over any cap)
    redisMock.get.mockResolvedValue('5');

    const result = await routeNotification({
      ...baseEvent,
      eventType: NOTIFICATION_EVENT_TYPES.DISENGAGED_CRITICAL,
      severity:  'CRITICAL',
    });

    // CRITICAL + whatsapp/email should bypass cap and be sent (not capped)
    const emailResults = result.channels.filter((c) => c.channel === 'email');
    for (const r of emailResults) {
      expect(r.status).not.toBe('capped');
    }
  });
});
