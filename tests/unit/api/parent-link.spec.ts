/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Tests for POST /api/parent/link (F-PAR-001 AC-07):
 * welcome email sent on new link via invite-code, legacy invite-code, and email-link paths.
 * SMS is intentionally not tested: sendSms uses MSG91 OTP API and cannot send arbitrary text.
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
jest.mock('@/lib/mail', () => ({ sendEmailUnifiedSafe: jest.fn().mockResolvedValue({ success: true }) }));
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

const RELATIONSHIP = 'guardian'

describe('POST /api/parent/link — F-PAR-001 AC-07 welcome notifications', () => {
  let getServerSession: jest.Mock;
  let redeemParentInviteAndLink: jest.Mock;
  let linkParentToStudentByEmail: jest.Mock;
  let sendEmailUnifiedSafe: jest.Mock;

  beforeEach(() => {
    resetPrismaMock();

    getServerSession = require('next-auth/next').getServerSession;
    getServerSession.mockResolvedValue({ user: { id: PARENT_ID, email: 'parent@example.test', role: 'parent' } });

    redeemParentInviteAndLink = require('@/lib/parent/inviteService').redeemParentInviteAndLink;
    linkParentToStudentByEmail = require('@/lib/parent/inviteService').linkParentToStudentByEmail;

    sendEmailUnifiedSafe = require('@/lib/mail').sendEmailUnifiedSafe;
    sendEmailUnifiedSafe.mockClear();
  });

  it('should return 401 when unauthenticated', async () => {
    getServerSession.mockResolvedValue(null);
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234', relationship: RELATIONSHIP }) as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid action', async () => {
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'invalid' }) as any);
    expect(res.status).toBe(400);
  });

  it('should return 400 when link action has no inviteCode or studentEmail', async () => {
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'link', relationship: RELATIONSHIP }) as any);
    expect(res.status).toBe(400);
  });

  it('should return 400 when relationship is missing', async () => {
    const { POST } = await import('@/app/api/parent/link/route');
    const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234' }) as any);
    expect(res.status).toBe(400);
  });

  describe('invite-code path (AC-07)', () => {
    it('should send welcome email when invite-code link succeeds (status=linked)', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: 'parent@example.test' })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234', relationship: RELATIONSHIP }) as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('linked');
      expect(sendEmailUnifiedSafe).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'parent@example.test', subject: expect.stringContaining('Spinzy') }),
      );
    });

    it('should NOT send welcome email when invite-code link returns already_linked', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'already_linked', studentId: STUDENT_ID });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234', relationship: RELATIONSHIP }) as any);

      const data = await res.json();
      expect(data.status).toBe('already_linked');
      expect(sendEmailUnifiedSafe).not.toHaveBeenCalled();
    });

    it('should skip email if parent has no email address', async () => {
      redeemParentInviteAndLink.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: null })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      await POST(makeRequest({ action: 'link', inviteCode: 'ABCD1234', relationship: RELATIONSHIP }) as any);

      expect(sendEmailUnifiedSafe).not.toHaveBeenCalled();
    });
  });

  describe('legacy invite-code fallback path (AC-07)', () => {
    it('should send welcome email when legacy invite code creates a new link', async () => {
      redeemParentInviteAndLink.mockRejectedValue(new Error('not found'));
      prismaMock.parentStudent.findUnique
        // legacy record lookup
        .mockResolvedValueOnce({
          id: 'legacy-1',
          studentId: STUDENT_ID,
          parentId: 'other-parent',
          status: 'pending',
          createdAt: new Date(),
        })
        // existing link check
        .mockResolvedValueOnce(null);
      prismaMock.parentStudent.update.mockResolvedValue({ id: 'legacy-1' } as any);
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: 'parent@example.test' })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', inviteCode: 'LEGACY01', relationship: RELATIONSHIP }) as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('linked');
      expect(sendEmailUnifiedSafe).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'parent@example.test' }),
      );
    });

    it('should NOT send welcome email when legacy code resolves to already_linked', async () => {
      redeemParentInviteAndLink.mockRejectedValue(new Error('not found'));
      prismaMock.parentStudent.findUnique
        .mockResolvedValueOnce({
          id: 'legacy-1',
          studentId: STUDENT_ID,
          parentId: 'other-parent',
          status: 'pending',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({ id: 'existing-1', status: 'active' });
      prismaMock.parentStudent.update.mockResolvedValue({} as any);

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', inviteCode: 'LEGACY01', relationship: RELATIONSHIP }) as any);

      const data = await res.json();
      expect(data.status).toBe('already_linked');
      expect(sendEmailUnifiedSafe).not.toHaveBeenCalled();
    });
  });

  describe('email-link path (AC-07)', () => {
    it('should send welcome email when email-link succeeds (status=linked)', async () => {
      linkParentToStudentByEmail.mockResolvedValue({ status: 'linked', studentId: STUDENT_ID });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ name: 'Test Parent', email: 'parent@example.test' })
        .mockResolvedValueOnce({ name: 'Test Student' });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', studentEmail: 'student@example.test', relationship: RELATIONSHIP }) as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('linked');
      expect(sendEmailUnifiedSafe).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'parent@example.test' }),
      );
    });

    it('should NOT send welcome email when email-link returns already_linked', async () => {
      linkParentToStudentByEmail.mockResolvedValue({ status: 'already_linked', studentId: STUDENT_ID });

      const { POST } = await import('@/app/api/parent/link/route');
      const res = await POST(makeRequest({ action: 'link', studentEmail: 'student@example.test', relationship: RELATIONSHIP }) as any);

      const data = await res.json();
      expect(data.status).toBe('already_linked');
      expect(sendEmailUnifiedSafe).not.toHaveBeenCalled();
    });
  });
});
