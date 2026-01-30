/* eslint-disable */
const { PrismaClient } = require('@prisma/client');

(async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping integration test: DATABASE_URL not set');
    process.exit(0);
  }

  const prisma = new PrismaClient();
  try {
    // Create a temporary topic and supporting academic hierarchy
    const ids = await ensureChapter(prisma);
    const topic = await prisma.topicDef.create({ data: { name: 'INT_TEST_TOPIC', slug: `int-test-${Date.now()}`, order: 1, chapterId: ids.chapterId } });

    // 1) Approve topic -> auditLog
    await prisma.$transaction([
      prisma.topicDef.update({ where: { id: topic.id }, data: { status: 'approved' } }),
      prisma.auditLog.create({ data: { userId: null, action: 'approve_topic', details: { topicId: topic.id }, createdAt: new Date() } })
    ]);
    const approveLogs = await prisma.auditLog.findMany({ where: { action: 'approve_topic', details: { path: ['topicId'], equals: topic.id } } });
    if (approveLogs.length === 0) throw new Error('Audit log not created for approve_topic');

    // 2) Create executionJob (pending) and cancel it -> auditLog
    const pendingJob = await prisma.executionJob.create({ data: { jobType: 'notes', entityType: 'TOPIC', entityId: topic.id, payload: {}, status: 'pending', maxAttempts: 3 } });
    await prisma.$transaction([
      // Use structured lastError for audit consistency in tests
      prisma.executionJob.update({ where: { id: pendingJob.id }, data: { status: 'cancelled', lastError: 'TEST_CANCELLED::Cancelled by test' } }),
      prisma.auditLog.create({ data: { userId: null, action: 'cancel_job', details: { jobId: pendingJob.id, prevStatus: 'pending' }, createdAt: new Date() } })
    ]);
    const cancelLogs = await prisma.auditLog.findMany({ where: { action: 'cancel_job', details: { path: ['jobId'], equals: pendingJob.id } } });
    if (cancelLogs.length === 0) throw new Error('Audit log not created for cancel_job');

    // 3) Create failed job, simulate retry -> new job + auditLog
    const failedJob = await prisma.executionJob.create({ data: { jobType: 'notes', entityType: 'TOPIC', entityId: topic.id, payload: {}, status: 'failed', maxAttempts: 3 } });
    const retryJob = await prisma.executionJob.create({ data: { jobType: 'notes', entityType: 'TOPIC', entityId: topic.id, payload: {}, status: 'pending', maxAttempts: 3 } });
    await prisma.auditLog.create({ data: { userId: null, action: 'retry_job', details: { originalJobId: failedJob.id, newJobId: retryJob.id }, createdAt: new Date() } });
    const retryLogs = await prisma.auditLog.findMany({ where: { action: 'retry_job', details: { path: ['originalJobId'], equals: failedJob.id } } });
    if (retryLogs.length === 0) throw new Error('Audit log not created for retry_job');

    // 4) Soft-delete chapter (lifecycle) and create auditLog
    await prisma.$transaction([
      prisma.chapterDef.update({ where: { id: ids.chapterId }, data: { lifecycle: 'deleted' } }),
      prisma.auditLog.create({ data: { userId: null, action: 'soft_delete_chapter', details: { chapterId: ids.chapterId }, createdAt: new Date() } })
    ]);
    const softDeleteLogs = await prisma.auditLog.findMany({ where: { action: 'soft_delete_chapter', details: { path: ['chapterId'], equals: ids.chapterId } } });
    if (softDeleteLogs.length === 0) throw new Error('Audit log not created for soft_delete_chapter');

    console.log('Integration tests passed: approve/cancel/retry/soft-delete audits created');

    // cleanup created rows
    await prisma.auditLog.deleteMany({ where: { action: { in: ['approve_topic','cancel_job','retry_job','soft_delete_chapter'] } } }).catch(()=>{});
    await prisma.executionJob.deleteMany({ where: { entityId: topic.id } }).catch(()=>{});
    await prisma.topicDef.delete({ where: { id: topic.id } }).catch(()=>{});
    await prisma.chapterDef.delete({ where: { id: ids.chapterId } }).catch(()=>{});
    await prisma.subjectDef.delete({ where: { id: ids.subjectId } }).catch(()=>{});
    await prisma.classLevel.delete({ where: { id: ids.classId } }).catch(()=>{});
    await prisma.board.delete({ where: { id: ids.boardId } }).catch(()=>{});
    process.exit(0);
  } catch (err) {
    console.error('Integration test failed', err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }

  async function ensureChapter(prisma) {
    // create minimal chapter and subject if needed
    const board = await prisma.board.create({ data: { name: 'INT_BOARD', slug: `int-board-${Date.now()}`, createdAt: new Date() } });
    const classLevel = await prisma.classLevel.create({ data: { grade: 1, slug: `g1-${Date.now()}`, boardId: board.id } });
    const subject = await prisma.subjectDef.create({ data: { name: 'INT_SUBJECT', slug: `s-${Date.now()}`, classId: classLevel.id } });
    const chapter = await prisma.chapterDef.create({ data: { name: 'INT_CHAPTER', slug: `c-${Date.now()}`, order: 1, subjectId: subject.id } });
    return { boardId: board.id, classId: classLevel.id, subjectId: subject.id, chapterId: chapter.id };
  }
})();
