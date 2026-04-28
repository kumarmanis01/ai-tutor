#!/usr/bin/env node
/**
 * Debug helper: inspect a HydrationJob, Outbox rows, and content counts.
 * Usage: node scripts/run-debug-hydration-job.cjs <hydrationJobId>
 */
const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/run-debug-hydration-job.cjs <hydrationJobId>');
  process.exit(2);
}

// Load the Prisma client from the compiled `dist` if available (preferred),
// otherwise attempt to import the compiled file via file URL. This avoids
// requiring TypeScript source directly from Node.
let prisma;

async function loadPrisma() {
  const { pathToFileURL } = await import('url');
  const fs = await import('fs');
  const path = await import('path');

  const distPath = path.join(process.cwd(), 'dist', 'lib', 'prisma.js');
  if (fs.existsSync(distPath)) {
    const prismaFileUrl = pathToFileURL(distPath).href;
    const mod = await import(prismaFileUrl);
    return mod.prisma;
  }

  // As a last resort, try loading the project's compiled CommonJS output under lib/
  const libPath = path.join(process.cwd(), 'lib', 'prisma.js');
  if (fs.existsSync(libPath)) {
    const prismaFileUrl = pathToFileURL(libPath).href;
    const mod = await import(prismaFileUrl);
    return mod.prisma;
  }

  throw new Error('Could not find compiled prisma client in dist/lib/prisma.js or lib/prisma.js');
}

(async () => {
  try {
    console.log('DEBUG: HydrationJob id=', jobId);

    // Load the compiled Prisma client dynamically
    prisma = await loadPrisma();

    const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
    if (!job) {
      console.log('HydrationJob not found');
      process.exit(0);
    }

    console.log('\n--- HYDRATION_JOB ---');
    console.log(JSON.stringify(job, null, 2));

    // Outbox rows: try exact hydrationJobId match in meta (if stored), else recent rows
    let outboxRows = [];
    try {
      outboxRows = await prisma.outbox.findMany({
        where: { meta: { path: ['hydrationJobId'], equals: jobId } },
      });
    } catch (_) {
      // Prisma JSON path may not be available depending on schema/provider; fallback
      outboxRows = await prisma.outbox.findMany({
        where: { queue: 'content-hydration' },
        orderBy: { sentAt: 'desc' },
        take: 20,
      });
    }

    console.log('\n--- OUTBOX ROWS (showing up to 20) ---');
    console.log('count=', outboxRows.length);
    outboxRows.forEach((r) => {
      console.log('id:', r.id, 'queue:', r.queue, 'attempts:', r.attempts, 'sentAt:', r.sentAt);
      try {
        console.log('meta:', JSON.stringify(r.meta));
      } catch {
        console.log('meta: <unserializable>');
      }
      try {
        console.log('payload:', JSON.stringify(r.payload));
      } catch {
        console.log('payload: <unserializable>');
      }
      console.log('---');
    });

    // Content counts by subjectId where available
    const subjectId = job.subjectId || job.inputParams?.subjectId || null;
    if (subjectId) {
      const chapterCount = await prisma.chapterDef
        .count({ where: { subjectId } })
        .catch(() => null);
      const topicCount = await prisma.topicDef.count({ where: { subjectId } }).catch(() => null);
      const notesCount = await prisma.note.count({ where: { subjectId } }).catch(() => null);
      const questionsCount = await prisma.question
        .count({ where: { subjectId } })
        .catch(() => null);

      console.log('\n--- CONTENT COUNTS (by subjectId=', subjectId, ') ---');
      console.log('chapters:', chapterCount);
      console.log('topics:', topicCount);
      console.log('notes:', notesCount);
      console.log('questions:', questionsCount);
    } else {
      console.log('\nNo subjectId available in job to scope content counts.');
    }

    // Check for execution logs / linked jobs if schema supports it
    try {
      const executions = await prisma.jobExecutionLog.findMany({
        where: { jobId: jobId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      console.log('\n--- EXECUTION LOGS --- count=', executions.length);
      executions.forEach((e) => console.log(JSON.stringify(e)));
    } catch (_) {
      // ignore if model not present
    }

    process.exit(0);
  } catch (err) {
    console.error('Error running debug script:', err);
    process.exit(1);
  }
})();
