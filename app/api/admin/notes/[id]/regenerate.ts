import { enqueueNoteHydration } from "@/producers/enqueueNoteHydration";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await enqueueNoteHydration(params.id);
  return NextResponse.json({ queued: true });
}
