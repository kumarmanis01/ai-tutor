import { PrismaClient, LanguageCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const badges: { key: string; name: string; description?: string; icon?: string }[] = [
    {
      key: 'first_question',
      name: 'First Question',
      description: 'Asked your first question',
      icon: '❓',
    },
    {
      key: 'referral_invite',
      name: 'Invite Friend',
      description: 'Invite a friend to join',
      icon: '🎉',
    },
    {
      key: 'challenge_winner',
      name: 'Challenge Winner',
      description: 'Completed a weekly challenge',
      icon: '🏆',
    },
  ];

  console.log('Seeding process started...');

  // Ensure existing rows have a valid LanguageCode (avoid nulls after schema change)
  try {
    await prisma.$executeRaw`UPDATE "User" SET language = 'en' WHERE language IS NULL`;
    console.log('Normalized existing users language to en where null');
  } catch (e) {
    console.warn('Could not normalize existing users language — continuing', String(e));
  }

  // Log badge creation
  console.log('Creating or updating badges...');
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { key: b.key },
      update: {},
      create: {
        key: b.key,
        name: b.name,
        description: b.description ?? null,
        icon: b.icon ?? null,
      },
    });
    console.log(`Badge processed: ${b.name}`);
  }

  // Log challenge creation
  console.log('Checking for existing weekly challenge...');
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - 1);
  const end = new Date(now);
  end.setUTCDate(now.getUTCDate() + 6);

  const existing = await prisma.challenge.findUnique({ where: { key: 'weekly_quiz_1' } });
  if (!existing) {
    console.log('No existing challenge found. Creating a new one...');
    const rewardBadge = await prisma.badge.findUnique({ where: { key: 'challenge_winner' } });
    await prisma.challenge.create({
      data: {
        key: 'weekly_quiz_1',
        title: 'Weekly Quiz: General Knowledge',
        description: 'Answer 10 short questions. Top performers get points and a badge.',
        startAt: start,
        endAt: end,
        rewardPoints: 50,
        rewardBadgeId: rewardBadge?.id ?? null,
      },
    });
    console.log('Weekly challenge created.');
  } else {
    console.log('Weekly challenge already exists.');
  }

  // Log test user creation
  console.log('Attempting to create or update test user...');
  const testUser = await prisma.user.upsert({
    where: { email: 'testuser@example.com' },
    update: {
      passwordHash: 'hashedpassword', // Use a static hash for demo
    },
    create: {
      name: 'Test User',
      email: 'testuser@example.com',
      emailVerified: new Date(),
      passwordHash: 'hashedpassword', // Use a static hash for demo
      language: LanguageCode.en,
    },
  });
  console.log(`Test user created or updated: ${JSON.stringify(testUser)}`);

  // Log payment creation
  console.log('Attempting to create payment for test user...');
  const payment = await prisma.payment.create({
    data: {
      userId: testUser.id,
      status: 'SUCCESS',
      amount: 599, // Example amount
      provider: 'test_provider', // Added provider field
      createdAt: new Date(),
      plan: 'Pro', // Set plan to Pro
      billingCycle: 'monthly', // Set billing cycle to monthly
    },
  });
  console.log(`Payment created for test user: ${JSON.stringify(payment)}`);

  const anotherTestUser = await prisma.user.upsert({
    where: { email: 'testuser@example.com' },
    update: {},
    create: {
      id: 'test-user-id',
      email: 'testuser@example.com',
      name: 'Test User',
      passwordHash: 'hashedpassword',
      language: LanguageCode.en,
    },
  });
  console.log(`Created or updated test user: ${JSON.stringify(anotherTestUser)}`);

  // Log all users
  console.log('Fetching all users in the database...');
  const allUsers = await prisma.user.findMany({ select: { name: true, email: true } });
  console.log(`All users in the database: ${JSON.stringify(allUsers)}`);

  // Seed a small question bank for Quick Practice
  console.log('Seeding sample questions for Quick Practice...');
  const existingQuestions = await prisma.question.count();
  if (existingQuestions === 0) {
    await prisma.question.createMany({
      data: [
        {
          subject: 'Math',
          chapter: 'Basic Algebra',
          grade: '7',
          board: 'CBSE',
          type: 'mcq',
          difficulty: 'easy',
          prompt: 'What is the value of x in 2x + 4 = 10?',
          choices: [{ key: '3', label: '3' }, { key: '4', label: '4' }, { key: '5', label: '5' }, { key: '6', label: '6' }],
          correctAnswer: '3',
          source: 'curated',
        } as any,
        {
          subject: 'Science',
          chapter: 'Acids & Bases',
          grade: '7',
          board: 'CBSE',
          type: 'numeric',
          difficulty: 'easy',
          prompt: 'pH of neutral water at 25°C is?',
          correctAnswer: '7',
          source: 'curated',
        } as any,
        {
          subject: 'English',
          chapter: 'Grammar',
          grade: '7',
          board: 'CBSE',
          type: 'short',
          difficulty: 'easy',
          prompt: 'Fill in the blank: She ____ to school every day.',
          correctAnswer: 'goes',
          source: 'curated',
        } as any,
      ],
    });
    console.log('Sample questions seeded.');
  } else {
    console.log(`Question bank already has ${existingQuestions} items.`);
  }

  console.log('Seeding process completed');
}

main()
  .catch((e) => {
    console.error(`Seed error: ${String(e)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
