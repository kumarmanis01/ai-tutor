import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { reason } = await req.json();
  if (reason) logger.add(`Note rejected for reason: ${reason}`);
  await prisma.topicNote.update({
    where: { id: params.id },
    data: { status: "rejected" },
  });
  return NextResponse.json({ rejected: true });
}
