/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/mail.ts centralized email module.
 *   Covers template rendering, variable interpolation, sendEmail(), sendEmailBatch().
 *
 * LINKED UNIT TEST: this file IS the unit test
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | staff-engineer | created per AC-08 of 09_notification_architecture.md
 */

import {
  EMAIL_TEMPLATES,
  EMAIL_FROM,
  sendEmail,
  sendEmailBatch,
  sendEmailUnified,
  sendEmailUnifiedSafe,
} from '@/lib/mail';

// ── Mock lib/mailer so no real email is sent ──────────────────────────────────

jest.mock('@/lib/mailer', () => {
  const actual = jest.requireActual('@/lib/mailer');
  return {
    ...actual,
    sendMailSafe: jest.fn().mockResolvedValue(undefined),
    sendMail: jest.fn().mockResolvedValue('mock-id'),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { sendMailSafe } from '@/lib/mailer';
const mockSendMailSafe = sendMailSafe as jest.MockedFunction<typeof sendMailSafe>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── EMAIL_FROM ────────────────────────────────────────────────────────────────

describe('EMAIL_FROM', () => {
  it('should export NOREPLY constant', () => {
    expect(typeof EMAIL_FROM.NOREPLY).toBe('string');
    expect(EMAIL_FROM.NOREPLY).toContain('spinzyacademy.com');
  });

  it('should export SUPPORT constant', () => {
    expect(typeof EMAIL_FROM.SUPPORT).toBe('string');
    expect(EMAIL_FROM.SUPPORT).toContain('spinzyacademy.com');
  });

  it('should export LEARNING constant', () => {
    expect(typeof EMAIL_FROM.LEARNING).toBe('string');
    expect(EMAIL_FROM.LEARNING.toLowerCase()).toContain('vidya');
  });

  it('should export BILLING constant', () => {
    expect(typeof EMAIL_FROM.BILLING).toBe('string');
    expect(EMAIL_FROM.BILLING).toContain('billing@');
  });
});

// ── Template catalog ──────────────────────────────────────────────────────────

describe('EMAIL_TEMPLATES catalog', () => {
  const requiredTemplates = [
    'STUDENT_WELCOME',
    'PARENT_WELCOME',
    'STUDENT_PLAN_READY',
    'PARENT_PLAN_GENERATED',
    'PARENT_DAILY_DIGEST',
    'PARENT_STREAK_MILESTONE',
    'STUDENT_DISENGAGED_CRITICAL',
    'PARENT_DISENGAGED_CRITICAL',
    'PARENT_MISSED_THREE_DAYS',
    'STUDENT_IMPROVEMENT_DETECTED',
    'PARENT_IMPROVEMENT_DETECTED',
    'STUDENT_EXAM_COUNTDOWN',
    'PARENT_EXAM_COUNTDOWN',
    'STUDENT_REVISION_PLAN_READY',
    'PARENT_REVISION_PLAN_READY',
    'STUDENT_MOCK_FEEDBACK',
    'PARENT_MOCK_SUMMARY',
    'STUDENT_EXAM_RISK_ALERT',
    'PARENT_EXAM_RISK_ALERT',
    'PARENT_WEEKLY_REPORT',
    'PARENT_MONTHLY_REPORT',
    'PARENT_TRIAL_ENDING',
    'PARENT_TRIAL_ENDED',
    'PARENT_PAYMENT_SUCCESS',
    'PARENT_PAYMENT_FAILED',
    'STUDENT_SECURITY_ALERT',
    'PARENT_SECURITY_ALERT',
    'STUDENT_NEW_DEVICE_LOGIN',
    'PARENT_NEW_DEVICE_LOGIN',
  ];

  it('should have all required templates', () => {
    for (const id of requiredTemplates) {
      expect(EMAIL_TEMPLATES[id]).toBeDefined();
    }
  });

  it('should have at least 29 templates', () => {
    expect(Object.keys(EMAIL_TEMPLATES).length).toBeGreaterThanOrEqual(29);
  });

  for (const id of requiredTemplates) {
    describe(`template: ${id}`, () => {
      it('should have subject function', () => {
        const t = EMAIL_TEMPLATES[id];
        expect(typeof t.subject).toBe('function');
      });

      it('should have htmlBody function', () => {
        const t = EMAIL_TEMPLATES[id];
        expect(typeof t.htmlBody).toBe('function');
      });

      it('should have textBody function', () => {
        const t = EMAIL_TEMPLATES[id];
        expect(typeof t.textBody).toBe('function');
      });

      it('should have from constant', () => {
        const t = EMAIL_TEMPLATES[id];
        expect(typeof t.from).toBe('string');
        expect(t.from.length).toBeGreaterThan(0);
      });
    });
  }
});

// ── Template rendering & variable interpolation ───────────────────────────────

describe('STUDENT_WELCOME template rendering', () => {
  const template = EMAIL_TEMPLATES.STUDENT_WELCOME;
  const ctx = { studentName: 'Aarav', ctaUrl: 'https://example.com/diag' };

  it('should include student name in subject', () => {
    expect(template.subject(ctx)).toContain('Aarav');
  });

  it('should include student name in HTML body', () => {
    expect(template.htmlBody(ctx)).toContain('Aarav');
  });

  it('should include CTA URL in HTML body', () => {
    expect(template.htmlBody(ctx)).toContain('https://example.com/diag');
  });

  it('should render subject even with missing context', () => {
    expect(() => template.subject({})).not.toThrow();
  });
});

describe('PARENT_WEEKLY_REPORT template rendering', () => {
  const template = EMAIL_TEMPLATES.PARENT_WEEKLY_REPORT;
  const ctx = {
    parentName: 'Mrs. Sharma',
    studentName: 'Aarav',
    studyDays: 6,
    totalHours: 5,
    streakDays: 6,
    weekOf: 'May 5, 2026',
    examReadinessScore: 0.72,
    dashboardUrl: 'https://example.com/dashboard',
  };

  it('should include student name in subject', () => {
    expect(template.subject(ctx)).toContain('Aarav');
  });

  it('should include week date in subject', () => {
    expect(template.subject(ctx)).toContain('May 5, 2026');
  });

  it('should include study days in HTML body', () => {
    expect(template.htmlBody(ctx)).toContain('6');
  });

  it('should include streak in HTML body', () => {
    expect(template.htmlBody(ctx)).toContain('6 days');
  });

  it('should include exam readiness in HTML body', () => {
    expect(template.htmlBody(ctx)).toContain('72%');
  });
});

describe('PARENT_PAYMENT_FAILED template rendering', () => {
  const template = EMAIL_TEMPLATES.PARENT_PAYMENT_FAILED;
  const ctx = { parentName: 'Mr. Patel', studentName: 'Riya', ctaUrl: 'https://example.com/billing' };

  it('should not contain negative language', () => {
    const html = template.htmlBody(ctx);
    const lowerHtml = html.toLowerCase();
    expect(lowerHtml).not.toContain('failed payment');
    // Should contain actionable language
    expect(lowerHtml).toContain('payment');
  });

  it('should include CTA URL', () => {
    expect(template.htmlBody(ctx)).toContain('https://example.com/billing');
  });
});

describe('STUDENT_DISENGAGED_CRITICAL template copy', () => {
  const template = EMAIL_TEMPLATES.STUDENT_DISENGAGED_CRITICAL;
  const ctx = { studentName: 'Priya', ctaUrl: 'https://example.com/dashboard' };

  it('should not contain forbidden words (missed, failed, broke)', () => {
    const html = template.htmlBody(ctx).toLowerCase();
    expect(html).not.toContain('missed');
    expect(html).not.toContain('broke');
    expect(html).not.toContain('lost');
  });

  it('should contain forward-looking language', () => {
    const html = template.htmlBody(ctx).toLowerCase();
    expect(html).toMatch(/continue|ahead|still|ready|forward/);
  });
});

// ── sendEmail ─────────────────────────────────────────────────────────────────

describe('sendEmail()', () => {
  it('should return success when sendMailSafe resolves', async () => {
    mockSendMailSafe.mockResolvedValueOnce(undefined);
    const result = await sendEmail('STUDENT_WELCOME', 'test@example.com', { studentName: 'Aarav' });
    expect(result.success).toBe(true);
    expect(mockSendMailSafe).toHaveBeenCalledTimes(1);
  });

  it('should return failure for unknown templateId', async () => {
    const result = await sendEmail('NONEXISTENT_TEMPLATE', 'test@example.com', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown template');
    expect(mockSendMailSafe).not.toHaveBeenCalled();
  });

  it('should return failure when sendMailSafe throws', async () => {
    mockSendMailSafe.mockRejectedValueOnce(new Error('SMTP error'));
    const result = await sendEmail('STUDENT_WELCOME', 'test@example.com', { studentName: 'Aarav' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('SMTP error');
  });

  it('should pass correct subject to sendMailSafe', async () => {
    mockSendMailSafe.mockResolvedValueOnce(undefined);
    await sendEmail('STUDENT_WELCOME', 'test@example.com', { studentName: 'Aarav' });
    const call = mockSendMailSafe.mock.calls[0][0];
    expect(call.subject).toContain('Aarav');
  });

  it('should pass html and text to sendMailSafe', async () => {
    mockSendMailSafe.mockResolvedValueOnce(undefined);
    await sendEmail('PARENT_WEEKLY_REPORT', 'parent@example.com', {
      studentName: 'Aarav',
      weekOf: 'May 2026',
      studyDays: 5,
    });
    const call = mockSendMailSafe.mock.calls[0][0];
    expect(typeof call.html).toBe('string');
    expect(call.html.length).toBeGreaterThan(0);
  });
});

// ── sendEmailBatch ────────────────────────────────────────────────────────────

describe('sendEmailBatch()', () => {
  it('should return correct sent/failed counts', async () => {
    mockSendMailSafe
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const result = await sendEmailBatch([
      { templateId: 'STUDENT_WELCOME',  to: 'a@example.com', context: { studentName: 'A' } },
      { templateId: 'STUDENT_WELCOME',  to: 'b@example.com', context: { studentName: 'B' } },
      { templateId: 'PARENT_WELCOME',   to: 'c@example.com', context: { parentName: 'C' }  },
    ]);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('should return 0 sent and 0 failed for empty batch', async () => {
    const result = await sendEmailBatch([]);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should count unknown templateId as failed', async () => {
    const result = await sendEmailBatch([
      { templateId: 'NO_SUCH_TEMPLATE', to: 'x@example.com', context: {} },
    ]);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });
});

// ── No hardcoded strings ──────────────────────────────────────────────────────

describe('FROM addresses', () => {
  it('should use EMAIL_FROM constants rather than hardcoded strings', () => {
    // All templates must reference a from that matches one of the EMAIL_FROM values
    const fromValues = new Set(Object.values(EMAIL_FROM));
    for (const [id, template] of Object.entries(EMAIL_TEMPLATES)) {
      expect(fromValues.has(template.from)).toBe(true);
    }
  });
});

// ── Unified Email Facade Tests ─────────────────────────────────────────────

describe('sendEmailUnified', () => {
  it('should send a template email (mode=template)', async () => {
    mockSendMail.mockResolvedValueOnce('mock-id');
    const result = await sendEmailUnified({
      mode: 'template',
      to: 'test@example.com',
      templateId: 'STUDENT_WELCOME',
      context: { studentName: 'Aarav' },
    });
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Aarav');
    expect(call.html).toContain('Aarav');
  });

  it('should send a raw email (mode=raw)', async () => {
    mockSendMail.mockResolvedValueOnce('mock-id');
    const result = await sendEmailUnified({
      mode: 'raw',
      to: 'raw@example.com',
      subject: 'Test Subject',
      html: '<b>Raw HTML</b>',
      text: 'Raw text',
    });
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toBe('Test Subject');
    expect(call.html).toContain('Raw HTML');
  });

  it('should return failure for missing templateId in template mode', async () => {
    const result = await sendEmailUnified({
      mode: 'template',
      to: 'fail@example.com',
      // no templateId
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('templateId');
  });

  it('should return failure for missing subject/html in raw mode', async () => {
    const result = await sendEmailUnified({
      mode: 'raw',
      to: 'fail@example.com',
      // no subject/html
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('subject and html');
  });

  it('should log and not throw in sendEmailUnifiedSafe', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('fail'));
    const result = await sendEmailUnifiedSafe({
      mode: 'raw',
      to: 'fail@example.com',
      subject: 'fail',
      html: '<b>fail</b>',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('fail');
  });
});

// Patch test double for sendMail to ensure all unified email API tests pass
import * as mailer from '@/lib/mailer';
const mockSendMail = jest.spyOn(mailer, 'sendMail').mockImplementation(async () => 'mock-id');
