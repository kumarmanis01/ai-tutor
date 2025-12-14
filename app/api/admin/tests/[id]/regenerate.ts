import { enqueueTestHydration } from "@/producers/enqueueTestHydration";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await enqueueTestHydration(params.id);
  return NextResponse.json({ queued: true });
}
