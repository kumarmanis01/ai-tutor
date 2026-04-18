import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { customAlphabet } from 'nanoid';
import { logApiUsage } from '@/utils/logApiUsage';

const nano = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

/** Extract client IP from request headers. Returns null if not determinable. */
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? null;
}

export async function POST(req: NextRequest) {
  logApiUsage('/api/referral/create', 'POST');
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const creatorIp = getClientIp(req);
  // Ensure each student has a single referral code -- return existing if present
  let referral = await prisma.referral.findFirst({ where: { createdBy: session.user.id } });
  if (!referral) {
    const code = nano();
    referral = await prisma.referral.create({
      // F-STU-042 AC-05: store creator IP in metadata for fraud detection at redeem time
      data: { code, createdBy: session.user.id, metadata: creatorIp ? { creatorIp } : undefined },
    });
  }

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = `${base}/auth/signup?ref=${referral.code}`;

  return NextResponse.json({ code: referral.code, url });
}
