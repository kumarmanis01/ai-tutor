import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invites = await prisma.referral.findMany({ where: { createdBy: session.user.id }, orderBy: { createdAt: 'desc' } });
  const redeemedCount = invites.filter((r) => r.redeemedBy).length;

  return NextResponse.json({ totalInvites: invites.length, redeemedCount, invites });
}
