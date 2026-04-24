/**
 * FILE OBJECTIVE:
 * - GET /api/v1/content/generation/status?jobId=xxx — returns the current
 *   status and metadata for an AI content generation job.
 *   Auth-guarded. User must be the creator or a subscriber.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/generation/status/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created — B4.1 content generation status route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    )
  }

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'jobId is required' },
      { status: 400 },
    )
  }

  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        topic: true,
        subject: true,
        grade: true,
        board: true,
        status: true,
        contentId: true,
        errorMessage: true,
        subscriberIds: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!job) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Generation job not found' },
        { status: 404 },
      )
    }

    // Authorization: only creator or subscriber can see the job
    const userId = session.user.id
    const isAuthorized = job.createdById === userId || job.subscriberIds.includes(userId)
    if (!isAuthorized) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Access denied' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      id: job.id,
      topic: job.topic,
      subject: job.subject,
      grade: job.grade,
      board: job.board,
      status: job.status,
      contentId: job.contentId,
      errorMessage: job.errorMessage,
      subscriberCount: job.subscriberIds.length,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })
  } catch (err: unknown) {
    logger.error('Failed to fetch generation job status', { jobId, error: err })
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Failed to fetch job status' },
      { status: 500 },
    )
  }
}
