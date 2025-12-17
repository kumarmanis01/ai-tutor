import { prisma } from "@/lib/prisma"
import { getServerSessionForHandlers } from '@/lib/session'
import { ApprovalStatus } from '@/lib/ai-engine/types'

export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSessionForHandlers();
  const adminId = session?.user?.id ?? 'SYSTEM_ADMIN'

  const topic = await prisma.topicDef.findUnique({ where: { id: params.id } })
  if (!topic) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.topicDef.update({ where: { id: params.id }, data: { status: ApprovalStatus.Approved } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'approve_topic', details: { topicId: params.id, fromStatus: topic.status }, createdAt: new Date() } })
  ])

  return Response.json({ approved: true })
}
