/**
 * Comprehensive test to reproduce and validate the dedup issue.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== SIMULATING PRACTICE RESOLUTION LOGIC ===\n');

  const topicId = 'cmner6osn0137hyvfsjtsvlme';

  // Simulate the exact query paths from resolvePractice
  console.log('Step 1: Query medium difficulty questions');
  const mediumQuestions = await prisma.question.findMany({
    where: { topicId, difficulty: 'medium', status: 'ACTIVE' },
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      difficulty: true,
    },
  });

  console.log(`Found ${mediumQuestions.length} medium questions`);
  for (const q of mediumQuestions) {
    console.log(`  - ${q.id}: ${q.prompt}`);
  }
  console.log('');

  // Simulate dedup
  function normalizeTextForQuestionKey(input) {
    return (input ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function stableValueForQuestionKey(value) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableValueForQuestionKey(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const obj = value;
      return `{${Object.keys(obj)
        .sort()
        .map((key) => `${key}:${stableValueForQuestionKey(obj[key])}`)
        .join(',')}}`;
    }
    if (typeof value === 'string') {
      return normalizeTextForQuestionKey(value);
    }
    return String(value ?? '');
  }

  function getPracticeQuestionKey(question) {
    const promptKey = normalizeTextForQuestionKey(question.prompt);
    const choicesKey = stableValueForQuestionKey(question.choices);
    const answerKey = normalizeTextForQuestionKey(question.correctAnswer);
    return `${promptKey}::${choicesKey}::${answerKey}`;
  }

  function dedupePracticeQuestions(questions) {
    const seen = new Set();
    const deduped = [];
    const skipped = [];

    for (const question of questions) {
      const key = getPracticeQuestionKey(question);
      if (seen.has(key)) {
        skipped.push({ id: question.id, key });
        continue;
      }
      seen.add(key);
      deduped.push(question);
    }

    return { deduped, skipped };
  }

  console.log('Step 2: Dedupe medium questions');
  const { deduped: dedupedMedium, skipped: skippedMedium } = dedupePracticeQuestions(mediumQuestions);
  console.log(`After dedup: ${dedupedMedium.length} questions`);
  if (skippedMedium.length > 0) {
    console.log('  Skipped (duplicates):');
    for (const skip of skippedMedium) {
      console.log(`    - ${skip.id}`);
    }
  }
  console.log('');

  // Simulate pick random (if we have 2, we want 5, so pick all 2)
  console.log('Step 3: Pick random 5 from medium (we have 2, so get all 2)');
  console.log(`  Selected: ${dedupedMedium.map((q) => q.id).join(', ')}`);
  console.log('');

  // Need fallback since 2 < 5
  console.log('Step 4: Fallback - query all active questions');
  const allQuestions = await prisma.question.findMany({
    where: { topicId, status: 'ACTIVE' },
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      difficulty: true,
    },
  });

  console.log(`Found ${allQuestions.length} total questions`);
  for (const q of allQuestions) {
    console.log(`  - ${q.id}: ${q.prompt} (${q.difficulty})`);
  }
  console.log('');

  // Merge
  console.log('Step 5: Merge primary (2) + fallback (6)');
  const merged = [...dedupedMedium, ...allQuestions];
  console.log(`Merged array has ${merged.length} items`);
  console.log('  IDs in merged:', merged.map((q) => q.id).join(', '));
  console.log('');

  // Dedup merged
  console.log('Step 6: Dedupe merged array');
  const { deduped: dedupedMerged, skipped: skippedMerged } = dedupePracticeQuestions(merged);
  console.log(`After dedup: ${dedupedMerged.length} questions`);
  if (skippedMerged.length > 0) {
    console.log('  Skipped (duplicates):');
    for (const skip of skippedMerged) {
      console.log(`    - ${skip.id}`);
    }
  }
  console.log('  Final IDs:', dedupedMerged.map((q) => q.id).join(', '));
  console.log('');

  // Check for any remaining duplicates
  console.log('Step 7: Check final result for duplicates by ID');
  const finalIds = dedupedMerged.map((q) => q.id);
  const idSet = new Set(finalIds);
  if (idSet.size === finalIds.length) {
    console.log(`✓ No duplicate IDs (${finalIds.length} unique out of ${finalIds.length})`);
  } else {
    console.log(`✗ DUPLICATE IDs FOUND!`);
    const counts = new Map();
    for (const id of finalIds) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const [id, count] of counts.entries()) {
      if (count > 1) {
        console.log(`  - ${id} appears ${count} times`);
      }
    }
  }

  console.log('');
  console.log('Step 8: Check for content key duplicates');
  const keyMap = new Map();
  for (const q of dedupedMerged) {
    const key = getPracticeQuestionKey(q);
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key).push(q.id);
  }

  let contentDuplicates = 0;
  for (const [key, ids] of keyMap.entries()) {
    if (ids.length > 1) {
      contentDuplicates++;
      console.log(`✗ DUPLICATE CONTENT KEY: ${ids.length} rows`);
      console.log(`  IDs: ${ids.join(', ')}`);
    }
  }

  if (contentDuplicates === 0) {
    console.log('✓ No duplicate content keys');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
