/**
 * seed-home-engine-test-data.cjs
 *
 * Seeds deterministic HomeEngine test data for three dummy-user scenarios:
 *
 *   1. WEAK student  -- StudentTopicMastery with accuracy=0.4  → triggers low_accuracy rule
 *   2. ACTIVE student -- open LearningSession (isCompleted=false) → triggers resume_session rule
 *   3. FRESH student  -- no mastery, no sessions → triggers next_new_topic rule
 *
 * Requires env vars (or args):
 *   WEAK_USER_ID    -- userId for the weak-student scenario
 *   ACTIVE_USER_ID  -- userId for the resume-session scenario
 *   (FRESH_USER_ID  -- needs no seeding, just verify the user has no records)
 *
 * Usage:
 *   WEAK_USER_ID=abc ACTIVE_USER_ID=xyz node scripts/seed-home-engine-test-data.cjs
 *
 * Idempotent: uses upsert on unique constraints.
 * Does NOT modify the Prisma schema.
 */

const fs = require('fs');
const path = require('path');

// ── env loader ────────────────────────────────────────────────────────────────
function loadEnvFileIfPresent() {
  try {
    const root = path.resolve(__dirname, '..');
    for (const name of ['.env.local', '.env']) {
      const p = path.join(root, name);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      for (let line of raw.split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
      console.log(`[env-loader] loaded ${p}`);
      break;
    }
  } catch (e) {
    console.warn('[env-loader]', e && e.message);
  }
}
loadEnvFileIfPresent();
const { prisma } = require('../lib/prisma');


async function main() {
  console.log('=== seed-home-engine-test-data ===\n');

  const WEAK_USER_ID = process.env.WEAK_USER_ID;
  const ACTIVE_USER_ID = process.env.ACTIVE_USER_ID;

  if (!WEAK_USER_ID && !ACTIVE_USER_ID) {
    console.log('No user IDs provided. Set WEAK_USER_ID and/or ACTIVE_USER_ID env vars.');
    console.log('Example: WEAK_USER_ID=abc ACTIVE_USER_ID=xyz node scripts/seed-home-engine-test-data.cjs');
    process.exit(0);
  }

  // Find a topic to use (first active TopicDef)
  const topic = await prisma.topicDef.findFirst({
    where: { lifecycle: 'active' },
    include: { chapter: { include: { subject: true } } },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
  });

  if (!topic) {
    console.error('No active TopicDef found. Run seed-taxonomy.cjs first.');
    process.exit(1);
  }

  const topicId = topic.id;
  const subject = topic.chapter.subject.name;
  const chapter = topic.chapter.name;
  console.log(`Using topic: ${topic.name} (${topicId}) -- ${subject} / ${chapter}\n`);

  // ── Case 1: Weak student -- low accuracy mastery record ──────────────────
  if (WEAK_USER_ID) {
    console.log(`[Weak student] userId=${WEAK_USER_ID}`);
    await prisma.studentTopicMastery.upsert({
      where: {
        studentId_topicId: { studentId: WEAK_USER_ID, topicId },
      },
      update: { accuracy: 0.4, masteryLevel: 'beginner' },
      create: {
        studentId: WEAK_USER_ID,
        topicId,
        subject,
        chapter,
        accuracy: 0.4,
        masteryLevel: 'beginner',
        questionsAttempted: 10,
        lastAttemptedAt: new Date(),
      },
    });
    console.log('  → StudentTopicMastery upserted (accuracy=0.4, masteryLevel=beginner)\n');
  }

  // ── Case 2: Active student -- open LearningSession ──────────────────────
  if (ACTIVE_USER_ID) {
    console.log(`[Active student] userId=${ACTIVE_USER_ID}`);

    // Close any previous open sessions first (clean state)
    await prisma.learningSession.updateMany({
      where: { studentId: ACTIVE_USER_ID, isCompleted: false },
      data: { isCompleted: true, endedAt: new Date() },
    });

    // Create a new open session
    await prisma.learningSession.create({
      data: {
        studentId: ACTIVE_USER_ID,
        activityType: 'practice',
        activityRef: topicId,
        difficultyLevel: 'medium',
        isCompleted: false,
        completionPercentage: 40,
        meta: { topicId, subject, chapter },
        lastAccessed: new Date(),
      },
    });
    console.log('  → LearningSession created (isCompleted=false, activityType=practice)\n');
  }

  console.log('=== seed-home-engine-test-data: DONE ===');
}

main()
  .catch((err) => {
    console.error('seed-home-engine-test-data FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
