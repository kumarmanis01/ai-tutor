require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: node scripts/inspect-outbox.cjs <hydrationJobId>');
    process.exit(2);
  }

  const rows = await p.outbox.findMany({
    where: { payload: { path: ['jobId'], equals: jobId } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!rows || rows.length === 0) {
    console.log('No Outbox rows found for jobId', jobId);
    console.log('\nFalling back to latest 20 Outbox rows for inspection:\n');
    const recent = await p.outbox.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    for (const r2 of recent) {
      console.log('--- Recent Outbox Row ---');
      console.log('id:', r2.id);
      console.log('queue:', r2.queue);
      console.log('sentAt:', r2.sentAt);
      console.log('attempts:', r2.attempts);
      console.log('payload:', JSON.stringify(r2.payload, null, 2));
      console.log('meta:', JSON.stringify(r2.meta || null, null, 2));
    }
    await p.$disconnect();
    return;
  }

  for (const r of rows) {
    console.log('--- Outbox Row ---');
    console.log('id:', r.id);
    console.log('queue:', r.queue);
    console.log('sentAt:', r.sentAt);
    console.log('attempts:', r.attempts);
    console.log('payload:', JSON.stringify(r.payload, null, 2));
    console.log('meta:', JSON.stringify(r.meta || null, null, 2));
  }

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e && e.message ? e.message : e);
  try { await p.$disconnect(); } catch (err) {}
  process.exit(1);
});
