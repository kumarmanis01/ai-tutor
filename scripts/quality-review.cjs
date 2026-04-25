#!/usr/bin/env node
/**
 * Daily session quality review CLI.
 *
 * Usage:
 *   node scripts/quality-review.cjs [--date YYYY-MM-DD]
 *
 * Samples 10 sessions from yesterday (or --date), prints turn summaries,
 * then prompts for flag input:
 *   <sessionId>:<turnId>:<flag> [:<note>]
 *   Flags: H=HALLUCINATION I=INCORRECT_EXPLANATION P=POOR_PEDAGOGY
 *          T=OFF_TOPIC D=DIRECT_ANSWER_GIVEN S=SAFETY_CONCERN
 */
'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');

if (!process.env.DATABASE_URL) {
  const envFile = path.join(__dirname, '..', '.env.production');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
const { prisma } = require('../lib/prisma');

const FLAG_MAP = {
  H: 'HALLUCINATION',
  I: 'INCORRECT_EXPLANATION',
  P: 'POOR_PEDAGOGY',
  T: 'OFF_TOPIC',
  D: 'DIRECT_ANSWER_GIVEN',
  S: 'SAFETY_CONCERN',
};

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function getIstBoundsForDate(dateStr) {
  // dateStr: YYYY-MM-DD in IST. Convert midnight IST to UTC
  const [y, m, d] = dateStr.split('-').map(Number);
  const istMidnight = Date.UTC(y, m - 1, d); // midnight UTC which equals midnight IST for this date string
  const start = new Date(istMidnight - IST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function getYesterdayIstDate() {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  nowIst.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(nowIst.getTime() - 24 * 60 * 60 * 1000);
  const y = yesterday.getUTCFullYear();
  const m = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(yesterday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date' && argv[i + 1]) {
      args.date = argv[i + 1];
      i++;
    }
  }
  return args;
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const dateStr = args.date ?? getYesterdayIstDate();

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  try {
    const { start, end } = getIstBoundsForDate(dateStr);

    const rows = await prisma.$queryRaw`
      SELECT s.id, s."studentId", s."startedAt", s."completedAt",
             COUNT(t.id)::int AS "turnCount"
      FROM "StructuredSession" s
      JOIN "AITutorTurnLog" t ON t."sessionId" = s.id
      WHERE s."startedAt" >= ${start} AND s."startedAt" < ${end}
      GROUP BY s.id, s."studentId", s."startedAt", s."completedAt"
      ORDER BY RANDOM()
      LIMIT 10
    `;

    if (!rows.length) {
      console.log(`No sessions found for ${dateStr}`);
      return;
    }

    console.log(`\n=== Quality Review: ${dateStr} (${rows.length} sessions) ===\n`);

    for (const row of rows) {
      const durationMs = row.completedAt
        ? new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime()
        : null;
      const durationMin = durationMs ? Math.round(durationMs / 60000) : '--';
      const studentAnon = String(row.studentId).slice(0, 8);
      console.log(
        `Session: ${row.id} | Student: ${studentAnon}... | Duration: ${durationMin}min | Turns: ${row.turnCount}`
      );

      const turns = await prisma.aITutorTurnLog.findMany({
        where: { sessionId: row.id, callType: { startsWith: 'tutor:' } },
        orderBy: { createdAt: 'asc' },
        take: 3,
      });

      for (const t of turns) {
        const stageLbl = t.stage ?? t.callType ?? '?';
        console.log(`  [${stageLbl}] id=${t.id}${t.qualityFlag ? ` ⚑ ${t.qualityFlag}` : ''}`);
      }
      console.log();
    }

    console.log('Flag a turn? Format: <sessionId>:<turnId>:<flag>[:<note>]');
    console.log(
      'Flags: H=HALLUCINATION I=INCORRECT_EXPLANATION P=POOR_PEDAGOGY T=OFF_TOPIC D=DIRECT_ANSWER_GIVEN S=SAFETY_CONCERN'
    );
    console.log('Press Enter to skip.\n');

    const input = await prompt('> ');
    if (!input.trim()) {
      console.log('Skipped -- no flags added.');
      return;
    }

    const parts = input.trim().split(':');
    if (parts.length < 3) {
      console.error('❌ Invalid format. Expected <sessionId>:<turnId>:<flag>[:<note>]');
      process.exit(1);
    }

    const [sessionId, turnId, flagCode, ...noteParts] = parts;
    const flagEnum = FLAG_MAP[flagCode.toUpperCase()];
    if (!flagEnum) {
      console.error(
        `❌ Unknown flag code: ${flagCode}. Use one of: ${Object.keys(FLAG_MAP).join(' ')}`
      );
      process.exit(1);
    }

    const note = noteParts.join(':').trim() || null;

    await prisma.aITutorTurnLog.update({
      where: { id: turnId },
      data: { qualityFlag: flagEnum, qualityNote: note },
    });

    console.log(`✅ Flagged ${turnId} as ${flagEnum}${note ? ` (${note})` : ''}`);
  } catch (err) {
    console.error(`❌ ${err.message ?? String(err)}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
