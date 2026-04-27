#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
function loadEnvFile(file) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=', 2);
      if (parts.length === 2) {
        const k = parts[0].trim();
        const v = parts[1].trim();
        if (!process.env[k]) process.env[k] = v;
      }
    });
  } catch {}
}
loadEnvFile(path.resolve(process.cwd(), '.env.production'));
const { Client } = require('pg');
(async () => {
  const execId = process.argv[2] || 'cmklbxb6800044acsnwfjmaf4';
  const hydrationId = process.argv[3] || 'cmklbxb9k00094acs2fnpi4jq';
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing in env');
    process.exit(2);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const jobLogsRes = await client.query('SELECT * FROM "JobExecutionLog" WHERE "jobId" = $1 ORDER BY "createdAt" DESC LIMIT 200', [execId]);
    console.log('\n=== JobExecutionLog rows (latest first) ===');
    console.log(JSON.stringify(jobLogsRes.rows, null, 2));

    const execRes = await client.query('SELECT * FROM "ExecutionJob" WHERE "id" = $1', [execId]);
    console.log('\n=== ExecutionJob ===');
    console.log(JSON.stringify(execRes.rows, null, 2));

    const hydRes = await client.query('SELECT * FROM "HydrationJob" WHERE "id" = $1', [hydrationId]);
    console.log('\n=== HydrationJob ===');
    console.log(JSON.stringify(hydRes.rows, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
})();
