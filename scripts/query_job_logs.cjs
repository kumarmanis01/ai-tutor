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
// Ensure Prisma/DEBUG logs are disabled for cleaner CLI output
process.env.DEBUG = '';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
(async ()=>{
  try {
    const execId = process.argv[2] || 'cmklbxb6800044acsnwfjmaf4';
    // JobExecutionLog links to jobs via `jobId` column
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM "JobExecutionLog" WHERE "jobId" = $1 ORDER BY "createdAt" DESC LIMIT 200', execId);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
