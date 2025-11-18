import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { customAlphabet } from 'nanoid';
import { logApiUsage } from '@/utils/logApiUsage';

const nano = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export async function POST() {
  logApiUsage('/api/referral/create', 'POST');
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const code = nano();
  const referral = await prisma.referral.create({
    data: { code, createdBy: session.user.id },
  });

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = `${base}/auth/signup?ref=${referral.code}`;

  return NextResponse.json({ code: referral.code, url });
}
