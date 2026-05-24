/**
 * Deep dive into the duplicate question issue.
 * Check if the same question row is being returned twice.
 */

require('./_env-loader').loadEnv();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  console.log('=== DETAILED DUPLICATE ANALYSIS ===\n');

  // Get all questions for the topic that has "smallest whole number"
  const problemQuestions = await prisma.question.findMany({
    where: {
      prompt: {
        contains: 'smallest whole number',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      difficulty: true,
      status: true,
      topicId: true,
    },
  });

  const topicId = problemQuestions[0]?.topicId;
  console.log(`Topic ID: ${topicId}`);
  console.log(`\nTotal "smallest whole number" questions in DB: ${problemQuestions.length}\n`);

  for (const q of problemQuestions) {
    console.log(`ID: ${q.id}`);
    console.log(`Difficulty: ${q.difficulty}`);
    console.log(`Choices: ${JSON.stringify(q.choices)}`);
    console.log(`---`);
  }

  // Now check ALL active questions for this topic
  if (!topicId) {
    console.log('No topic found!');
    await prisma.$disconnect();
    return;
  }

  const allQuestions = await prisma.question.findMany({
    where: {
      topicId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      difficulty: true,
    },
    take: 100, // Limit to first 100
  });

  console.log(`\nTotal ACTIVE questions in topic: ${allQuestions.length}`);

  // Check for exact content duplicates
  console.log('\n=== CHECKING FOR CONTENT DUPLICATES ===\n');

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

  const contentMap = new Map();
  for (const q of allQuestions) {
    const key = getPracticeQuestionKey(q);
    if (!contentMap.has(key)) {
      contentMap.set(key, []);
    }
    contentMap.get(key).push(q);
  }

  let duplicateCount = 0;
  for (const [key, questions] of contentMap.entries()) {
    if (questions.length > 1) {
      duplicateCount++;
      console.log(`DUPLICATE FOUND: ${questions.length} rows with same content`);
      console.log(`Content Key: ${key}`);
      for (const q of questions) {
        console.log(`  - ID: ${q.id}, Difficulty: ${q.difficulty}`);
      }
      console.log('');
    }
  }

  if (duplicateCount === 0) {
    console.log('No content duplicates found in the database!');
    console.log('\nIf the user is seeing duplicates, the issue is likely:');
    console.log('1. Dedup function is not being called');
    console.log('2. There is a bug in the random selection logic');
    console.log('3. Questions are being cached or re-rendered incorrectly on the client');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
