import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomInt } from 'crypto';
import { sendEmail } from '@/lib/mailer';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: Request) {
  const { email } = await req.json();
  logApiUsage('/api/auth/send-code', 'POST');
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Generate a 6-digit code, pad with leading zeros if needed
  const code = String(randomInt(0, 1000000)).padStart(6, '0');

  // Store code in VerificationToken table (overwrite if exists)
  await prisma.verificationToken.deleteMany({
    where: { identifier: cleanEmail },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: cleanEmail,
      token: code,
      expires: new Date(Date.now() + 20 * 60 * 1000), // 20 min expiry to match the image
    },
  });

  // Send code via centralized mailer
  try {
    await sendEmail({
      to: cleanEmail,
      subject: 'Verify Your Email Address',
      text: `Verify your email to finish signing up with Spinzy Academy. Use the following verification code: ${code}\n\nThe verification code is valid for 20 minutes.`,
      html: `
        <div style="background:#0a3180;padding:24px 0;">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
            <div style="background:#0a3180;padding:24px 0;text-align:center;">
              <img src="https://spinzyacademy.com/logo.png" alt="Spinzy Academy" style="height:40px;" />
            </div>
            <div style="padding:32px 24px;text-align:center;">
              <h2 style="color:#0a3180;margin-bottom:16px;">Verify Your Email Address</h2>
              <p style="font-size:16px;color:#222;margin-bottom:24px;">
                Verify your email to finish signing up with Spinzy Academy. Use the following verification code:
              </p>
              <div style="font-size:36px;font-weight:bold;color:#0a3180;margin-bottom:16px;">${code}</div>
              <div style="font-size:16px;color:#222;margin-bottom:24px;">
                The verification code is valid for 20 minutes.
              </div>
            </div>
            <div style="padding:16px 24px;text-align:center;font-size:13px;color:#888;">
              For any further queries or clarifications, feel free to reach out to us by visiting <a href="https://spinzyacademy.com/support" style="color:#0a3180;">here</a>.
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    logger.error('Error sending email', { className: 'api.auth.send-code', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
