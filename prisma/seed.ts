import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

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
  console.log('Test user created or updated:', testUser);

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
  console.log('Payment created for test user:', payment);

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
  console.log('Created or updated test user:', anotherTestUser);

  // Log all users
  console.log('Fetching all users in the database...');
  const allUsers = await prisma.user.findMany({ select: { name: true, email: true } });
  console.log('All users in the database:', allUsers);

  console.log('Seeding process completed');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
