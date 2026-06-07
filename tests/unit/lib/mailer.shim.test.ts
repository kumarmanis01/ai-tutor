/**
 * FILE OBJECTIVE:
 * - Unit tests for the lib/mailer compat shim (sendMail, sendMailSafe,
 *   sendEmail, sendEmailSafe). Verifies it picks the first recipient when
 *   `to` is an array, forwards idempotencyKey, returns null on best-effort
 *   failure, and re-exports the unified helpers unchanged.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/mailer.shim.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation.
 */

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/mail', () => ({
  sendEmailUnified: jest.fn(),
  sendEmailUnifiedSafe: jest.fn(),
}));

import { sendEmailUnified, sendEmailUnifiedSafe } from '@/lib/mail';
import { sendMail, sendMailSafe, sendEmail, sendEmailSafe } from '@/lib/mailer';

const unifiedMock = sendEmailUnified as unknown as jest.Mock;
const unifiedSafeMock = sendEmailUnifiedSafe as unknown as jest.Mock;

beforeEach(() => {
  unifiedMock.mockReset();
  unifiedSafeMock.mockReset();
});

describe('lib/mailer compat shim', () => {
  test('sendMail picks the first recipient when `to` is an array and forwards idempotencyKey', async () => {
    unifiedMock.mockResolvedValue({ ok: true });

    await sendMail({
      to: ['a@example.com', 'b@example.com'],
      subject: 's',
      html: '<p/>',
      idempotencyKey: 'idem-1',
    });

    expect(unifiedMock).toHaveBeenCalledTimes(1);
    const args = unifiedMock.mock.calls[0][0];
    expect(args.delivery).toBe('strict');
    expect(args.to).toBe('a@example.com');
    expect(args.idempotencyKey).toBe('idem-1');
  });

  test('sendMail forwards a single string recipient unchanged', async () => {
    unifiedMock.mockResolvedValue({ ok: true });
    await sendMail({ to: 'only@example.com', subject: 's', text: 't' });
    expect(unifiedMock.mock.calls[0][0].to).toBe('only@example.com');
  });

  test('sendMailSafe returns null when the underlying send throws', async () => {
    unifiedSafeMock.mockRejectedValue(new Error('smtp down'));
    const out = await sendMailSafe({ to: 'x@example.com', subject: 's', text: 't' });
    expect(out).toBeNull();
  });

  test('sendMailSafe returns the unified result on success', async () => {
    unifiedSafeMock.mockResolvedValue({ ok: true });
    const out = await sendMailSafe({ to: 'x@example.com', subject: 's', text: 't' });
    expect(out).toEqual({ ok: true });
  });

  test('sendEmail / sendEmailSafe are direct re-exports of the unified helpers', () => {
    expect(sendEmail).toBe(sendEmailUnified);
    expect(sendEmailSafe).toBe(sendEmailUnifiedSafe);
  });
});
