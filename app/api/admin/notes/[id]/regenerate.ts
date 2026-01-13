import { enqueueNoteHydration } from "@/producers/enqueueNoteHydration";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  console.log('[api][DEBUG] admin/notes/regenerate called', { params })
  const jobId = await enqueueNoteHydration(params.id);
  console.log('[api][DEBUG] admin/notes/regenerate enqueued', { params, jobId })
  return NextResponse.json({ queued: true, jobId });
}
