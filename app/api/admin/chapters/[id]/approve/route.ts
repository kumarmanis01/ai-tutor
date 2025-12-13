import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await prisma.chapterDef.update({
    where: { id: params.id },
    data: { status: "approved" }
  })
  return Response.json({ success: true })
}
