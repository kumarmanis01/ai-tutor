#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Pilot script to enqueue notes hydration jobs for legacy TopicNotes on VPS.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/pilot-hydrate.cjs.spec.ts (to be added)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/AI_Execution_PIPELINE.md
 *
 * EDIT LOG:
 * - 2026-04-02T00:00:00Z | copilot | created pilot-hydrate.cjs
 */

"use strict"

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')

// NOTE: This script prefers environment variables provided by the VPS
// runtime (NO dotenv). Required: DATABASE_URL. Workers must run with
// OPENAI_API_KEY + ALLOW_LLM_CALLS for actual generation — this script only
// enqueues hydration jobs.

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    const m = content.match(/^\s*DATABASE_URL=(.+)$/m)
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/(^"|"$)/g, '').replace(/(^'|'$)/g, '')
      console.log('Loaded DATABASE_URL from .env.local')
    }
  }
}

ensureDatabaseUrl()

const prisma = new PrismaClient()

function parseCli() {
  const argv = process.argv.slice(2)
  const opts = {
    count: 10,
    force: false,
    lang: 'en',
    dryRun: false
  }

  if (argv.length > 0 && !argv[0].startsWith('-')) {
    const n = parseInt(argv[0], 10)
    if (!Number.isNaN(n) && n > 0) opts.count = Math.min(n, 500)
  }

  for (const a of argv) {
    if (a === '--force' || a === '-f') opts.force = true
    if (a.startsWith('--lang=')) {
      const v = a.split('=')[1]
      if (/^[a-z]{2}$/i.test(v)) opts.lang = v.toLowerCase()
    }
    if (a === '--dry-run' || a === '--dry' || a === '-n') {
      opts.dryRun = true
    }
  }

  return opts
}

function isSettingEnabled(val) {
  if (val === null || typeof val === 'undefined') return false
  if (typeof val === 'boolean') return val
  try {
    const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
    return (/^(1|true|on|enabled)$/i).test(s.replace(/["\'\s\{\}\[\]]/g, ''))
  } catch (e) {
    return false
  }
}

async function findLegacyTopicIds(count, lang) {
  // Discover table/column names and build a properly-quoted SQL query so
  // we don't run into unquoted-camelcase identifier errors (eg. contentJson).
  const tblRes = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND (table_name ILIKE '%topic%note%' OR (table_name ILIKE '%topic%' AND table_name ILIKE '%note%'))
    ORDER BY table_name
  `)
  const tables = Array.isArray(tblRes) ? tblRes.map((r) => r.table_name) : []
  const tableName = tables.length > 0 ? tables[0] : 'TopicNote'

  const colRes = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'`
  )
  const cols = Array.isArray(colRes) ? colRes.map((r) => r.column_name) : []

  const contentColCandidates = cols.filter((c) => /content/i.test(c) || /json/i.test(c))
  const contentCol = contentColCandidates.length > 0 ? contentColCandidates[0] : 'contentJson'

  // Pick best candidate column names for topicId / updatedAt / language
  const topicIdCol = cols.find((c) => /topic[_]?id$/i.test(c)) || cols.find((c) => /^topicid$/i.test(c)) || cols.find((c) => /topic/i.test(c)) || 'topicId'
  const updatedAtCol = cols.find((c) => /^updated_at$/i.test(c)) || cols.find((c) => /^updatedat$/i.test(c)) || cols.find((c) => /updated/i) || 'updatedAt'
  const languageCol = cols.find((c) => /^language$/i.test(c)) || cols.find((c) => /^lang$/i.test(c)) || 'language'

  const tq = (s) => '"' + String(s).replace(/"/g, '""') + '"'

  const sql = `
    SELECT ${tq(topicIdCol)} as topic_id, MIN(${tq(updatedAtCol)}) as min_updated_at
    FROM ${tq(tableName)}
    WHERE ${tq(languageCol)} = '${String(lang).replace(/'/g, "''")}'
      AND NOT (
        (${tq(contentCol)} -> 'sections') IS NOT NULL
        AND jsonb_typeof(${tq(contentCol)} -> 'sections') = 'array'
        AND jsonb_array_length(${tq(contentCol)} -> 'sections') > 0
      )
    GROUP BY ${tq(topicIdCol)}
    ORDER BY min_updated_at ASC
    LIMIT ${count}
  `

  const rows = await prisma.$queryRawUnsafe(sql)
  return rows.map((r) => r.topic_id || r.topicId || r.topicid || Object.values(r)[0])
}

async function enqueueForTopic(topicId, language, force) {
  // Resolve topic with academic context
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } }
            }
          }
        }
      }
    }
  })
  if (!topic) return { created: false, reason: 'resolve_not_found' }

  // Idempotency: skip if approved notes exist (unless force)
  if (!force) {
    const existing = await prisma.topicNote.findFirst({
      where: { topicId, language, status: 'approved' },
      select: { id: true }
    })
    if (existing) return { created: false, reason: 'content_exists' }
  }

  // Prevent duplicate queued/running jobs for same topic/language
  const existingJob = await prisma.hydrationJob.findFirst({
    where: {
      jobType: 'notes',
      topicId,
      language,
      status: { in: ['pending', 'running'] }
    }
  })
  if (existingJob) return { created: false, reason: 'job_already_queued', jobId: existingJob.id }

  // Create HydrationJob row
  const generatedId = randomUUID()
  const jobData = {
    id: generatedId,
    rootJobId: null,
    jobType: 'notes',
    topicId,
    language,
    difficulty: 'medium',
    board: topic.chapter?.subject?.class?.board?.name ?? null,
    grade: topic.chapter?.subject?.class?.grade ?? null,
    subject: topic.chapter?.subject?.name ?? null,
    subjectId: topic.chapter?.subject?.id ?? null,
    chapterId: topic.chapter?.id ?? null,
    status: 'pending'
  }

  const job = await prisma.hydrationJob.create({ data: jobData })

  // Create Outbox row for the dispatcher
  try {
    const outbox = await prisma.outbox.create({
      data: {
        queue: 'content-hydration',
        payload: { type: 'NOTES', payload: { jobId: job.id } },
        meta: { hydrationJobId: job.id, topicId, language }
      }
    })
    return { created: true, jobId: job.id, outboxId: outbox.id }
  } catch (err) {
    // Outbox failure should not stop the job creation; worker dispatcher may pick it up.
    return { created: true, jobId: job.id }
  }
}

async function main() {
  const opts = parseCli()
  const { count, force, lang } = opts

  console.log(`Pilot hydrate: count=${count} lang=${lang} force=${force}`)

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Aborting.')
    process.exit(2)
  }

  try {
    // 1️⃣ Global pause guard
    const ps = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } })
    if (isSettingEnabled(ps?.value)) {
      console.error('Hydration is globally paused (HYDRATION_PAUSED). Aborting.')
      await prisma.$disconnect()
      process.exit(3)
    }

    // 2️⃣ Find legacy topic ids
    const topicIds = await findLegacyTopicIds(count, lang)
    if (!topicIds || topicIds.length === 0) {
      console.log('No legacy TopicNotes found for pilot.')
      await prisma.$disconnect()
      return
    }

    if (opts.dryRun) {
      console.log('Dry-run mode: the following topics would be enqueued (no jobs created):')
      // fetch topic names for readability
      const topics = await prisma.topicDef.findMany({ where: { id: { in: topicIds } }, select: { id: true, name: true } })
      for (const t of topics) {
        console.log(`- ${t.id} | ${t.name ?? '(no name)'}`)
      }
      // show a small sample of existing TopicNote content (if any)
      for (const tid of topicIds) {
        const note = await prisma.topicNote.findFirst({ where: { topicId: tid, language: lang }, select: { id: true, updatedAt: true, contentJson: true } })
        if (note) {
          const snippet = String(JSON.stringify(note.contentJson)).slice(0, 400).replace(/\s+/g, ' ')
          console.log(`  sample note: id=${note.id} updatedAt=${note.updatedAt} snippet=${snippet}`)
        } else {
          console.log('  no TopicNote rows for this topic+lang')
        }
      }
      await prisma.$disconnect()
      return
    }

    let enqueued = 0
    let skipped = 0

    for (const tid of topicIds) {
      try {
        console.log('Enqueuing for topic', tid)
        const res = await enqueueForTopic(tid, lang, force)
        if (res.created) {
          enqueued++
          console.log(`  -> enqueued job ${res.jobId}`)
        } else {
          skipped++
          console.log(`  -> skipped: ${res.reason}${res.jobId ? ' (' + res.jobId + ')' : ''}`)
        }
      } catch (err) {
        console.error('Failed to enqueue for topic', tid, String(err?.message || err))
      }
      // small delay to avoid DB/dispatcher spikes
      await new Promise((r) => setTimeout(r, 200))
    }

    console.log(`Pilot summary: enqueued=${enqueued} skipped=${skipped}`)
  } catch (err) {
    console.error('Pilot hydrate failed:', String(err?.message || err))
    process.exit(1)
  } finally {
    try { await prisma.$disconnect() } catch (e) {}
  }
}

main()
