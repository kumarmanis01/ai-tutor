import { PrismaClient } from '@prisma/client';

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
  }

  // Create a sample weekly challenge if it doesn't already exist
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - 1);
  const end = new Date(now);
  end.setUTCDate(now.getUTCDate() + 6);

  const existing = await prisma.challenge.findUnique({ where: { key: 'weekly_quiz_1' } });
  if (!existing) {
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
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
