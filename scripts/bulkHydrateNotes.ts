/**
 * FILE OBJECTIVE:
 * - CLI script to trigger bulk notes hydration for all topics that don't have notes yet.
 * - Fills the content gap caused by syllabus jobs that didn't have cascadeAll enabled.
 *
 * LINKED UNIT TEST:
 * - tests/scripts/bulkHydrateNotes.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 *
 * EDIT LOG:
 * - 2026-01-22T17:00:00Z | copilot | Created for bulk notes hydration
 */

import { PrismaClient } from '@prisma/client';
import { enqueueNotesHydration } from '../lib/execution-pipeline/enqueueTopicHydration';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting bulk notes hydration...\n');

  // Find all topics that don't have any notes yet
  const topicsWithoutNotes = await prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      notes: { none: {} }
    },
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } }
            }
          }
        }
      }
    }
  });

  console.log(`📊 Found ${topicsWithoutNotes.length} topics without notes\n`);

  if (topicsWithoutNotes.length === 0) {
    console.log('✅ All topics already have notes!');
    return;
  }

  // Group by subject for better logging
  const bySubject = topicsWithoutNotes.reduce((acc, topic) => {
    const subjectName = topic.chapter?.subject?.name || 'Unknown';
    if (!acc[subjectName]) acc[subjectName] = [];
    acc[subjectName].push(topic);
    return acc;
  }, {} as Record<string, typeof topicsWithoutNotes>);

  console.log('📚 Topics by subject:');
  for (const [subject, topics] of Object.entries(bySubject)) {
    console.log(`  - ${subject}: ${topics.length} topics`);
  }
  console.log('');

  // Enqueue notes hydration for each topic
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const topic of topicsWithoutNotes) {
    try {
      const result = await enqueueNotesHydration({
        topicId: topic.id,
        language: 'en'
      });

      if (result.created) {
        console.log(`✅ Queued: ${topic.name} (${result.jobId})`);
        successCount++;
      } else {
        console.log(`⏭️ Skipped: ${topic.name} - ${result.reason}`);
        skipCount++;
      }
    } catch (err: any) {
      console.error(`❌ Error: ${topic.name} - ${err.message}`);
      errorCount++;
    }

    // Small delay to avoid overwhelming the queue
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Queued: ${successCount}`);
  console.log(`  ⏭️ Skipped: ${skipCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('\n🏁 Done! Check the worker logs for hydration progress.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
