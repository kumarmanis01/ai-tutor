import { prisma } from '@/lib/prisma'
import { formatErrorForResponse } from '@/lib/errorResponse'

/**
 * GET /api/admin/jobs/status
 * Returns a short summary of recent ExecutionJobs and their linked HydrationJobs
 * - executionJobId, executionStatus, hydrationJobId, hydrationStatus, contentReady
 * - latest jobExecutionLog event for the execution job
 */
export async function GET() {
  try {
    const execs = await prisma.executionJob.findMany({ orderBy: { updatedAt: 'desc' }, take: 20 })

    const jobs = await Promise.all(
      execs.map(async (ex) => {
        const hydrationJobId = ex.payload?.hydrationJobId ?? null
        const hydration = hydrationJobId ? await prisma.hydrationJob.findUnique({ where: { id: hydrationJobId } }) : null
        const latestLog = await prisma.jobExecutionLog.findFirst({ where: { jobId: ex.id }, orderBy: { createdAt: 'desc' } })

        return {
          executionJobId: ex.id,
          executionStatus: ex.status,
          hydrationJobId,
          hydrationStatus: hydration?.status ?? null,
          contentReady: !!hydration?.contentReady,
          latestLog: latestLog ? { event: latestLog.event, createdAt: latestLog.createdAt } : null,
          payload: ex.payload || null,
          updatedAt: ex.updatedAt,
        }
      })
    )

    return new Response(JSON.stringify({ jobs }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: formatErrorForResponse(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
