/**
 * FILE OBJECTIVE:
 * - API route to redeem referral codes; performs redemption in a DB transaction and sends best-effort post-transaction notifications.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/referral/redeem.route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | move best-effort notifications out of transaction and add push sends
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';
import { redeemReferral } from '@/lib/referral';
import { logger } from '@/lib/logger';

type RequestBody = { code?: string };

/** Extract client IP from request headers. Returns null if not determinable. */
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const redeemerIp = getClientIp(req);

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as RequestBody;
  const code = typeof body.code === 'string' ? body.code.trim() : undefined;
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  logApiUsage('/api/referral/redeem', 'POST');

  // attempt transaction, retry once on P2028 (transaction not found)
  try {
    const res = await prisma.$transaction(async (tx) => redeemReferral(tx, code, userId, redeemerIp ?? undefined));

    // Post-transaction: send best-effort push/email notifications (non-blocking)
    if (res.body.voided) {
      void (async () => {
        try {
          const redeemer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
          const referralRow = await prisma.referral.findUnique({ where: { code } });
          const creator = referralRow?.createdBy ? await prisma.user.findUnique({ where: { id: referralRow.createdBy }, select: { id: true, email: true, name: true } }) : null;

          const { sendPushSafe } = await import('@/lib/push/send');
          const { PUSH_NOTIFICATIONS } = await import('@/lib/push/notifications');
          const mailer = await import('@/lib/mail').then(m => m.sendEmailUnifiedSafe).catch(() => undefined);
          const templates = await import('@/lib/email/templates').catch(() => undefined);

          const subject = 'Referral reward voided';

          if (redeemer) {
            void sendPushSafe(redeemer.id, PUSH_NOTIFICATIONS.referral_voided_redeemer(code));
            if (redeemer.email && mailer && templates) void mailer({ mode: 'raw', delivery: 'best_effort', to: redeemer.email!, subject, html: templates.referralVoidedHtml({ name: redeemer.name ?? undefined, code }), reason: 'referral_voided', featureFlagDomain: 'notification' }).catch(() => {});
          }
          if (creator) {
            void sendPushSafe(creator.id, PUSH_NOTIFICATIONS.referral_voided_creator(code));
            if (creator.email && mailer && templates) void mailer({ mode: 'raw', delivery: 'best_effort', to: creator.email!, subject, html: templates.referralVoidedHtml({ name: creator.name ?? undefined, code }), reason: 'referral_voided', featureFlagDomain: 'notification' }).catch(() => {});
          }
        } catch (e) {
          logger.warn('referral/redeem: post-transaction notifications failed', { err: String(e) });
        }
      })();
    }

    return NextResponse.json(res.body, { status: res.status });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2028') {
      try {
        const res = await prisma.$transaction(async (tx) => redeemReferral(tx, code, userId, redeemerIp ?? undefined));
        if (res.body.voided) {
          void (async () => {
            try {
              const redeemer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
              const referralRow = await prisma.referral.findUnique({ where: { code } });
              const creator = referralRow?.createdBy ? await prisma.user.findUnique({ where: { id: referralRow.createdBy }, select: { id: true, email: true, name: true } }) : null;
              const { sendPushSafe } = await import('@/lib/push/send');
              const { PUSH_NOTIFICATIONS } = await import('@/lib/push/notifications');
              const mailer = await import('@/lib/mail').then(m => m.sendEmailUnifiedSafe).catch(() => undefined);
              const templates = await import('@/lib/email/templates').catch(() => undefined);
              const subject = 'Referral reward voided';
              if (redeemer) {
                void sendPushSafe(redeemer.id, PUSH_NOTIFICATIONS.referral_voided_redeemer(code));
                if (redeemer.email && mailer && templates) void mailer({ mode: 'raw', delivery: 'best_effort', to: redeemer.email!, subject, html: templates.referralVoidedHtml({ name: redeemer.name ?? undefined, code }), reason: 'referral_voided', featureFlagDomain: 'notification' }).catch(() => {});
              }
              if (creator) {
                void sendPushSafe(creator.id, PUSH_NOTIFICATIONS.referral_voided_creator(code));
                if (creator.email && mailer && templates) void mailer({ mode: 'raw', delivery: 'best_effort', to: creator.email!, subject, html: templates.referralVoidedHtml({ name: creator.name ?? undefined, code }), reason: 'referral_voided', featureFlagDomain: 'notification' }).catch(() => {});
              }
            } catch (e) {
              logger.warn('referral/redeem: post-transaction notifications failed (retry)', { err: String(e) });
            }
          })();
        }
        return NextResponse.json(res.body, { status: res.status });
      } catch {
        // nested error
      }
    }
    return NextResponse.json({ error: 'redeem_failed', detail: String(e) }, { status: 500 });
  }
}
