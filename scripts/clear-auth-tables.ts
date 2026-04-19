import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

async function main() {
  const confirm = process.env.CONFIRM === 'true';
  if (!confirm) {
    logger.error('Refusing to purge without CONFIRM=true. Set env and re-run.');
    process.exit(1);
  }

  logger.info('Purging NextAuth tables: Account, Session...');
  const sessionDel = await prisma.session.deleteMany({});
  const accountDel = await prisma.account.deleteMany({});

  logger.info(`Deleted Sessions: ${sessionDel.count}`);
  logger.info(`Deleted Accounts: ${accountDel.count}`);
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
