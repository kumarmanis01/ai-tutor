import { prisma } from "@/lib/prisma"
import { getServerSessionForHandlers } from '@/lib/session'
import { ApprovalStatus } from '@/lib/ai-engine/types'

export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSessionForHandlers();
  // Resolve DB user id for audit; fall back to null when not resolvable.
  let adminId: string | null = null;
  try {
    if (session?.user?.id) {
      const byId = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (byId) adminId = byId.id;
    }
    if (!adminId && session?.user?.email) {
      const byEmail = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (byEmail) adminId = byEmail.id;
    }
  } catch {
    adminId = null;
  }

  const topic = await prisma.topicDef.findUnique({ where: { id: params.id } })
  if (!topic) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.topicDef.update({ where: { id: params.id }, data: { status: ApprovalStatus.Approved } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'approve_topic', details: { topicId: params.id, fromStatus: topic.status }, createdAt: new Date() } })
  ])

  return Response.json({ approved: true })
}
