import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: NextRequest) {
  logApiUsage('/api/user/onboarding', 'POST');
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name, parentEmail, country } = await req.json();
  await prisma.user.update({
    where: { email: session.user.email },
    data: { name, parentEmail, country },
  });
  return NextResponse.json({ ok: true });
}
