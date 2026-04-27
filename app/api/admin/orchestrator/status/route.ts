import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { requireAdminOrModerator } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export async function GET() {
  await requireAdminOrModerator()
  const ROOT = path.resolve(process.cwd())
  const STATUS_FILE = path.join(ROOT, 'tmp', 'orchestrator.status.json')

  let orchestrator: any = null
  try {
    if (fs.existsSync(STATUS_FILE)) orchestrator = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
  } catch (e) {
    orchestrator = { error: formatErrorForResponse(e) }
  }

  const counts = await prisma.workerLifecycle.groupBy({ by: ['status'], _count: { status: true } })
  const map: Record<string, number> = {}
  for (const c of counts) map[c.status] = Number(c._count.status || 0)

  return NextResponse.json({ orchestrator, workerCounts: map })
}
