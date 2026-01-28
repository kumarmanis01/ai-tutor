#!/usr/bin/env node
import path from 'path'

const argv = process.argv.slice(2)
const jobId = argv[0]
const outboxId = argv[1]

if (!jobId && !outboxId) {
  console.error('Usage: node scripts/debugHydrationJob.js <hydrationJobId> [outboxId]')
  process.exit(2)
}

// const idToQuery = jobId || outboxId (not used)

async function main() {
  try {
    const { pathToFileURL } = await import('url')
    const prismaModulePath = path.join(process.cwd(), 'dist/lib/prisma.js')
    const prismaFileUrl = pathToFileURL(prismaModulePath).href
    const { prisma } = await import(prismaFileUrl)

    if (jobId) {
      const hj = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
      console.log('\nHYDRATION_JOB:\n', JSON.stringify(hj, null, 2))

      const chapterCount = await prisma.chapterDef.count({ where: { hydrationJobId: jobId } }).catch(()=>null)
      const topicCount = await prisma.topicDef.count({ where: { hydrationJobId: jobId } }).catch(()=>null)
      console.log('\nCOUNTS: chapters=', chapterCount, ' topics=', topicCount)

      const execs = await prisma.executionJob.findMany({ where: { payload: { path: ['hydrationJobId'], equals: jobId } }, take: 20 })
      console.log('\nLINKED_EXECUTION_JOBS:\n', JSON.stringify(execs, null, 2))

      const logs = await prisma.jobExecutionLog.findMany({ where: { meta: { path: ['hydrationJobId'], equals: jobId } }, orderBy: { createdAt: 'asc' }, take: 200 })
      console.log('\nJOB_EXECUTION_LOGS (first 200):\n', JSON.stringify(logs, null, 2))
    }

    if (outboxId) {
      const out = await prisma.outbox.findUnique({ where: { id: outboxId } })
      console.log('\nOUTBOX ROW:\n', JSON.stringify(out, null, 2))
    }

    // Last resort: recent outbox rows for same worker type
    const recent = await prisma.outbox.findMany({ where: { workerType: 'SYLLABUS' }, orderBy: { createdAt: 'desc' }, take: 20 })
    console.log('\nRECENT_OUTBOX_SYLLABUS (20): count=', recent.length)

    await prisma.$disconnect()
  } catch (err) {
    console.error('ERROR querying DB:', err)
    process.exitCode = 1
  }
}

void main()
