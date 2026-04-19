const { PrismaClient } = require('@prisma/client');
async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: node scripts/query-aicontent.cjs <hydrationJobId>');
    process.exit(2);
  }
  const p = new PrismaClient();
  try {
    // Query latest aIContentLog entries and filter in JS to avoid schema mismatches
    const rows = await p.aIContentLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const filtered = rows.filter(r => (r.hydrationJobId === jobId) || (r.hydration_job_id === jobId) || (r.hydrationjobid === jobId));
    if (filtered.length === 0) {
      console.log('No aIContentLog rows matched hydrationJobId (fetched latest 50 rows).');
      console.log('Sample row keys (if any):', rows.length ? Object.keys(rows[0]) : 'no rows');
    }
    console.log(JSON.stringify(filtered, null, 2));
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
}

main();
