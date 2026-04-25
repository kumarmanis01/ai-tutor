#!/usr/bin/env ts-node
/**
 * Backfill topicId on Question rows that were created before the
 * canonical topic identity was enforced.
 *
 * Strategy 1: Match Question.id → GeneratedQuestion.id → GeneratedTest.topicId
 *   (promoteToQuestionBank reuses the GeneratedQuestion ID as the Question ID)
 *
 * Strategy 2: Match Question.chapter string → ChapterDef.name/slug → first TopicDef
 *   (fallback for AI-generated or manually-created questions)
 *
 * Usage:
 *   npx ts-node scripts/backfill-topic-id.ts
 *   npx ts-node scripts/backfill-topic-id.ts --dry-run
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Backfill Question.topicId ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const questions = await prisma.question.findMany({
    where: { topicId: null },
    select: { id: true, chapter: true, subject: true },
  });

  console.log(`Found ${questions.length} questions without topicId\n`);
  if (questions.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  let matchedByGenerated = 0;
  let matchedByChapter = 0;
  let unmatched = 0;

  // Pre-load chapter → first topic mapping for Strategy 2
  const chapters = await prisma.chapterDef.findMany({
    where: { lifecycle: 'active' },
    select: {
      name: true,
      slug: true,
      topics: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 },
    },
  });
  const chapterToTopicId = new Map<string, string>();
  for (const ch of chapters) {
    const tid = ch.topics[0]?.id;
    if (tid) {
      chapterToTopicId.set(ch.name.toLowerCase(), tid);
      chapterToTopicId.set(ch.slug.toLowerCase(), tid);
    }
  }

  // Pre-load GeneratedQuestion → topicId mapping for Strategy 1
  const questionIds = questions.map((q) => q.id);
  const generatedRows = await prisma.generatedQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, test: { select: { topicId: true } } },
  });
  const gqToTopicId = new Map<string, string>();
  for (const gq of generatedRows) {
    if (gq.test.topicId) gqToTopicId.set(gq.id, gq.test.topicId);
  }

  for (const q of questions) {
    let topicId: string | null = null;

    // Strategy 1: direct ID match from GeneratedQuestion
    topicId = gqToTopicId.get(q.id) || null;
    if (topicId) {
      matchedByGenerated++;
    }

    // Strategy 2: match by chapter string
    if (!topicId && q.chapter) {
      topicId = chapterToTopicId.get(q.chapter.toLowerCase()) || null;
      if (topicId) matchedByChapter++;
    }

    if (!topicId) {
      unmatched++;
      continue;
    }

    if (!DRY_RUN) {
      await prisma.question.update({
        where: { id: q.id },
        data: { topicId },
      });
    }
  }

  console.log('Results:');
  console.log(`  Matched via GeneratedQuestion: ${matchedByGenerated}`);
  console.log(`  Matched via chapter string:    ${matchedByChapter}`);
  console.log(`  Unmatched (skipped):           ${unmatched}`);
  console.log(`  Total processed:               ${questions.length}`);
  if (DRY_RUN) console.log('\n  (dry run -- no writes performed)');

  logger.info('[BACKFILL_TOPIC_ID]', {
    total: questions.length,
    matchedByGenerated,
    matchedByChapter,
    unmatched,
    dryRun: DRY_RUN,
  });
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
