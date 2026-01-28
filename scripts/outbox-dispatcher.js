#!/usr/bin/env node
/*
FILE OBJECTIVE:
- Poll the `Outbox` table and enqueue unsent messages to BullMQ `content-hydration` queue.

LINKED UNIT TEST:
- tests/unit/scripts/outbox-dispatcher.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- .github/copilot-instructions.md
- /docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-01-21T00:00:00Z | copilot-agent | added header and documentation
*/

import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'

// Dispatcher reads unsent Outbox rows and enqueues them to Bull
// Usage: node scripts/outbox-dispatcher.js

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function main() {
  const prisma = new PrismaClient()
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.error('REDIS_URL not set; cannot dispatch outbox')
    process.exit(1)
  }

  const queue = new Queue('content-hydration', { connection: { url: redisUrl } })

  console.log('Outbox dispatcher started; polling for unsent outbox rows...')

  while (true) {
    try {
      // Find oldest unsent outbox rows
      const rows = await prisma.outbox.findMany({ where: { sentAt: null }, orderBy: { createdAt: 'asc' }, take: 10 })
      if (!rows || rows.length === 0) {
        await sleep(1000)
        continue
      }

      for (const r of rows) {
        try {
          const payload = r.payload
          // Add to bull queue
          const job = await queue.add(`${payload.type.toLowerCase()}-${(payload.payload?.jobId) ?? r.id}`, payload)
          await prisma.outbox.update({ where: { id: r.id }, data: { sentAt: new Date(), attempts: r.attempts + 1 } })
          console.log(`dispatched outbox ${r.id} -> bullJobId=${job.id}`)
        } catch (err) {
          console.error('failed to dispatch outbox row', r.id, err)
          await prisma.outbox.update({ where: { id: r.id }, data: { attempts: r.attempts + 1 } })
        }
      }

    } catch (err) {
      console.error('outbox dispatcher main loop error', err)
      await sleep(2000)
    }
  }
}

main().catch((e) => { console.error('fatal', e); process.exit(1) })
