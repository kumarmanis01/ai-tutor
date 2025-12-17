/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAdminOrModerator } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdminOrModerator();
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    const job = await prisma.executionJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Build an enriched job view for the admin UI
    const payloadObj = typeof job.payload === 'object' && job.payload !== null ? (job.payload as any) : {};
    const enriched: any = {
      id: job.id,
      jobType: job.jobType,
      entityType: job.entityType,
      entityId: job.entityId,
      entityName: null,
      board: null,
      classLevel: null,
      language: payloadObj.language ?? null,
      status: job.status,
      retries: job.attempts ?? 0,
      error: job.lastError ?? null,
      payload: job.payload ?? {},
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    try {
      switch (job.entityType) {
        case 'SUBJECT': {
          const subject = await prisma.subjectDef.findUnique({ where: { id: job.entityId }, include: { class: { include: { board: true } } } });
          if (subject) {
            enriched.entityName = subject.name;
            enriched.classLevel = subject.class?.grade ?? null;
            enriched.board = subject.class?.board?.name ?? null;
          }
          break;
        }
        case 'CLASS': {
          const cls = await prisma.classLevel.findUnique({ where: { id: job.entityId }, include: { board: true } });
          if (cls) {
            enriched.entityName = `Class ${cls.grade}`;
            enriched.classLevel = cls.grade;
            enriched.board = cls.board?.name ?? null;
          }
          break;
        }
        case 'BOARD': {
          const board = await prisma.board.findUnique({ where: { id: job.entityId } });
          if (board) enriched.entityName = board.name;
          break;
        }
        case 'CHAPTER': {
          const chapter = await prisma.chapterDef.findUnique({ where: { id: job.entityId }, include: { subject: { include: { class: { include: { board: true } } } } } });
          if (chapter) {
            enriched.entityName = chapter.name;
            enriched.classLevel = chapter.subject?.class?.grade ?? null;
            enriched.board = chapter.subject?.class?.board?.name ?? null;
          }
          break;
        }
        case 'TOPIC': {
          const topic = await prisma.topicDef.findUnique({ where: { id: job.entityId }, include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } } });
          if (topic) {
            enriched.entityName = topic.name;
            enriched.classLevel = topic.chapter?.subject?.class?.grade ?? null;
            enriched.board = topic.chapter?.subject?.class?.board?.name ?? null;
          }
          break;
        }
        default:
          break;
      }
    } catch (e) {
      logger?.warn?.('Failed to enrich job entity relations', { err: e, jobId: job.id });
    }

    return NextResponse.json({ job: enriched });
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/jobs/[id] error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// GET timeline: /api/admin/content-engine/jobs/[id]/timeline
export async function timeline(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
    const logs = await prisma.jobExecutionLog.findMany({ where: { jobId: id }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ logs });
  } catch (err) {
    logger?.error?.('GET /api/admin/content-engine/jobs/[id]/timeline error', { err });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
