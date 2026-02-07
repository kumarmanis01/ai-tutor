require('dotenv').config({ path: '.env.production' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const failedHydrations = await prisma.hydrationJob.findMany({ where: { status: 'failed' } })
  for (const h of failedHydrations) {
    try {
      const linkedExecs = await prisma.executionJob.findMany({ where: { payload: { path: ['hydrationJobId'], equals: h.id } } })
      for (const exec of linkedExecs) {
        if (exec.status !== 'failed' && exec.status !== 'completed') {
          console.log('Marking exec failed:', exec.id, 'hydration:', h.id)
          const fallback = 'DB_WRITE_FAILED::hydration_failed'
          await prisma.executionJob.update({ where: { id: exec.id }, data: { status: 'failed', lastError: h.lastError ?? fallback } })
          await prisma.jobExecutionLog.create({ data: { jobId: exec.id, event: 'RECONCILE_MARK_FAILED', prevStatus: exec.status ?? null, newStatus: 'failed', message: h.lastError ?? fallback, meta: { hydrationJobId: h.id } } })
        }
      }
    } catch (e) {
      console.error('error reconciling hydration', h.id, e)
    }
  }
}

main().catch((e)=>{ console.error(e); process.exit(1) }).finally(()=>prisma.$disconnect())
