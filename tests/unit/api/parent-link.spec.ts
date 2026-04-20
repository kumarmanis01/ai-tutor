/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Tests for POST /api/parent/link (F-PAR-001 AC-07):
 * welcome email + SMS sent on new link via invite-code and email-link paths.
 */

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}));
jest.mock('@/lib/parent/inviteService', () => ({
  createOrReuseParentInviteForStudent: jest.fn(),
  redeemParentInviteAndLink: jest.fn(),
  linkParentToStudentByEmail: jest.fn(),
  PARENT_INVITE_TTL_DAYS: 7,
}));
jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/sms', () => ({ sendSms: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email/templates', () => ({ parentWelcomeHtml: jest.fn().mockReturnValue('<html>welcome</html>') }));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';

const PARENT_ID = 'parent-1';
const STUDENT_ID = 'student-1';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/parent/link', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/parent/link — F-PAR-001 AC-07 welcome notifications', () => {
  let getServerSession: jest.Mock;
  let redeemParentInviteAndLink: jest.Mock;
  let linkParentToStudentByEmail: jest.Mock;
  let sendMailSafe: jest.Mock;
  let sendSms: jest.Mock;

  beforeEach(() => {
    resetPrismaMock();

    getServerSession = require('next-auth/next').getServerSession;
    getServerSession.mockResolvedValue({ user: { id: PARENT_ID, email: 'parent@example.test' } });

    redeemParentInviteAndLink = require('@/lib/parent/inviteService').redeemParentInviteAndLink;
    linkParentToStudentByEmail = require('@/lib/parent/inviteService').linkParentToStudentByEmail;

    sendMailSafe = require('@/lib/mailer').sendMailSafe;
    sendSms = require('@/lib/sms').sendSms;
    sendMailSafe.mockClear();
    sendSms.mockClear();
  });

  it('should return 401 when unauthenticated', async () => {
    getServerSession.mockResolvedValue(null);
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234' }) as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid action', async () => {
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'invalid' }) as any);
    expect(res.status).toBe(400);
  });

  it('should return 400 when link action has no inviteCode or studentEmail', async () => {
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'link' }) as any);
    expect(res.status).toBe(400);
  });

  describe('invite-code path (AC-07)', () => {
    it('should send welcome email + SMS when invite-code link succeeds (status=linked)', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: 'parent@example.test', phone: '+919876543210' })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234' }) as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('linked');
      expect(sendMailSafe).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'parent@example.test', subject: expect.stringContaining('Spinzy') }),
      );
      expect(sendSms).toHaveBeenCalledWith('+919876543210', expect.stringContaining('Test Student'));
    });

    it('should NOT send welcome email when invite-code link returns already_linked', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'already_linked', studentId: STUDENT_ID });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234' }) as any);

      const data = await res.json();
      expect(data.status).toBe('already_linked');
      expect(sendMailSafe).not.toHaveBeenCalled();
      expect(sendSms).not.toHaveBeenCalled();
    });

    it('should send email but skip SMS when parent has no phone', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: 'parent@example.test', phone: null })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234' }) as any);

      expect(sendMailSafe).toHaveBeenCalledTimes(1);
      expect(sendSms).not.toHaveBeenCalled();
    });

    it('should skip email if parent has no email address', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: null, phone: '+919876543210' })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234' }) as any);

      expect(sendMailSafe).not.toHaveBeenCalled();
      expect(sendSms).toHaveBeenCalledTimes(1);
    });
  });

  describe('email-link path (AC-07)', () => {
    it('should send welcome email + SMS when email-link succeeds (status=linked)', async () => {
      linkParentToStudentByEmail.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: 'parent@example.test', phone: '+919876543210' })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', studentEmail: 'student@example.test' }) as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('linked');
      expect(sendMailSafe).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'parent@example.test' }),
      );
      expect(sendSms).toHaveBeenCalledWith('+919876543210', expect.stringContaining('Test Student'));
    });

    it('should NOT send welcome email when email-link returns already_linked', async () => {
      linkParentToStudentByEmail.mockResolvedValue({ status: 'already_linked', studentId: STUDENT_ID });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', studentEmail: 'student@example.test' }) as any);

      const data = await res.json();
      expect(data.status).toBe('already_linked');
      expect(sendMailSafe).not.toHaveBeenCalled();
    });
  });
});
