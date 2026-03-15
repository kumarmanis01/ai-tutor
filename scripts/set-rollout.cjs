#!/usr/bin/env node
/**
 * Per-user AI Tutor rollout flag override.
 *
 * Usage:
 *   node scripts/set-rollout.cjs --user <userId> --enabled <true|false>
 *
 * Sets (or updates) a StudentFeatureFlag row for the given user.
 * Reads DATABASE_URL from environment; if not set, falls back to .env.production.
 *
 * Examples:
 *   node scripts/set-rollout.cjs --user clxabc123 --enabled true
 *   node scripts/set-rollout.cjs --user clxabc123 --enabled false
 */

'use strict'

const path = require('path')
const fs = require('fs')

// Load .env.production if DATABASE_URL is not already in the environment
if (!process.env.DATABASE_URL) {
  const envFile = path.join(__dirname, '..', '.env.production')
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}

const { PrismaClient } = require('@prisma/client')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user' && argv[i + 1]) {
      args.user = argv[i + 1]
      i++
    } else if (argv[i] === '--enabled' && argv[i + 1]) {
      const raw = argv[i + 1].toLowerCase()
      if (raw !== 'true' && raw !== 'false') {
        console.error('Error: --enabled must be "true" or "false"')
        process.exit(1)
      }
      args.enabled = raw === 'true'
      i++
    }
  }
  return args
}

;(async () => {
  const args = parseArgs(process.argv.slice(2))

  if (!args.user || args.enabled === undefined) {
    console.error('Usage: node scripts/set-rollout.cjs --user <userId> --enabled <true|false>')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not set. Export it or add it to .env.production.')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    const result = await prisma.studentFeatureFlag.upsert({
      where: {
        studentId_key: {
          studentId: args.user,
          key: 'AI_TUTOR',
        },
      },
      create: {
        studentId: args.user,
        key: 'AI_TUTOR',
        enabled: args.enabled,
      },
      update: {
        enabled: args.enabled,
      },
    })

    console.log(
      `StudentFeatureFlag upserted: user=${result.studentId} key=${result.key} enabled=${result.enabled}`,
    )
  } catch (err) {
    console.error('Error upserting flag:', err.message ?? err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
})()
