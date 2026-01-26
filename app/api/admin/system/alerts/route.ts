import { NextResponse } from 'next/server';
import { requireAdminOrModerator } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatErrorForResponse } from '@/lib/errorResponse';

/**
 * Alerts are system-generated, read-only signals. They cannot be dismissed or modified via this API.
 */
export async function GET(req: Request) {
  try {
    await requireAdminOrModerator();
    const url = new URL(req.url);
    // Default: only active alerts
    const includeResolved = url.searchParams.get('includeResolved') === '1' || url.searchParams.get('includeResolved') === 'true';

    const where: any = {};
    if (!includeResolved) where.active = true;

    const alerts = await prisma.systemAlert.findMany({ where });

    // Sort by severity desc (CRITICAL > WARNING > INFO) then lastSeen desc
    const severityRank: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    alerts.sort((a: any, b: any) => {
      const ra = severityRank[a.severity] ?? 0;
      const rb = severityRank[b.severity] ?? 0;
      if (ra !== rb) return rb - ra;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
