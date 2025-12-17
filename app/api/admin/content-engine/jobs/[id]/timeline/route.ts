/**
 * Timeline route for ExecutionJob
 * Protected by requireAdminOrModerator
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAdminOrModerator } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdminOrModerator();
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    const logs = await prisma.jobExecutionLog.findMany({ where: { jobId: id }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ logs });
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/jobs/[id]/timeline error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
