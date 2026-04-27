#!/usr/bin/env ts-node
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function findRoot(jobId: string): Promise<string | null> {
  let current = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
  if (!current) return null
  while (current.parentJobId) {
    const parent = await prisma.hydrationJob.findUnique({ where: { id: current.parentJobId } })
    if (!parent) break
    current = parent
  }
  return current.id
}

async function main() {
  logger.info('backfill-rootJobId: starting')
  const jobs = await prisma.hydrationJob.findMany({ where: { rootJobId: null } })
  logger.info('backfill-rootJobId: found jobs', { count: jobs.length })
  for (const j of jobs) {
    try {
      const root = await findRoot(j.id)
      const toSet = root || j.id
      await prisma.hydrationJob.update({ where: { id: j.id }, data: { rootJobId: toSet } })
      logger.info('backfill-rootJobId: updated', { jobId: j.id, rootJobId: toSet })
    } catch (e) {
      logger.error('backfill-rootJobId: failed to update', { jobId: j.id, error: String(e) })
    }
  }
  logger.info('backfill-rootJobId: finished')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
