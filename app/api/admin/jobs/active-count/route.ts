import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ count: 0 });
  }
  const count = await prisma.hydrationJob
    .count({ where: { hierarchyLevel: 0, status: { in: ['running', 'failed'] } } })
    .catch(() => 0);
  return NextResponse.json({ count });
}
