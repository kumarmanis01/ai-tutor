#!/usr/bin/env node
/*
 * FILE OBJECTIVE:
 * - Query Prisma to fetch HydrationJob, linked ExecutionJob(s), and recent WorkerLifecycle rows for debugging.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/fetch_hydration_info.spec.ts (not present)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-01-19T00:00:00Z | copilot | created
 */

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
  } catch {
    // ignore
  }
}

// load .env.production next to repo root
loadEnvFile(path.resolve(process.cwd(), '.env.production'));
// Silence Prisma client debug output for CLI scripts
process.env.DEBUG = '';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

(async () => {
  try {
    const argv = process.argv.slice(2);
    const hydrationId = argv[0] || 'cmklbxb9k00094acs2fnpi4jq';

    console.log('Using DATABASE_URL=', !!process.env.DATABASE_URL ? '[present]' : '[missing]');

    const hydration = await prisma.hydrationJob.findUnique({ where: { id: hydrationId } });
    console.log('\nHydrationJob:');
    console.log(JSON.stringify(hydration, null, 2));

    // ExecutionJob model may not have a direct `hydrationJobId` scalar; search payload JSON for references
    let executions = [];
    try {
      executions = await prisma.$queryRawUnsafe(
        `SELECT * FROM "ExecutionJob" WHERE payload::text ILIKE $1 ORDER BY "createdAt" DESC LIMIT 20`,
        `%${hydrationId}%`
      );
    } catch {
      // fallback: try a generic findMany if the model supports it
      try {
        executions = await prisma.executionJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
      } catch {
        // give up
      }
    }
    console.log('\nExecutionJob(s):');
    console.log(JSON.stringify(executions, null, 2));

    let workerLifecycle = [];
    try {
      workerLifecycle = await prisma.$queryRawUnsafe(`SELECT * FROM \"WorkerLifecycle\" ORDER BY \"lastHeartbeat\" DESC LIMIT 20`);
    } catch {
      try {
        workerLifecycle = await prisma.workerLifecycle.findMany({ orderBy: { lastHeartbeat: 'desc' }, take: 20 });
      } catch {
        // ignore
      }
    }
    console.log('\nWorkerLifecycle (recent):');
    console.log(JSON.stringify(workerLifecycle, null, 2));

    // If there is an errors table or logs table, try to fetch rows that reference the hydration id
    try {
      const attempts = await prisma.$queryRawUnsafe(`SELECT * FROM \"HydrationJobAttempt\" WHERE \"hydrationJobId\" = $1 ORDER BY \"createdAt\" DESC LIMIT 10`, hydrationId);
      if (attempts && attempts.length) {
        console.log('\nHydrationJobAttempt(s):');
        console.log(JSON.stringify(attempts, null, 2));
      }
    } catch {
      // ignore if table doesn't exist
    }

    // Raw query for any table names that might contain job logs (best-effort)
    try {
      const res = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%log%' LIMIT 50`);
      console.log('\nLog-like tables (sample):');
      console.log(JSON.stringify(res, null, 2));
    } catch {
      // ignore
    }

  } catch (err) {
    console.error('ERROR:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
