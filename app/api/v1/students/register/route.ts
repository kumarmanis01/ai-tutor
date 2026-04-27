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
 * - 2026-04-27T00:00:00Z | copilot | adopt schema-first validation, precise age calculation, and medium/subjects support while preserving existing endpoint
 * - 2026-04-27T13:55:00Z | copilot | replace placeholder registration tokens with JWT access tokens and expose consent_token separately
 */

import { NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendConsentRequest } from '@/lib/whatsapp/cloud.service';
import { sendMailSafe } from '@/lib/mailer';
import { getRedis } from '@/lib/redis';
import {
  studentRegistrationSchema,
  type StudentRegistrationInput,
} from '@/lib/student/registrationSchema';
import { calculateAgeFromDob } from '@/lib/student/calculateAgeFromDob';
import { generateAccessToken } from '@/lib/auth/token.service';

export const dynamic = 'force-dynamic';
const REG_LIMIT_MAX = 3;
const REG_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;

function maskContact(input: string | null | undefined, channel: 'email' | 'whatsapp' | null) {
  if (!input || !channel) return null;
  if (channel === 'email') {
    const [local, domain] = input.split('@');
    if (!local || !domain) return null;
    return `${local.slice(0, 1)}***@${domain}`;
  }

  const sanitized = input.replace(/[^0-9+]/g, '');
  return sanitized.replace(/(\d)(?=\d{4})/g, '*');
}

export async function POST(req: Request) {
  const start = Date.now();

  const redis = getRedis();
  if (redis) {
    try {
      const forwardedFor = req.headers.get('x-forwarded-for') ?? '';
      const ip = forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      const ua = req.headers.get('user-agent') ?? 'unknown';
      const suppliedFingerprint = req.headers.get('x-device-fingerprint') ?? '';
      const fingerprint = suppliedFingerprint || `${ip}:${ua.slice(0, 120)}`;
      const key = `ratelimit:student-register:${fingerprint}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, REG_LIMIT_WINDOW_SECONDS);
      }
      if (count > REG_LIMIT_MAX) {
        const res = NextResponse.json(
          { error: 'rate_limited', message: 'Too many registration attempts. Please try later.' },
          { status: 429 }
        );
        logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
        return res;
      }
    } catch (rateErr) {
      logger.warn('student.register: rate limit check failed', { error: String(rateErr) });
    }
  }

  let parsed: StudentRegistrationInput;
  try {
    const rawJson = (await req.json()) as unknown;
    const result = studentRegistrationSchema.safeParse(rawJson);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const res = NextResponse.json(
        {
          error: firstIssue?.message ?? 'validation_error',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
      logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
      return res;
    }

    parsed = result.data;
  } catch {
    const res = NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  }

  const name = parsed.name;
  const dob = parsed.dateOfBirth;
  const grade = String(parsed.grade);
  const board = parsed.board;
  const medium = parsed.medium;
  const subjects = parsed.subjects;
  const channel = parsed.channel;
  const parentContactRaw = parsed.parent_contact;

  const age = calculateAgeFromDob(dob);
  if (age == null || age < 0 || age > 120) {
    const res = NextResponse.json({ error: 'invalid_dob' }, { status: 400 });
    logger.logAPI(req, res, { className: 'StudentRegisterAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    // Create student user record (minimal). Use AccountStatus enum -- never `as any`.
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
        language: medium,
        subjects,
        accountStatus,
      },
      select: { id: true, name: true, age: true, isAdult: true },
    });

    const accessToken = await generateAccessToken({
      sub: user.id,
      role: 'user',
      scope: 'user',
    });

    // Adult: return success with full access scope token.
    if (isAdult) {
      const res = NextResponse.json({
        ok: true,
        user: { id: user.id, isAdult: true },
        status: 'ACTIVE',
        consentStatus: 'NOT_REQUIRED',
        scope: 'full',
        access_token: accessToken,
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


    const parentContact = parentContactRaw;

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
      // P1.2-R: consent URL at /parent/approve per spec.
      // Always use an absolute fallback to avoid broken relative links in email clients
      // when NEXT_PUBLIC_APP_URL is not configured in an environment.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://spinzyacademy.com';
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

    const exploreToken = accessToken;
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, isAdult: false },
      status: 'AWAITING_PARENT_CONSENT',
      consentStatus: 'AWAITING',
      scope: 'EXPLORE_MODE',
      explore_token: exploreToken,
      consent_token: token,
      contactMask: maskContact(parentContact, channel),
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
