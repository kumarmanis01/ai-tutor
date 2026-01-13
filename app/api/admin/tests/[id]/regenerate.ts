import { enqueueTestHydration } from "@/producers/enqueueTestHydration";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  console.log('[api][DEBUG] admin/tests/regenerate called', { params })
  const jobId = await enqueueTestHydration(params.id);
  console.log('[api][DEBUG] admin/tests/regenerate enqueued', { params, jobId })
  return NextResponse.json({ queued: true, jobId });
}
