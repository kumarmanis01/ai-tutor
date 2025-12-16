import { PrismaClient, UserRole } from '@prisma/client';

// Lightweight logger fallback so this script can be executed with node
// without importing project TypeScript modules.
const logger = {
  info: (...args: unknown[]) => console.log('[INFO]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
};

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    logger.error('Usage: node scripts/mark-admin.ts <user-email>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.error(`User not found for email: ${email}`);
    process.exit(1);
  }
  await prisma.user.update({ where: { email }, data: { role: UserRole.admin } });
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
