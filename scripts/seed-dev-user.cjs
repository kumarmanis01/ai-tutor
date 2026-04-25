const { prisma } = require('../lib/prisma');

async function main() {
  try {
    const email = process.argv[2] || 'dev.student@example.com';
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        language: 'en',
        role: 'user',
      },
    });
    console.log('Seeded dev user:', user.id, user.email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
