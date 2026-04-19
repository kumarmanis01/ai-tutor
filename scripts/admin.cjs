#!/usr/bin/env node
/**
 * Spinzy admin CLI -- user and content operations.
 *
 * Usage:
 *   node scripts/admin.cjs <command> [options]
 *
 * Commands:
 *   suspend-user        --userId <id> --reason "text"
 *   reactivate-user     --userId <id>
 *   reset-diagnostic    --userId <id> --subjectId <id> --reason "text"
 *   extend-subscription --userId <id> --days <N> --reason "text"
 *   list-escalations
 *   list-quarantined
 *   view-audit-log      --userId <id> [--limit 20]
 *   change-grade        --userId <id> --grade <6-12> --reason "text"
 *
 * Reads DATABASE_URL from environment; falls back to .env.production.
 * Never requires the app to be running -- direct DB access only.
 */

'use strict'

const path = require('path')
const fs = require('fs')
const readline = require('readline')

// Load .env.production if DATABASE_URL not already set
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

// ── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--') && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      const key = a.slice(2)
      args[key] = argv[i + 1]
      i++
    } else if (a.startsWith('--')) {
      args[a.slice(2)] = true
    } else {
      args._.push(a)
    }
  }
  return args
}

function requireArg(args, key) {
  if (!args[key]) {
    console.error(`❌ --${key} is required`)
    process.exit(1)
  }
  return args[key]
}

function requireReason(args) {
  if (!args.reason || String(args.reason).trim() === '') {
    console.error('❌ --reason is required for this operation')
    process.exit(1)
  }
  return String(args.reason).trim()
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function suspendUser(prisma, args) {
  const userId = requireArg(args, 'userId')
  const reason = requireReason(args)

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { accountStatus: 'suspended' } }),
    prisma.auditLog.create({
      data: {
        targetEntity: 'User',
        targetId: userId,
        action: 'ACCOUNT_SUSPEND',
        reason,
      },
    }),
  ])
  console.log(`✅ User ${userId} suspended`)
}

async function reactivateUser(prisma, args) {
  const userId = requireArg(args, 'userId')

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { accountStatus: 'active' } }),
    prisma.auditLog.create({
      data: {
        targetEntity: 'User',
        targetId: userId,
        action: 'ACCOUNT_REACTIVATE',
      },
    }),
  ])
  console.log(`✅ User ${userId} reactivated`)
}

async function resetDiagnostic(prisma, args) {
  const userId = requireArg(args, 'userId')
  const subjectId = requireArg(args, 'subjectId')
  const reason = requireReason(args)

  // Resolve all conceptIds for this subject (Concept has subjectId directly)
  const concepts = await prisma.concept.findMany({
    where: { subjectId },
    select: { id: true },
  })
  const conceptIds = concepts.map((c) => c.id)

  const [deleted] = await prisma.$transaction([
    prisma.studentConceptState.deleteMany({
      where: { studentId: userId, conceptId: { in: conceptIds } },
    }),
    prisma.learningPlan.deleteMany({
      where: { studentId: userId, subjectId },
    }),
    prisma.auditLog.create({
      data: {
        targetEntity: 'User',
        targetId: userId,
        action: 'DIAGNOSTIC_RESET',
        reason,
        previousValue: { conceptStateCount: conceptIds.length },
      },
    }),
  ])

  // Best-effort Redis key deletion (no-op if REDIS_URL not set)
  try {
    if (process.env.REDIS_URL) {
      const { createClient } = require('redis')
      const client = createClient({ url: process.env.REDIS_URL })
      await client.connect()
      await client.del(`diagnostic:partial:${userId}:${subjectId}`)
      await client.disconnect()
    }
  } catch {
    // non-fatal
  }

  console.log(
    `✅ Diagnostic reset for user ${userId} subject ${subjectId} (${deleted.count} concept states deleted)`,
  )
}

async function extendSubscription(prisma, args) {
  const userId = requireArg(args, 'userId')
  const days = parseInt(args.days ?? '0', 10)
  const reason = requireReason(args)

  if (!days || days <= 0) {
    console.error('❌ --days must be a positive integer')
    process.exit(1)
  }

  const sub = await prisma.subscription.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!sub) {
    console.error(`❌ No active subscription found for user ${userId}`)
    process.exit(1)
  }

  const prevEndDate = sub.endDate
  const newEndDate = new Date(sub.endDate.getTime() + days * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.subscription.update({ where: { id: sub.id }, data: { endDate: newEndDate } }),
    prisma.auditLog.create({
      data: {
        targetEntity: 'Subscription',
        targetId: sub.id,
        action: 'SUBSCRIPTION_EXTEND',
        reason,
        previousValue: { endDate: prevEndDate.toISOString() },
        newValue: { endDate: newEndDate.toISOString() },
      },
    }),
  ])
  console.log(`✅ Subscription extended by ${days} days, new expiry: ${newEndDate.toISOString()}`)
}

async function listEscalations(prisma) {
  let escalations
  try {
    escalations = await prisma.doubtEscalation.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { student: { select: { email: true } } },
    })
  } catch {
    console.log('Doubt escalation queue not yet built -- run Task A5')
    return
  }

  if (!escalations.length) {
    console.log('No open escalations ✓')
    return
  }
  console.log(`Open escalations: ${escalations.length}`)
  console.log('─'.repeat(80))
  console.log('ID'.padEnd(26) + 'Student'.padEnd(30) + 'ConceptId'.padEnd(20) + 'Created')
  console.log('─'.repeat(80))
  for (const e of escalations) {
    console.log(
      e.id.padEnd(26) +
        (e.student?.email ?? '').padEnd(30) +
        (e.conceptId ?? '--').padEnd(20) +
        e.createdAt.toISOString(),
    )
  }
}

async function listQuarantined(prisma) {
  const questions = await prisma.question.findMany({
    where: { status: 'QUARANTINED' },
    include: { sessionFlags: { select: { id: true } }, topic: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  if (!questions.length) {
    console.log('No quarantined questions ✓')
    return
  }

  console.log(`Quarantined questions: ${questions.length}`)
  console.log('─'.repeat(90))
  console.log('ID'.padEnd(26) + 'Topic'.padEnd(22) + 'Flags'.padEnd(8) + 'UpdatedAt')
  console.log('─'.repeat(90))
  for (const q of questions) {
    console.log(
      q.id.padEnd(26) +
        (q.topic?.name ?? q.subject ?? '--').slice(0, 20).padEnd(22) +
        String(q.sessionFlags.length).padEnd(8) +
        q.updatedAt.toISOString(),
    )
  }
}

async function viewAuditLog(prisma, args) {
  const userId = requireArg(args, 'userId')
  const limit = parseInt(args.limit ?? '20', 10)

  const logs = await prisma.auditLog.findMany({
    where: { OR: [{ targetId: userId }, { adminId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  if (!logs.length) {
    console.log(`No audit log entries for user ${userId}`)
    return
  }
  console.log('─'.repeat(100))
  console.log('CreatedAt'.padEnd(26) + 'Action'.padEnd(28) + 'TargetEntity'.padEnd(18) + 'Reason')
  console.log('─'.repeat(100))
  for (const l of logs) {
    console.log(
      l.createdAt.toISOString().padEnd(26) +
        (l.action ?? 'system').padEnd(28) +
        l.targetEntity.padEnd(18) +
        (l.reason ?? ''),
    )
  }
}

async function changeGrade(prisma, args) {
  const userId = requireArg(args, 'userId')
  const grade = requireArg(args, 'grade')
  const reason = requireReason(args)

  const validGrades = ['6', '7', '8', '9', '10', '11', '12']
  if (!validGrades.includes(String(grade))) {
    console.error(`❌ --grade must be one of: ${validGrades.join(', ')}`)
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { grade: true, email: true } })
  if (!user) {
    console.error(`❌ User ${userId} not found`)
    process.exit(1)
  }

  console.log(`⚠️  Grade change for ${user.email ?? userId}: ${user.grade ?? 'unset'} → ${grade}`)
  console.log('   This is irreversible and resets all concept states.')
  const answer = await prompt('   Type YES to confirm: ')
  if (answer.trim() !== 'YES') {
    console.log('Aborted -- no changes made')
    return
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { grade: String(grade) } }),
    prisma.studentConceptState.deleteMany({ where: { studentId: userId } }),
    prisma.learningPlan.deleteMany({ where: { studentId: userId } }),
    prisma.auditLog.create({
      data: {
        targetEntity: 'User',
        targetId: userId,
        action: 'GRADE_CHANGE',
        reason,
        previousValue: { grade: user.grade },
        newValue: { grade: String(grade) },
      },
    }),
  ])
  console.log(`✅ Grade changed for user ${userId}: ${user.grade ?? 'unset'} → ${grade}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

;(async () => {
  const rawArgs = process.argv.slice(2)
  const command = rawArgs[0]
  const args = parseArgs(rawArgs.slice(1))

  if (!command) {
    console.error([
      'Usage: node scripts/admin.cjs <command> [options]',
      '',
      'Commands:',
      '  suspend-user        --userId <id> --reason "text"',
      '  reactivate-user     --userId <id>',
      '  reset-diagnostic    --userId <id> --subjectId <id> --reason "text"',
      '  extend-subscription --userId <id> --days <N> --reason "text"',
      '  list-escalations',
      '  list-quarantined',
      '  view-audit-log      --userId <id> [--limit 20]',
      '  change-grade        --userId <id> --grade <6-12> --reason "text"',
    ].join('\n'))
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Export it or add it to .env.production.')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    switch (command) {
      case 'suspend-user':        await suspendUser(prisma, args); break
      case 'reactivate-user':     await reactivateUser(prisma, args); break
      case 'reset-diagnostic':    await resetDiagnostic(prisma, args); break
      case 'extend-subscription': await extendSubscription(prisma, args); break
      case 'list-escalations':    await listEscalations(prisma); break
      case 'list-quarantined':    await listQuarantined(prisma); break
      case 'view-audit-log':      await viewAuditLog(prisma, args); break
      case 'change-grade':        await changeGrade(prisma, args); break
      default:
        console.error(`❌ Unknown command: ${command}`)
        process.exit(1)
    }
  } catch (err) {
    console.error(`❌ ${err.message ?? String(err)}`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
})()
