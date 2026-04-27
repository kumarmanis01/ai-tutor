#!/usr/bin/env node
/*
 * Enqueue a HydrationJob id onto BullMQ queue `content-hydration`.
 * Usage: node scripts/enqueue-hydration.js <hydrationId>
 */

const fs = require('fs')
const path = require('path')
const { Queue } = require('bullmq')

function loadRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  const p = path.join(process.cwd(), '.env.production')
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*REDIS_URL=(.*)$/)
      if (m) return m[1]
    }
  }
  throw new Error('REDIS_URL not set in env or .env.production')
}

async function main() {
  const argv = process.argv.slice(2)
  const id = argv[0]
  if (!id) {
    console.error('Usage: node scripts/enqueue-hydration.js <hydrationId>')
    process.exit(1)
  }

  const REDIS_URL = loadRedisUrl()
  const q = new Queue('content-hydration', { connection: { url: REDIS_URL } })

  const bullJob = await q.add(`syllabus-${id}`, { type: 'SYLLABUS', payload: { jobId: id } }, { jobId: id })
  console.log('enqueued', bullJob.id)
  await q.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
