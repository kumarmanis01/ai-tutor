import { enqueueNoteHydration } from "@/producers/enqueueNoteHydration";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  logger.debug('[api][DEBUG] admin/notes/regenerate called', { params })
  const jobId = await enqueueNoteHydration(params.id);
  logger.info('[api][DEBUG] admin/notes/regenerate enqueued', { params, jobId })
  return NextResponse.json({ queued: true, jobId });
}
