#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

// Reconciler: find HydrationJobs where contentReady=true and linked ExecutionJob not completed,
// and mark ExecutionJob completed. Run periodically (cron/PM2) or manually.

async function main() {
  const prisma = new PrismaClient()
  try {
    const pending = await prisma.hydrationJob.findMany({ where: { contentReady: true } })
    for (const h of pending) {
      try {
        const linked = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: h.id }, status: { not: 'completed' } } })
        if (linked) {
          await prisma.executionJob.update({ where: { id: linked.id }, data: { status: 'completed' } })
          await prisma.jobExecutionLog.create({ data: { jobId: linked.id, event: 'COMPLETED', prevStatus: linked.status ?? null, newStatus: 'completed', meta: { hydrationJobId: h.id, reconciler: true } } })
          console.log(`Reconciled execution ${linked.id} for hydration ${h.id}`)
        }
      } catch (e) {
        console.error('Error reconciling hydration', h.id, e)
      }
    }
  } catch (e) {
    console.error('reconciler failed', e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
