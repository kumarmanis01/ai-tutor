#!/usr/bin/env node
/*
FILE OBJECTIVE:
- Create a minimal `HydrationJob` and a corresponding `Outbox` row for local E2E testing.

LINKED UNIT TEST:
- tests/integration/scripts/insert-test-hydration-and-outbox.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-01-21T00:00:00Z | copilot-agent | created test helper to insert hydration job + outbox
*/

import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    // Insert a minimal HydrationJob using raw SQL to avoid schema drift between Prisma client and DB
    const id = 'test-' + Date.now()
    const insertSql = `INSERT INTO "HydrationJob" ("id","jobType","subjectId","language","difficulty","status","createdAt","updatedAt") VALUES ($1,$2::"JobType",$3,$4::"LanguageCode",$5::"DifficultyLevel",$6::"JobStatus",now(),now()) RETURNING "id";`
    const res = await prisma.$queryRawUnsafe(insertSql, id, 'syllabus', 'TEST-SUB', 'en', 'easy', 'pending')
    const jobId = res && res[0] && (res[0].id || res[0].ID || res[0].Id) || id
    console.log('Inserted HydrationJob', jobId)

    // Create Outbox row to be dispatched to 'content-hydration' queue
    const outbox = await prisma.outbox.create({ data: {
      queue: 'content-hydration',
      payload: { type: 'SYLLABUS', payload: { jobId: jobId } },
      attempts: 0
    }})

    console.log('Created Outbox row', outbox.id)
    process.exit(0)
  } catch (err) {
    console.error('failed', err)
    process.exit(1)
  } finally {
    try { await prisma.$disconnect() } catch {}
  }
}

main()
