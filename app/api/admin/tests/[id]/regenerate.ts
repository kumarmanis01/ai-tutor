import { enqueueTestHydration } from "@/producers/enqueueTestHydration";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  logger.debug('[api][DEBUG] admin/tests/regenerate called', { params })
  const jobId = await enqueueTestHydration(params.id);
  logger.info('[api][DEBUG] admin/tests/regenerate enqueued', { params, jobId })
  return NextResponse.json({ queued: true, jobId });
}
