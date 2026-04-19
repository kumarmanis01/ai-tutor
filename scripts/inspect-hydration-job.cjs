#!/usr/bin/env node
/*
 * Inspect AIContentLog rows for given HydrationJob IDs to see LLM response and validation errors.
 * Usage: node scripts/inspect-hydration-job.cjs <jobId1> <jobId2> ...
 */

"use strict"
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

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

async function inspectJob(jobId) {
  const jid = String(jobId).replace(/'/g, "''")
  // Fetch hydration job details
  const job = await prisma.hydrationJob.findUnique({ where: { id: String(jobId) } })

  // Search AIContentLog for any mention of the jobId in requestBody or responseBody
  const sql = `
    SELECT "id", "promptType", "model", "language", "error", "requestBody", "responseBody", "createdAt"
    FROM "AIContentLog"
    WHERE ("requestBody"::text ILIKE '%${jid}%') OR ("responseBody"::text ILIKE '%${jid}%')
    ORDER BY "createdAt" DESC
    LIMIT 50
  `
  const rows = await prisma.$queryRawUnsafe(sql)
  return { job, rows }
}

async function main() {
  const args = process.argv.slice(2)
  if (!args || args.length === 0) {
    console.error('Usage: node scripts/inspect-hydration-job.cjs <jobId> [jobId2 ...]')
    process.exit(2)
  }

  for (const j of args) {
    try {
      console.log('\n---- Inspecting jobId:', j, '----')
      // 1) Try to fetch HydrationJob directly
      const job = await prisma.hydrationJob.findUnique({ where: { id: String(j) } })
      if (job) {
        console.log('\nHydrationJob:')
        console.log(JSON.stringify({ id: job.id, jobType: job.jobType, status: job.status, lastError: job.lastError, createdAt: job.createdAt, updatedAt: job.updatedAt }, null, 2))
      } else {
        console.log('HydrationJob not found for', j)
      }

      // 2) Check Outbox by id or payload
      try {
        const out = await prisma.outbox.findUnique({ where: { id: String(j) } })
        if (out) {
          console.log('\nOutbox row (id match):')
          console.log(JSON.stringify(out, null, 2))
        }
      } catch (e) {}

      const outMatches = await prisma.$queryRawUnsafe(`SELECT "id", "queue", "payload", "meta", "createdAt" FROM "Outbox" WHERE "payload"::text ILIKE '%${String(j).replace(/'/g, "''")}%' LIMIT 20`)
      if (outMatches && outMatches.length > 0) {
        console.log('\nOutbox rows matching payload:')
        console.log(JSON.stringify(outMatches, null, 2))
      }

      // 3) Search AIContentLog for references
      const { rows } = await (async () => {
        const res = await prisma.$queryRawUnsafe(`
          SELECT "id", "promptType", "model", "language", "error", "requestBody", "responseBody", "createdAt"
          FROM "AIContentLog"
          WHERE ("requestBody"::text ILIKE '%${String(j).replace(/'/g, "''")}%' ) OR ("responseBody"::text ILIKE '%${String(j).replace(/'/g, "''")}%' )
          ORDER BY "createdAt" DESC
          LIMIT 50
        `)
        return { rows: res }
      })()

      if (!rows || rows.length === 0) {
        console.log('No AIContentLog rows found for', j)
      } else {
        for (const r of rows) {
          console.log('\nAIContentLog id:', r.id)
          console.log(' promptType:', r.promptType, ' model:', r.model, ' lang:', r.language, ' error:', r.error)
          console.log(' createdAt:', r.createdAt)
          try { console.log(' requestBody:', JSON.stringify(r.requestBody, null, 2)) } catch (e) { console.log(' requestBody:', String(r.requestBody)) }
          try { console.log(' responseBody:', JSON.stringify(r.responseBody, null, 2).slice(0, 2000)) } catch (e) { console.log(' responseBody (raw):', String(r.responseBody).slice(0, 2000)) }
        }
      }
    } catch (err) {
      console.error('Failed to inspect job', j, String(err?.message || err))
    }
  }

  try { await prisma.$disconnect() } catch {}
}

main()
main()
