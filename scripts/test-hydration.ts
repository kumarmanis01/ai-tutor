/**
 * FILE OBJECTIVE:
 * - Test script to trigger syllabus hydration for validation purposes.
 * 
 * LINKED UNIT TEST:
 * - None (test script only)
 * 
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * 
 * EDIT LOG:
 * - 2026-01-23T04:30:00Z | copilot | Created for hydration pipeline validation
 */

import { PrismaClient } from '@prisma/client';
import { submitJob } from '../lib/execution-pipeline/submitJob';

const prisma = new PrismaClient();

async function main() {
  // Get CBSE Grade 6 Mathematics
  const subject = await prisma.subjectDef.findFirst({
    where: {
      slug: 'mathematics',
      class: {
        grade: 6,
        board: {
          slug: 'cbse',
        },
      },
    },
    include: {
      class: {
        include: {
          board: true,
        },
      },
    },
  });

  if (!subject) {
    console.error('❌ Subject not found. Run seed script first.');
    process.exit(1);
  }

  console.log('✅ Found subject:', {
    id: subject.id,
    name: subject.name,
    board: subject.class?.board?.name,
    grade: subject.class?.grade,
  });

  // Check if already has chapters
  const existingChapters = await prisma.chapterDef.count({
    where: { subjectId: subject.id, lifecycle: 'active' },
  });

  if (existingChapters > 0) {
    console.log(`⚠️ Subject already has ${existingChapters} chapters. Checking for pending jobs...`);
  }

  // Check for existing pending jobs
  const pendingJobs = await prisma.hydrationJob.findMany({
    where: {
      subjectId: subject.id,
      status: { in: ['pending', 'running'] },
    },
  });

  if (pendingJobs.length > 0) {
    console.log(`⏳ Found ${pendingJobs.length} pending/running jobs:`, pendingJobs.map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
    })));
    console.log('Worker should pick these up automatically.');
    process.exit(0);
  }

  // Submit new syllabus job
  console.log('\n🚀 Submitting syllabus job...');
  
  try {
    const result = await submitJob({
      jobType: 'syllabus',
      entityType: 'SUBJECT',
      entityId: subject.id,
      payload: {
        language: 'en',
        difficulties: ['easy', 'medium', 'hard'],
        cascadeAll: true,
      },
      maxAttempts: 3,
    });

    console.log('✅ Job submitted:', {
      jobId: result.jobId,
      existing: result.existing,
      executionJobId: (result as any).executionJobId ?? 'N/A',
    });

    // Poll for completion
    console.log('\n⏳ Waiting for job completion (polling every 5s)...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const job = await prisma.hydrationJob.findUnique({
        where: { id: result.jobId },
      });

      if (!job) {
        console.log(`❌ Job ${result.jobId} not found`);
        break;
      }

      console.log(`[${attempts * 5}s] Job status: ${job.status}${job.lastError ? ` (error: ${job.lastError})` : ''}`);

      if (job.status === 'completed') {
        console.log('\n🎉 Syllabus job completed!');
        
        // Show created chapters and topics
        const chapters = await prisma.chapterDef.findMany({
          where: { subjectId: subject.id, lifecycle: 'active' },
          include: {
            TopicDef: {
              where: { lifecycle: 'active' },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        });

        console.log(`\n📚 Created ${chapters.length} chapters:`);
        for (const ch of chapters) {
          console.log(`  ${ch.order}. ${ch.name} (${ch.TopicDef.length} topics)`);
          for (const t of ch.TopicDef.slice(0, 3)) {
            console.log(`     - ${t.order}. ${t.name}`);
          }
          if (ch.TopicDef.length > 3) {
            console.log(`     ... and ${ch.TopicDef.length - 3} more topics`);
          }
        }

        // Check for downstream jobs
        const downstreamJobs = await prisma.hydrationJob.count({
          where: {
            status: 'pending',
            type: { in: ['notes', 'questions', 'assemble'] },
          },
        });

        console.log(`\n📝 Downstream jobs queued: ${downstreamJobs}`);
        break;
      }

      if (job.status === 'failed') {
        console.log(`\n❌ Job failed: ${job.lastError}`);
        break;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('\n⚠️ Timeout waiting for job completion');
    }
  } catch (error) {
    console.error('❌ Error submitting job:', error);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
