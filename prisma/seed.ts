import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '@/lib/logger';

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

  logger.add('Seeding process started...', { className: 'prisma/seed', methodName: 'main' });

  // Log badge creation
  logger.add('Creating or updating badges...', { className: 'prisma/seed', methodName: 'badges' });
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
    logger.add(`Badge processed: ${b.name}`, { className: 'prisma/seed', methodName: 'badges' });
  }

  // Log challenge creation
  logger.add('Checking for existing weekly challenge...', { className: 'prisma/seed', methodName: 'weeklyChallenge' });
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - 1);
  const end = new Date(now);
  end.setUTCDate(now.getUTCDate() + 6);

  const existing = await prisma.challenge.findUnique({ where: { key: 'weekly_quiz_1' } });
  if (!existing) {
    logger.add('No existing challenge found. Creating a new one...', { className: 'prisma/seed', methodName: 'weeklyChallenge' });
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
    logger.add('Weekly challenge created.', { className: 'prisma/seed', methodName: 'weeklyChallenge' });
  } else {
    logger.add('Weekly challenge already exists.', { className: 'prisma/seed', methodName: 'weeklyChallenge' });
  }

  // Log test user creation
  logger.add('Attempting to create or update test user...', { className: 'prisma/seed', methodName: 'testUser' });
  const hashedPassword = await bcrypt.hash('hashedpassword', 10); // Hash the password
  const testUser = await prisma.user.upsert({
    where: { email: 'testuser@example.com' },
    update: {
      passwordHash: hashedPassword, // Update the password if the user exists
    },
    create: {
      name: 'Test User',
      email: 'testuser@example.com',
      emailVerified: new Date(),
      passwordHash: hashedPassword, // Use the hashed password
    },
  });
  logger.add(`Test user created or updated: ${JSON.stringify(testUser)}`, { className: 'prisma/seed', methodName: 'testUser' });

  // Log payment creation
  logger.add('Attempting to create payment for test user...', { className: 'prisma/seed', methodName: 'payments' });
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
  logger.add(`Payment created for test user: ${JSON.stringify(payment)}`, { className: 'prisma/seed', methodName: 'payments' });

  const anotherTestUser = await prisma.user.upsert({
    where: { email: 'testuser@example.com' },
    update: {},
    create: {
      id: 'test-user-id',
      email: 'testuser@example.com',
      name: 'Test User',
      passwordHash: 'hashedpassword',
    },
  });
  logger.add(`Created or updated test user: ${JSON.stringify(anotherTestUser)}`, { className: 'prisma/seed', methodName: 'testUser' });

  // Log all users
  logger.add('Fetching all users in the database...', { className: 'prisma/seed', methodName: 'report' });
  const allUsers = await prisma.user.findMany({ select: { name: true, email: true } });
  logger.add(`All users in the database: ${JSON.stringify(allUsers)}`, { className: 'prisma/seed', methodName: 'report' });

  logger.add('Seeding process completed', { className: 'prisma/seed', methodName: 'main' });
}

main()
  .catch((e) => {
    logger.error(`Seed error: ${String(e)}`, { className: 'prisma/seed', methodName: 'main' });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
