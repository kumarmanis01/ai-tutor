import { enqueueTestHydration } from '@/producers/enqueueTestHydration';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  logger.debug('[api][DEBUG] admin/tests/regenerate called', { id });
  const jobId = await enqueueTestHydration(id);
  logger.info('[api][DEBUG] admin/tests/regenerate enqueued', { id, jobId });
  return NextResponse.json({ queued: true, jobId });
}
