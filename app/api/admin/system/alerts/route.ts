import { NextResponse } from 'next/server';
import { requireAdminOrModerator } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    await requireAdminOrModerator();
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get('activeOnly') !== 'false';

    const where: any = {};
    if (activeOnly) where.active = true;

    const alerts = await prisma.systemAlert.findMany({ where, orderBy: { lastSeen: 'desc' } });
    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
