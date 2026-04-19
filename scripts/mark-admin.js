// Lightweight JS equivalent of scripts/mark-admin.ts
const { PrismaClient } = require('@prisma/client');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    logger.error('Usage: node scripts/mark-admin.js <user-email>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.error(`User not found for email: ${email}`);
    process.exit(1);
  }
  await prisma.user.update({ where: { email }, data: { role: 'admin' } });
  logger.info(`User ${email} marked as admin.`);
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
