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
    // Create a minimal HydrationJob (syllabus) for subject 'TEST-SUB'
    const job = await prisma.hydrationJob.create({ data: {
      jobType: 'syllabus',
      subjectId: 'TEST-SUB',
      language: 'en',
      status: 'PENDING'
    }})

    console.log('Created HydrationJob', job.id)

    // Create Outbox row to be dispatched to 'content-hydration' queue
    const outbox = await prisma.outbox.create({ data: {
      queue: 'content-hydration',
      payload: { type: 'SYLLABUS', payload: { jobId: job.id } },
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
