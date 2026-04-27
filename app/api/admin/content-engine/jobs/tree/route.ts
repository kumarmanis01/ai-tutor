import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

// Return the HydrationJob tree for a given rootJobId or jobId
export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const q = url.searchParams
  const rootJobId = q.get('rootJobId') || q.get('jobId')
  const filterStatus = q.get('status') || null
  if (!rootJobId) return NextResponse.json({ error: 'Missing rootJobId or jobId' }, { status: 400 })

  // Fetch jobs for this root (or the single job). Select only required fields for UI.
  const whereClause: any = { OR: [{ rootJobId }, { id: rootJobId }] }
  if (filterStatus) whereClause.status = filterStatus

  const jobs = await prisma.hydrationJob.findMany({
    where: whereClause,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      jobType: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      createdAt: true,
      completedAt: true,
      parentJobId: true,
      rootJobId: true
    }
  })

  if (!jobs || jobs.length === 0) return NextResponse.json({ error: 'No jobs found' }, { status: 404 })

  const map: Record<string, any> = {}
  for (const j of jobs) map[j.id] = { ...j, children: [] }

  // Build child lists
  for (const id in map) {
    const node = map[id]
    if (node.parentJobId && map[node.parentJobId]) {
      map[node.parentJobId].children.push(node)
    }
  }

  // Augment nodes with UI-specific flags: isLeaf, retryEligible, aiContentLogLink
  for (const id in map) {
    const node = map[id]
    node.isLeaf = (node.children.length === 0)
    node.retryEligible = node.isLeaf && node.status === 'failed' && (node.attempts ?? 0) < (node.maxAttempts ?? 0)
    node.aiContentLogLink = `/admin/content-engine/logs?jobId=${node.id}`
    // Collapse long errors by default; UI can expand using lastError
    node.lastErrorShort = node.lastError ? (String(node.lastError).slice(0, 200)) : null
  }

  // Determine root node to return
  let root = map[rootJobId] ?? null
  if (!root) {
    root = Object.values(map).find((n: any) => !n.parentJobId) || Object.values(map)[0]
  }

  return NextResponse.json({ root })
}
