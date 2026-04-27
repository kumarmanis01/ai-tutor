/**
 * scripts/audit-stm-composite-keys.cjs
 *
 * Defensive migration audit: finds StudentTopicMastery and AttentionFlag rows
 * whose topicId contains "::" (the old subject::chapter composite format).
 *
 * These rows were created by the previous updateTopicMastery() implementation
 * which grouped questions by "${subject}::${chapter}" instead of using the
 * canonical TopicDef.id (UUID).
 *
 * This script ONLY logs -- it does NOT delete or modify any data.
 * Review the output before running any manual cleanup.
 *
 * Usage:
 *   node scripts/audit-stm-composite-keys.cjs
 *
 * Exit codes: 0 always (informational).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Env loader (same as test-mvp-flow.cjs) ───────────────────────────────────
function loadEnv() {
  const root = path.resolve(__dirname, '..');
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (let line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    break;
  }
}
loadEnv();
const { prisma } = require('../lib/prisma');


async function main() {
  console.log('═'.repeat(62));
  console.log('  audit-stm-composite-keys -- find "::" topicId rows');
  console.log('═'.repeat(62));

  // ── StudentTopicMastery ──────────────────────────────────────────────────────
  const stmRows = await prisma.studentTopicMastery.findMany({
    where: { topicId: { contains: '::' } },
    select: {
      id: true,
      studentId: true,
      topicId: true,
      subject: true,
      chapter: true,
      accuracy: true,
      questionsAttempted: true,
      lastAttemptedAt: true,
    },
    orderBy: { lastAttemptedAt: 'desc' },
  });

  console.log(`\n  StudentTopicMastery rows with "::" in topicId: ${stmRows.length}`);
  if (stmRows.length > 0) {
    console.log('  ─'.repeat(31));
    for (const r of stmRows) {
      console.log(`    id=${r.id}  student=${r.studentId}`);
      console.log(`      topicId  : ${r.topicId}`);
      console.log(`      subject  : ${r.subject}`);
      console.log(`      chapter  : ${r.chapter}`);
      console.log(`      accuracy : ${r.accuracy}  attempts: ${r.questionsAttempted}`);
      console.log(`      lastAt   : ${r.lastAttemptedAt?.toISOString() ?? 'null'}`);
      console.log('');
    }
  }

  // ── AttentionFlag ────────────────────────────────────────────────────────────
  const flagRows = await prisma.attentionFlag.findMany({
    where: { topicId: { contains: '::' } },
    select: {
      id: true,
      studentId: true,
      topicId: true,
      subject: true,
      chapter: true,
      accuracy: true,
      resolved: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`  AttentionFlag rows with "::" in topicId: ${flagRows.length}`);
  if (flagRows.length > 0) {
    console.log('  ─'.repeat(31));
    for (const r of flagRows) {
      console.log(`    id=${r.id}  student=${r.studentId}`);
      console.log(`      topicId  : ${r.topicId}`);
      console.log(`      subject  : ${r.subject}`);
      console.log(`      chapter  : ${r.chapter}`);
      console.log(`      accuracy : ${r.accuracy}  resolved: ${r.resolved}`);
      console.log('');
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const total = stmRows.length + flagRows.length;
  console.log('═'.repeat(62));
  if (total === 0) {
    console.log('  CLEAN -- no composite "::" keys found in STM or AttentionFlag.');
  } else {
    console.log(`  FOUND ${total} rows with composite "::" keys.`);
    console.log('  Review above and decide whether to delete or migrate.');
    console.log('  These rows are orphans -- the engine cannot match them to TopicDefs.');
  }
  console.log('═'.repeat(62) + '\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
