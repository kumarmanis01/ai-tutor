import { prisma } from "@/lib/prisma"
import { getServerSessionForHandlers } from '@/lib/session'
import { ApprovalStatus } from '@/lib/ai-engine/types'

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role ?? null;
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });
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

  const topic = await prisma.topicDef.findUnique({ where: { id } })
  if (!topic) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.topicDef.update({ where: { id }, data: { status: ApprovalStatus.Approved } }),
    prisma.auditLog.create({ data: { adminId, targetEntity: 'TopicDef', targetId: id, action: 'CONTENT_APPROVE', previousValue: { status: topic.status }, newValue: { status: 'approved' } } })
  ])

  return Response.json({ approved: true })
}
