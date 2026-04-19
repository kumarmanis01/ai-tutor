#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

async function main() {
  const args = process.argv.slice(2)
  const hydrationId = args[0]
  const executionId = args[1]
  const subjectId = args[2]
  if (!hydrationId || !executionId || !subjectId) {
    console.error('Usage: node scripts/inspect-hydration-dump.js <hydrationId> <executionId> <subjectId>')
    process.exit(2)
  }
  const prisma = new PrismaClient()
  try {
    // Find a RESPONSE_RECEIVED log for this execution job to get a timestamp
    const respLog = await prisma.jobExecutionLog.findFirst({ where: { jobId: executionId, event: 'RESPONSE_RECEIVED' }, orderBy: { createdAt: 'desc' } })
    let startWindow = respLog ? new Date(new Date(respLog.createdAt).getTime() - 3 * 60 * 1000) : null
    let endWindow = respLog ? new Date(new Date(respLog.createdAt).getTime() + 3 * 60 * 1000) : null

    console.log('ExecutionJob RESPONSE_RECEIVED log:', respLog)
    if (!startWindow) {
      // fallback: use hydration job createdAt
      const hyd = await prisma.hydrationJob.findUnique({ where: { id: hydrationId } })
      startWindow = hyd ? new Date(new Date(hyd.createdAt).getTime() - 3 * 60 * 1000) : new Date(0)
      endWindow = hyd ? new Date(new Date(hyd.createdAt).getTime() + 30 * 60 * 1000) : new Date()
    }

    console.log(`Searching AIContentLog entries from ${startWindow.toISOString()} to ${endWindow.toISOString()}`)
    const aiLogs = await prisma.aIContentLog.findMany({ where: { promptType: 'syllabus', createdAt: { gte: startWindow, lte: endWindow } }, orderBy: { createdAt: 'asc' } })
    console.log('AIContentLog hits:', aiLogs.length)
    console.log(JSON.stringify(aiLogs, null, 2))

    const chapters = await prisma.chapterDef.findMany({ where: { subjectId: subjectId, lifecycle: 'active' }, orderBy: { order: 'asc' } })
    console.log(`Chapters for subject ${subjectId} count=`, chapters.length)
    console.log(JSON.stringify(chapters, null, 2))
  } catch (err) {
    console.error('Error', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
