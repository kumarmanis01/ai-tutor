/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */

import { NextResponse } from 'next/server';
import { submitJob } from '@/lib/execution-pipeline/submitJob';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { jobType, entityType, entityId, payload, maxAttempts } = body;

    if (!jobType || !entityType || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await submitJob({ jobType, entityType, entityId, payload, maxAttempts });

    return NextResponse.json({ jobId: result.jobId, existing: result.existing });
  } catch (err) {
    logger?.error?.('POST /api/admin/content-engine/jobs error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
