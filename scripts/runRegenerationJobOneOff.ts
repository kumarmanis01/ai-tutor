#!/usr/bin/env node
// Load local env only in non-production runs. PM2 provides env via `env_file` in prod.
if (process.env.NODE_ENV !== 'production') {
  try { void import('dotenv/config') } catch {}
}
import { prisma } from '@/lib/prisma'
import generatorAdapter from '@/regeneration/generatorAdapter'
import { logAuditEvent } from '@/lib/audit/log'
import { AuditEvents } from '@/lib/audit/events'

export async function runOneOff(jobId: string) {
  const claim = await (prisma as any).regenerationJob.updateMany({
    where: { id: jobId, status: 'PENDING' },
    data: { status: 'RUNNING', updatedAt: new Date() },
  })
  if (!claim || (claim.count ?? 0) === 0) {
    throw new Error('Job not in PENDING state or already claimed.')
  }

  const job = await (prisma as any).regenerationJob.findUnique({
    where: { id: jobId },
    select: { id: true, suggestionId: true, targetType: true, targetId: true, instructionJson: true },
  })
  if (!job) throw new Error('Job not found after claiming')

  await logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_STARTED, entityId: job.id, metadata: { jobId: job.id, manual: true } })

  try {
    const output = await generatorAdapter({
      id: job.id,
      suggestionId: job.suggestionId,
      targetType: job.targetType as any,
      targetId: job.targetId,
      instructionJson: job.instructionJson,
    })

    const out = await (prisma as any).regenerationOutput.create({
      data: { jobId: job.id, targetType: job.targetType, targetId: job.targetId, contentJson: output.outputJson },
    })

    const outputRef = { outputId: out.id, createdAt: out.createdAt }
    await (prisma as any).regenerationJob.updateMany({
      where: { id: job.id, status: 'RUNNING' },
      data: { status: 'COMPLETED', outputRef } as any,
    })
    await logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_COMPLETED, entityId: job.id, metadata: { jobId: job.id, outputRef } })
    return { success: true, jobId: job.id }
  } catch (err: any) {
    const errorJson = { message: String(err?.message ?? err), stack: err?.stack }
    await (prisma as any).regenerationJob.updateMany({
      where: { id: job.id, status: 'RUNNING' },
      data: { status: 'FAILED', errorJson } as any,
    }).catch(() => {})
    await logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_FAILED, entityId: job.id, metadata: { jobId: job.id, errorJson } })
    throw err
  }
}

if (require.main === module) {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: node dist/tools/runRegenerationJobOneOff.js <jobId>')
    process.exit(1)
  }
  runOneOff(id).then((r) => { console.log('done', r); process.exit(0) }).catch((e) => { console.error(e); process.exit(2) })
}