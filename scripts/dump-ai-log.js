#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const id = args[0];
  const hydrationId = args[1];
  if (!id && !hydrationId) {
    console.error('Usage: node scripts/dump-ai-log.js <aiLogId> [hydrationJobId]');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    if (id) {
      const a = await prisma.aIContentLog.findUnique({ where: { id } });
      console.log('AIContentLog:', JSON.stringify(a, null, 2));
    }
    if (hydrationId) {
      const logs = await prisma.aIContentLog.findMany({ where: { hydrationJobId: hydrationId }, orderBy: { createdAt: 'desc' }, take: 10 });
      console.log('AIContentLog for hydrationId', hydrationId, ':');
      console.log(JSON.stringify(logs, null, 2));
    }
  } catch (err) {
    console.error('Error', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
