/**
 * POST /api/admin/test-email
 *
 * Sends a test email via Resend to verify the mailer is wired correctly.
 * Admin-only. Used during deploy verification -- not exposed in UI.
 *
 * Body: { to: string, template?: "welcome" | "magic-link" | "receipt" | "otp" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmailUnified } from '@/lib/mail';
import {
  welcomeEmailHtml,
  magicLinkHtml,
  paymentReceiptHtml,
  parentOtpHtml,
} from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: '"to" must be a valid email address' }, { status: 400 });
  }

  const template = typeof body.template === 'string' ? body.template : 'welcome';

  const templateMap: Record<string, { subject: string; html: string }> = {
    welcome: {
      subject: 'Spinzy Academy -- email test (welcome)',
      // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
      html: welcomeEmailHtml('Test User'),
    },
    'magic-link': {
      subject: 'Spinzy Academy -- email test (magic link)',
      // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
      html: magicLinkHtml('https://spinzyacademy.com/auth/login?token=test'),
    },
    receipt: {
      subject: 'Spinzy Academy -- email test (receipt)',
      // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
      html: paymentReceiptHtml({
        studentName: 'Test Student',
        plan: 'Monthly',
        amountRupees: 99,
        billingCycle: 'per month',
        renewalDate: '24 April 2026',
      }),
    },
    otp: {
      subject: 'Spinzy Academy -- email test (parent OTP)',
      // TODO(email-consolidation): this bypasses sendEmailUnified -- migrate to EMAIL_TEMPLATES catalog
      html: parentOtpHtml('123456', 'Test Student'),
    },
  };

  const tpl = templateMap[template] ?? templateMap['welcome'];

  try {
    const result = await sendEmailUnified({
      mode: 'raw',
      delivery: 'strict',
      to,
      subject: tpl.subject,
      html: tpl.html,
      reason: 'admin_test_email',
      featureFlagDomain: 'ops',
    });
    return NextResponse.json({ ok: true, messageId: result.messageId ?? '', template });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
