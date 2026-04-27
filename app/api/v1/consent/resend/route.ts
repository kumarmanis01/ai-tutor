/**
 * FILE OBJECTIVE:
 * - Resend a consent request. Enforces a cooldown and adds a new message log entry.
 *   The consent token is kept STABLE so the client can continue polling without updating its URL.
 *   Supports optional channel/contact switch (validated per channel).
 *   Blocks resend for terminal statuses (APPROVED/DENIED).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/v1/consent/resend.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 * - 2026-04-24T12:00:00Z | copilot | keep token stable; block terminal statuses; validate contact; fetch student details for WA
 * - 2026-04-27T00:00:00Z | copilot | implement 24h cooldown, max-reminder cap, and contact-change flow with request replacement
 * - 2026-04-27T12:00:00Z | copilot | enforce denied same-contact 72h device cooldown while allowing different-contact resend
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendConsentRequest } from '@/lib/whatsapp/cloud.service';
import { sendMailSafe } from '@/lib/mailer';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REMINDERS_PER_REQUEST = 3;
const DENIED_DEVICE_COOLDOWN_SECONDS = 72 * 60 * 60;

/** Basic e-mail format check. */
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Basic phone check: 8-15 digits with optional leading '+'. */
function isValidPhone(s: string): boolean {
  const digits = s.replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{8,15}$/.test(digits);
}

export async function POST(req: Request) {
  const start = Date.now();
  const redis = getRedis();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const token = typeof b.consent_token === 'string' ? b.consent_token : undefined;
  const newContact = typeof b.new_contact === 'string' ? b.new_contact.trim() : undefined;
  const newChannel =
    b.new_channel === 'email' ? 'email' : b.new_channel === 'whatsapp' ? 'whatsapp' : undefined;

  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  try {
    const cr = await prisma.consentRequest.findUnique({
      where: { token },
      include: {
        messageLogs: { orderBy: { createdAt: 'desc' }, take: MAX_REMINDERS_PER_REQUEST },
      },
    });
    if (!cr) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (cr.status === 'APPROVED') {
      return NextResponse.json({ error: 'terminal_status' }, { status: 409 });
    }

    // Resolve effective contact and channel (new_contact overrides stored value).
    const effectiveChannel = newChannel ?? (cr.parentPhone ? 'whatsapp' : 'email');
    const effectiveContact =
      newContact ?? (effectiveChannel === 'whatsapp' ? cr.parentPhone : cr.parentEmail);

    if (!effectiveContact) {
      return NextResponse.json({ error: 'no_contact' }, { status: 400 });
    }

    // Validate contact format per channel.
    if (effectiveChannel === 'whatsapp' && !isValidPhone(effectiveContact)) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }
    if (effectiveChannel === 'email' && !isValidEmail(effectiveContact)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    const isContactSwitch =
      Boolean(newContact) ||
      Boolean(newChannel && newChannel !== (cr.parentPhone ? 'whatsapp' : 'email'));

    if (cr.status === 'DENIED') {
      const previousContact = cr.parentPhone ?? cr.parentEmail ?? '';
      const isSameContact = previousContact === effectiveContact;
      if (isSameContact) {
        const fingerprint = req.headers.get('x-device-fingerprint')?.trim() ?? '';
        if (!fingerprint || !redis) {
          return NextResponse.json({ error: 'different_contact_required' }, { status: 400 });
        }

        const deniedKey = `consent:denied:${fingerprint}:${cr.id}`;
        let retryAfterSeconds = await redis.ttl(deniedKey);
        if (retryAfterSeconds <= 0) {
          await redis.setex(deniedKey, DENIED_DEVICE_COOLDOWN_SECONDS, '1');
          retryAfterSeconds = DENIED_DEVICE_COOLDOWN_SECONDS;
        }

        return NextResponse.json(
          {
            error: 'denied_device_cooldown',
            retryAfterSeconds,
            message: 'Please use a different contact or try again after cooldown.',
          },
          { status: 429 }
        );
      }
    }

    const lastLog = cr.messageLogs?.[0];
    if (!isContactSwitch && lastLog && Date.now() - lastLog.createdAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: 'cooldown' }, { status: 429 });
    }

    if (!isContactSwitch && cr.messageLogs.length >= MAX_REMINDERS_PER_REQUEST) {
      return NextResponse.json({ error: 'max_reminders_reached' }, { status: 429 });
    }

    // Fetch student details so the WA template is populated correctly.
    const student = await prisma.user.findUnique({
      where: { id: cr.studentId },
      select: { name: true, grade: true, board: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://spinzyacademy.com';
    const nextToken = isContactSwitch ? crypto.randomUUID() : token;
    const nextConsentRequest = isContactSwitch
      ? await prisma.$transaction(async (tx) => {
          await tx.consentRequest.update({
            where: { id: cr.id },
            data: { status: 'EXPIRED' },
          });

          return tx.consentRequest.create({
            data: {
              studentId: cr.studentId,
              parentPhone: effectiveChannel === 'whatsapp' ? effectiveContact : null,
              parentEmail: effectiveChannel === 'email' ? effectiveContact : null,
              channel: effectiveChannel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
              token: nextToken,
              expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
          });
        })
      : cr;

    // Send message (best-effort) and log it.
    try {
      if (effectiveChannel === 'whatsapp') {
        await sendConsentRequest(
          effectiveContact,
          student?.name ?? '',
          student?.grade ?? '',
          student?.board ?? '',
          nextToken
        );
        await prisma.consentMessageLog.create({
          data: {
            consentRequestId: nextConsentRequest.id,
            channel: 'WHATSAPP',
            status: 'SENT',
          },
        });
      } else {
        const consentUrl = `${appUrl}/parent/approve?token=${nextToken}`;
        await sendMailSafe({
          to: effectiveContact,
          subject: `Please approve ${student?.name ?? 'your child'}'s Spinzy account`,
          html: `Please approve: ${consentUrl}`,
        });
        await prisma.consentMessageLog.create({
          data: {
            consentRequestId: nextConsentRequest.id,
            channel: 'EMAIL',
            status: 'SENT',
          },
        });
      }
    } catch (e) {
      logger.warn('consent.resend: send failed', {
        error: String(e),
        consentRequestId: nextConsentRequest.id,
      });
    }

    const res = NextResponse.json({
      ok: true,
      consent_token: nextToken,
      replaced_request: isContactSwitch,
    });
    logger.logAPI(req, res, { className: 'ConsentResendAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('consent.resend failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
