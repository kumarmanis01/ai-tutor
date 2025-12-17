#!/usr/bin/env node
/**
 * Dev-only Job Worker
 * - Polls for pending `ExecutionJob` rows and processes them deterministically.
 * - Creates placeholder `ChapterDef` / `TopicDef` and `AIContentLog` entries for `syllabus` jobs.
 * - Logs activity to the console for developer visibility.
 *
 * This is strictly a development helper and MUST NOT be used in production.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const WORKER_ID = `dev-worker-${Date.now()}`;

async function pickAndLockJob() {
  // Find a pending job
  const job = await prisma.executionJob.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
  if (!job) return null;

  // Try to claim the job by updating status -> running and setting lockedAt/lockedBy
  const locked = await prisma.executionJob.updateMany({
    where: { id: job.id, status: 'pending' },
    data: { status: 'running', lockedAt: new Date(), lockedBy: WORKER_ID },
  });

  if (locked.count === 0) return null; // someone else claimed it
  return await prisma.executionJob.findUnique({ where: { id: job.id } });
}

async function processJob(job) {
  console.log(`[worker] Processing job ${job.id} type=${job.jobType} entity=${job.entityType}:${job.entityId}`);
  try {
    if (job.jobType === 'syllabus') {
      // If subject-level syllabus, create a sample chapter and topics
      if (job.entityType === 'SUBJECT') {
        const subjectId = job.entityId;
        // create a chapter
        const chapter = await prisma.chapterDef.create({ data: { name: `Auto Chapter (${new Date().toISOString()})`, slug: `auto-ch-${Date.now()}`, order: 1, subjectId, createdAt: new Date() } });
        console.log(`[worker] Created Chapter ${chapter.id} for Subject ${subjectId}`);

        // create a few topics
        const topics = [];
        for (let i = 1; i <= 3; i++) {
          const t = await prisma.topicDef.create({ data: { name: `Auto Topic ${i}`, slug: `auto-topic-${Date.now()}-${i}`, order: i, chapterId: chapter.id, createdAt: new Date() } });
          topics.push(t);
          console.log(`[worker] Created Topic ${t.id}`);
        }

        // Log AIContentLog entry
        await prisma.aIContentLog.create({ data: {
          model: 'dev-synth',
          promptType: 'syllabus-synthesis',
          board: null,
          grade: null,
          subject: null,
          chapter: chapter.name,
          topic: topics.map((x) => x.name).join(','),
          language: 'en',
          success: true,
          requestBody: job.payload ?? {},
          responseBody: { chapterId: chapter.id, topics: topics.map((t) => ({ id: t.id, name: t.name })) },
          createdAt: new Date(),
        } });
        console.log(`[worker] Created AIContentLog for job ${job.id}`);
      }
    }

    // mark job completed
    await prisma.executionJob.update({ where: { id: job.id }, data: { status: 'completed', updatedAt: new Date() } });
    console.log(`[worker] Job ${job.id} completed`);
  } catch (err) {
    console.error(`[worker] Job ${job.id} failed:`, err);
    await prisma.executionJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: String(err), updatedAt: new Date() } });
  }
}

async function loop() {
  try {
    const job = await pickAndLockJob();
    if (job) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[worker] error in loop', err);
  }
}

console.log('[worker] Dev job worker starting. Polling for jobs every 3s. Press Ctrl+C to stop.');
setInterval(loop, 3000);
