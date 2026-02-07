const { PrismaClient } = require('@prisma/client');

const logger = console;
const email = process.argv[2];
const name = process.argv[3] || (email ? email.split('@')[0] : undefined);

if (!email) {
  logger.error('Usage: node scripts/create-user.cjs <email> [displayName]');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info(`User already exists: ${email} (id=${existing.id})`);
    return;
  }
  const created = await prisma.user.create({
    data: {
      email,
      name,
      language: 'en',
      role: 'user'
    }
  });
  logger.info(`Created user ${email} with id ${created.id}`);
}

main()
  .catch((e) => {
    logger.error('Error creating user:', e && e.message ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
