/**
 * POST /api/student/diagnostic/trigger-generation
 *
 * Called by DiagnosticWaitingScreen on mount to kick off content generation
 * for subjects that have no pre-seeded content.
 *
 * Behaviour:
 *   phase "questions" -- topics already exist; FEATURE_ONDEMAND_DIAGNOSTIC handles
 *                        question generation on the next page load; no action needed here
 *   phase "topics"    -- syllabus missing; delegates to enqueueSubjectHydration which
 *                        creates a HydrationJob + Outbox so the content-hydration worker
 *                        generates ChapterDef/TopicDef/Questions
 *
 * Body:   { subjectId: string }
 * Auth:   session required -- 401 if missing
 * See:    docs/v2/on-demand-generator.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LanguageCode } from '@prisma/client';
import { enqueueSubjectHydration } from '@/lib/diagnostics/enqueueSubjectHydration';

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let subjectId: string | undefined;
  try {
    const body = await req.json();
    subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!subjectId) {
    return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
  }

  try {
    // Fetch student language before delegating to the helper.
    // Language is required only for job creation (Rule 4) but the query is a
    // single-field primary-key lookup -- the cost is negligible even when the
    // helper short-circuits at Rule 1 (topics already exist).
    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const language: LanguageCode = (student?.language as LanguageCode) ?? LanguageCode.en;

    // Delegate all idempotency checks and job creation to the shared helper.
    // The helper runs: topicDef.count (Rule 1) -> job-in-flight check (Rule 2)
    //   -> SubjectDef lookup (Rule 3) -> atomic HydrationJob + Outbox create (Rule 4).
    const result = await enqueueSubjectHydration(subjectId, language, 'student_on_demand');

    switch (result.reason) {
      case 'topics_exist':
        logger.info('[trigger-generation] topics exist, no action needed', {
          event: 'diagnostic.trigger_generation.topics_exist',
          context: { studentId: userId, subjectId },
        });
        return NextResponse.json({ triggered: false, phase: 'questions' });

      case 'created':
        return NextResponse.json({ triggered: true, phase: 'topics', jobId: result.jobId });

      case 'job_running':
        return NextResponse.json({ triggered: false, phase: 'topics', jobId: result.jobId });

      case 'subject_not_found':
        return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }
  } catch (err) {
    logger.error('[trigger-generation] failed', {
      event: 'diagnostic.trigger_generation.error',
      context: { studentId: userId, subjectId, error: String(err) },
    });
    return NextResponse.json({ error: 'Could not trigger generation' }, { status: 500 });
  }
}
