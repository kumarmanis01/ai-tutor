/**
 * Check for subtle differences in question data that might cause dedup to fail.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== CHECKING FOR SUBTLE DATA DIFFERENCES ===\n');

  // Get all active questions for the problematic topic
  const allQuestions = await prisma.question.findMany({
    where: {
      topicId: 'cmner6osn0137hyvfsjtsvlme',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      difficulty: true,
    },
  });

  console.log(`Total questions: ${allQuestions.length}\n`);

  // Check for "smallest whole number" variants with byte-level analysis
  for (const q of allQuestions) {
    if (q.prompt && q.prompt.toLowerCase().includes('smallest')) {
      console.log(`ID: ${q.id}`);
      console.log(`Prompt: "${q.prompt}"`);
      console.log(`Prompt bytes: ${Buffer.from(q.prompt).toString('hex')}`);
      console.log(`Prompt length: ${q.prompt.length}`);
      console.log(`Choices: ${JSON.stringify(q.choices)}`);
      console.log(`Choices JSON bytes: ${Buffer.from(JSON.stringify(q.choices)).toString('hex')}`);
      console.log(`Correct Answer: "${q.correctAnswer}"`);
      console.log(`Difficulty: ${q.difficulty}`);
      console.log('---\n');
    }
  }

  // Now test the normalization logic with actual data
  console.log('=== TESTING NORMALIZATION ===\n');

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

  for (const q of allQuestions) {
    if (q.prompt && q.prompt.toLowerCase().includes('smallest')) {
      const promptKey = normalizeTextForQuestionKey(q.prompt);
      const choicesKey = stableValueForQuestionKey(q.choices);
      const answerKey = normalizeTextForQuestionKey(q.correctAnswer);
      const fullKey = `${promptKey}::${choicesKey}::${answerKey}`;
      
      console.log(`ID: ${q.id}`);
      console.log(`  Prompt Key: "${promptKey}"`);
      console.log(`  Choices Key: "${choicesKey}"`);
      console.log(`  Answer Key: "${answerKey}"`);
      console.log(`  Full Key: "${fullKey}"`);
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
