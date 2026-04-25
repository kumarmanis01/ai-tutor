/**
 * POST /api/admin/content-engine/notes-rehyd
 *
 * Bulk re-hydrate notes for every active topic in a subject.
 * Used to regenerate notes with an updated prompt (e.g. VidyaNotesSchema).
 *
 * Unlike /content/hydrate (which re-runs the full syllabus pipeline), this
 * endpoint only creates NOTES HydrationJobs -- topics and chapters are not
 * touched. Safe to run on subjects that already have approved notes.
 *
 * Body: { subjectId: string, language?: string }
 * Auth: admin role required.
 * Returns: { enqueued: number, skipped: number, topicCount: number }
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { enqueueNotesHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  // session check -> role check -> business logic (CLAUDE.md rule 8)
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  let body: { subjectId?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { subjectId, language = 'en' } = body;
  if (!subjectId) {
    return NextResponse.json({ error: 'missing_fields', required: ['subjectId'] }, { status: 400 });
  }

  if (!['en', 'hi'].includes(language)) {
    return NextResponse.json(
      { error: 'invalid_language', supported: ['en', 'hi'] },
      { status: 400 }
    );
  }

  // Verify subject exists and load display info for the audit log
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      class: { select: { grade: true, board: { select: { name: true } } } },
    },
  });
  if (!subject) {
    return NextResponse.json({ error: 'subject_not_found' }, { status: 404 });
  }

  // Load all active topics for this subject
  const topics = await prisma.topicDef.findMany({
    where: {
      chapter: { subjectId, lifecycle: 'active' },
      lifecycle: 'active',
    },
    select: { id: true },
    orderBy: { order: 'asc' },
  });

  if (topics.length === 0) {
    return NextResponse.json({
      enqueued: 0,
      skipped: 0,
      topicCount: 0,
      message: 'No active topics found for this subject. Run the syllabus pipeline first.',
    });
  }

  let enqueued = 0;
  let skipped = 0;

  // Enqueue notes jobs serially to avoid hammering the DB with concurrent writes.
  // force=true: generate new versions even for topics that already have approved notes.
  for (const topic of topics) {
    try {
      const result = await enqueueNotesHydration({ topicId: topic.id, language, force: true });
      if (result.created) {
        enqueued++;
      } else {
        // Only reason to skip with force=true is job_already_queued or hydration_paused
        skipped++;
        if (result.reason === 'hydration_paused') break;
      }
    } catch (err) {
      logger.warn('[notes-rehyd] failed to enqueue topic, skipping', {
        event: 'notes_rehyd_topic_error',
        context: { topicId: topic.id, error: String(err) },
      });
      skipped++;
    }
  }

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        adminId: session.user?.id ?? null,
        targetEntity: 'HydrationJob',
        targetId: subjectId,
        action: 'NOTES_REHYDRATE',
        newValue: {
          subjectId,
          subjectName: subject.name,
          grade: subject.class?.grade,
          board: subject.class?.board?.name,
          language,
          topicCount: topics.length,
          enqueued,
          skipped,
        },
      },
    });
  } catch (auditErr) {
    logger.warn('[notes-rehyd] failed to write AuditLog', {
      event: 'audit_log_failed',
      context: { subjectId, error: String(auditErr) },
    });
  }

  logger.info('[notes-rehyd] bulk notes re-hydration enqueued', {
    event: 'notes_rehyd_enqueued',
    context: {
      subjectId,
      subject: subject.name,
      grade: subject.class?.grade,
      language,
      enqueued,
      skipped,
      adminId: session.user?.id,
    },
  });

  return NextResponse.json({
    enqueued,
    skipped,
    topicCount: topics.length,
    message: `Queued ${enqueued} notes jobs${skipped > 0 ? `, ${skipped} skipped (already queued)` : ''}.`,
  });
}
