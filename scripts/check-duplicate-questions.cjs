/**
 * Debug script to find duplicate questions in the database.
 * Usage: node scripts/check-duplicate-questions.cjs
 */

require('./_env-loader').loadEnv();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  console.log('Searching for questions with "smallest whole number"...\n');

  const questions = await prisma.question.findMany({
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

  console.log(`Found ${questions.length} questions with "smallest whole number"`);
  console.log('---');

  for (const q of questions) {
    console.log(`ID: ${q.id}`);
    console.log(`Prompt: ${q.prompt}`);
    console.log(`Choices: ${JSON.stringify(q.choices)}`);
    console.log(`Correct Answer: ${q.correctAnswer}`);
    console.log(`Difficulty: ${q.difficulty}`);
    console.log(`Status: ${q.status}`);
    console.log(`Topic: ${q.topicId}`);
    console.log('---');
  }

  // Now check for duplicates by content signature
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

  console.log('\nContent signature analysis:');
  console.log('---');

  const contentMap = new Map();
  for (const q of questions) {
    const key = getPracticeQuestionKey(q);
    if (!contentMap.has(key)) {
      contentMap.set(key, []);
    }
    contentMap.get(key).push(q.id);
  }

  for (const [key, ids] of contentMap.entries()) {
    if (ids.length > 1) {
      console.log(`DUPLICATE CONTENT KEY: ${key}`);
      console.log(`  IDs: ${ids.join(', ')}`);
    } else {
      console.log(`UNIQUE: ${key.substring(0, 60)}...`);
    }
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
