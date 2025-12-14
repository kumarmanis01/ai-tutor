import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function GET() {
  const chapters = await prisma.chapterDef.findMany({
    where: { status: "pending", lifecycle: "active" },
    include: {
      subject: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ chapters })
}
