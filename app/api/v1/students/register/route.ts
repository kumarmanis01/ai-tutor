/**
 * FILE OBJECTIVE:
 * - Public endpoint to register a student. Creates User record and issues parent consent requests for minors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/students/register.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 * - 2026-04-24T12:00:00Z | copilot | validate contact per channel; use AccountStatus enum; remove any types
 */

import { NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendConsentRequest } from '@/lib/whatsapp/cloud.service';
import { sendMailSafe } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

/** Mask all but last 4 digits of a phone number. */
function maskPhone(p: string | null | undefined) {
  if (!p) return null;
  const s = p.replace(/[^0-9+]/g, '');
  return s.replace(/(\d)(?=\d{4})/g, '*');
}

/** Basic e-mail format check. */
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Basic phone check: digits + optional leading '+', 8–15 digits after stripping spaces/dashes.
 * Accepts +91XXXXXXXXXX, 10-digit numbers, etc.
 */
function isValidPhone(s: string): boolean {
  const digits = s.replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{8,15}$/.test(digits);
}

function calcAgeFromDob(dob: string) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export async function POST(req: Request) {
  const start = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : undefined;
  const dob = typeof b.dateOfBirth === 'string' ? b.dateOfBirth : undefined;
  const grade =
    typeof b.grade === 'string' || typeof b.grade === 'number' ? String(b.grade) : undefined;
  const board = typeof b.board === 'string' ? b.board : undefined;
  const channel =
    b.channel === 'whatsapp' ? 'whatsapp' : b.channel === 'email' ? 'email' : undefined;
  const parentContactRaw =
    typeof b.parent_contact === 'string' ? b.parent_contact.trim() : undefined;

  if (!name || !dob || !grade || !board) {
    const res = NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  }

  const age = calcAgeFromDob(dob);
  if (age == null || age < 0 || age > 120) {
    const res = NextResponse.json({ error: 'invalid_dob' }, { status: 400 });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    // Create student user record (minimal). Use AccountStatus enum — never `as any`.
    const isAdult = age >= 18;
    const accountStatus: AccountStatus = isAdult
      ? AccountStatus.active
      : AccountStatus.pending_parent_verification;

    const user = await prisma.user.create({
      data: {
        name,
        dateOfBirth: new Date(dob),
        age,
        isAdult,
        grade,
        board,
        language: 'en',
        accountStatus,
      },
      select: { id: true, name: true, age: true, isAdult: true },
    });

    // Adult: return success with full access scope placeholder
    if (isAdult) {
      const res = NextResponse.json({
        ok: true,
        user: { id: user.id, isAdult: true },
        scope: 'full',
      });
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
      return res;
    }

    // Minor: require parent contact and create ConsentRequest
    if (!parentContactRaw || !channel) {
      const res = NextResponse.json({ error: 'parent_contact_required' }, { status: 400 });
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
      return res;
    }

    // Validate contact format per channel — return 400 to avoid sending broken messages.
    const parentContact = parentContactRaw;
    if (channel === 'whatsapp' && !isValidPhone(parentContact)) {
      const res = NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
      return res;
    }
    if (channel === 'email' && !isValidEmail(parentContact)) {
      const res = NextResponse.json({ error: 'invalid_email' }, { status: 400 });
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
      return res;
    }

    // create consent token and consent request
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const consentReq = await prisma.consentRequest.create({
      data: {
        studentId: user.id,
        parentPhone: channel === 'whatsapp' ? parentContact : null,
        parentEmail: channel === 'email' ? parentContact : null,
        channel: channel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
        token,
        expiresAt,
      },
    });

    // send message (best-effort)
    try {
      // P1.2-R: consent URL at /parent/approve per spec
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const consentUrl = `${appUrl}/parent/approve?token=${token}`;
      const denyUrl = `${appUrl}/parent/approve?token=${token}&action=deny`;
      if (channel === 'whatsapp') {
        // sendConsentRequest(phone, childName, grade, board, consentToken)
        await sendConsentRequest(parentContact, name, grade ?? '', board ?? '', token);
        await prisma.consentMessageLog.create({
          data: { consentRequestId: consentReq.id, channel: 'WHATSAPP', status: 'SENT' },
        });
      } else {
        // P1.2-R: use enriched template with board, deny link, and correct subject
        await sendMailSafe({
          to: parentContact,
          subject: `${name} wants to learn with Spinzy Academy -- Your Approval Needed`,
          html: (await import('@/lib/email/templates')).consentRequestEmailHtml(
            'Parent',
            name,
            grade ?? '',
            consentUrl,
            { board: board ?? undefined, denyLink: denyUrl }
          ),
        });
        await prisma.consentMessageLog.create({
          data: { consentRequestId: consentReq.id, channel: 'EMAIL', status: 'SENT' },
        });
      }
    } catch (e) {
      logger.warn('student.register: sending consent message failed', {
        error: String(e),
        studentId: user.id,
      });
    }

    const exploreToken = `explore:${token}`;
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, isAdult: false },
      explore_token: exploreToken,
      contactMask: maskPhone(parentContact),
    });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('student.register failed', { error: String(err) });
    const res = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  }
}
