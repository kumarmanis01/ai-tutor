import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const confirm = process.env.CONFIRM === 'true';
  if (!confirm) {
    console.error('Refusing to purge without CONFIRM=true. Set env and re-run.');
    process.exit(1);
  }

  console.log('Purging NextAuth tables: Account, Session...');
  const sessionDel = await prisma.session.deleteMany({});
  const accountDel = await prisma.account.deleteMany({});

  console.log(`Deleted Sessions: ${sessionDel.count}`);
  console.log(`Deleted Accounts: ${accountDel.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
