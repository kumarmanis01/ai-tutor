#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/check-user.cjs <email>');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({ where: { email } });
    console.log(JSON.stringify(u, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
