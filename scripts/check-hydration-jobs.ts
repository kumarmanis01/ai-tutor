/**
 * FILE OBJECTIVE:
 * - Temporary script to check hydration job statuses and payloads for debugging
 *
 * LINKED UNIT TEST:
 * - N/A (debug script)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | Created for hydration debugging
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== HYDRATION JOBS ===\n');
  
  const jobs = await prisma.hydrationJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  for (const job of jobs) {
    console.log(`ID: ${job.id}`);
    console.log(`Type: ${job.jobType}`);
    console.log(`Status: ${job.status}`);
    console.log(`Topic: ${job.topicId || 'N/A'}`);
    console.log(`Chapter: ${job.chapterId || 'N/A'}`);
    console.log(`Payload: ${JSON.stringify(job.payload)}`);
    console.log(`Error: ${job.lastError || 'None'}`);
    console.log(`Created: ${job.createdAt}`);
    console.log('---\n');
  }
  
  console.log('\n=== TOPIC COUNTS ===');
  const topicCount = await prisma.topicDef.count();
  const topicNoteCount = await prisma.topicNote.count();
  console.log(`TopicDef: ${topicCount}`);
  console.log(`TopicNote: ${topicNoteCount}`);
  
  console.log('\n=== TOPICS WITHOUT NOTES (first 10) ===');
  const topicsWithoutNotes = await prisma.topicDef.findMany({
    where: {
      notes: { none: {} }
    },
    take: 10,
    select: { id: true, name: true, chapterId: true }
  });
  console.log(topicsWithoutNotes);
  
  console.log('\n=== SYLLABUS JOBS DETAILS ===');
  const syllabusJobs = await prisma.hydrationJob.findMany({
    where: { jobType: 'syllabus' }
  });
  for (const sj of syllabusJobs) {
    console.log(`ID: ${sj.id}`);
    console.log(`Payload type: ${typeof sj.payload}`);
    console.log(`Payload content: ${JSON.stringify(sj.payload)}`);
    console.log(`Result: ${JSON.stringify(sj.result)}`);
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
