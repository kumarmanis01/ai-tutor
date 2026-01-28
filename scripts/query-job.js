#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const hydrationId = args[0];
  const executionId = args[1];
  if (!hydrationId && !executionId) {
    console.error('Usage: node scripts/query-job.js <hydrationId> [executionId]');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    if (hydrationId) {
      const h = await prisma.hydrationJob.findUnique({ where: { id: hydrationId } });
      console.log('HydrationJob:', JSON.stringify(h, null, 2));
      if (h && h.subjectId) {
        const chapters = await prisma.chapterDef.findMany({ where: { subjectId: h.subjectId } });
        console.log('Chapters for subjectId', h.subjectId, 'count=', chapters.length);
      }
    }
    if (executionId) {
      const e = await prisma.executionJob.findUnique({ where: { id: executionId } });
      console.log('ExecutionJob:', JSON.stringify(e, null, 2));
      const logs = await prisma.jobExecutionLog.findMany({ where: { jobId: executionId }, orderBy: { createdAt: 'asc' } });
      console.log('JobExecutionLog entries:', JSON.stringify(logs, null, 2));
    }
    // Also fetch recent AI content logs (most recent 10) to inspect LLM responses
    const aiLogs = await prisma.aIContentLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    console.log('Recent AIContentLog entries (summary):');
    for (const a of aiLogs) {
      console.log({ id: a.id, model: a.model, promptType: a.promptType ?? a.prompttype ?? null, topicId: a.topicId ?? a.topic_id ?? null, createdAt: a.createdAt });
    }
  }
  catch (err) {
    console.error('Query error', err);
    process.exitCode = 1;
  }
  finally {
    await prisma.$disconnect();
  }
}

main();
