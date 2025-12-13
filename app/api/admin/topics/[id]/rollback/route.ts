import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: any) {
  const { version } = await req.json()

  await prisma.topicNote.updateMany({
    where: { topicId: params.id },
    data: { isActive: false }
  })

  await prisma.topicNote.updateMany({
    where: {
      topicId: params.id,
      version
    },
    data: { isActive: true }
  })

  return Response.json({ rolledBackTo: version })
}
