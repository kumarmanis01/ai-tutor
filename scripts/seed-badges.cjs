'use strict';

const fs = require('fs');
const path = require('path');

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    console.log(`[env] loaded ${p}`);
    break;
  }
}

loadEnv();

const DRY_RUN = process.argv.includes('--dry-run');

let prisma = null;
if (!DRY_RUN) {
  const { prisma } = require('../lib/prisma');
  prisma = new PrismaClient();
}

const BADGE_DEFINITIONS = [
  {
    key: 'streak_7',
    name: '7-Day Streak',
    description: '7 consecutive days of learning',
    icon: 'fire',
  },
  {
    key: 'streak_14',
    name: '14-Day Streak',
    description: '14 consecutive days of learning',
    icon: 'fire',
  },
  {
    key: 'streak_30',
    name: '30-Day Streak',
    description: '30 consecutive days of learning',
    icon: 'trophy',
  },
  {
    key: 'streak_60',
    name: '60-Day Streak',
    description: '60 consecutive days of learning',
    icon: 'diamond',
  },
  {
    key: 'streak_100',
    name: '100-Day Streak',
    description: '100 consecutive days of learning',
    icon: 'crown',
  },
  {
    key: 'consistency',
    name: 'Consistent',
    description: '5 sessions completed in 7 days',
    icon: 'lightning',
  },
  {
    key: 'comeback',
    name: 'Comeback',
    description: 'Returned to learning after a break',
    icon: 'muscle',
  },
  {
    key: 'chapter_master',
    name: 'Chapter Master',
    description: 'Mastered a chapter concept',
    icon: 'star',
  },
  {
    key: 'mock_complete',
    name: 'Mock Champ',
    description: 'Completed your first full mock exam',
    icon: 'medal',
  },
  {
    key: 'speedster',
    name: 'Speedster',
    description: 'High accuracy with fast completion',
    icon: 'zap',
  },
];

async function seed() {
  try {
    console.log(`DRY_RUN=${DRY_RUN ? 'yes' : 'no'}`);
    for (const b of BADGE_DEFINITIONS) {
      if (DRY_RUN) {
        console.log('[dry-run] upsert badge:', b.key, b.name);
        continue;
      }
      const res = await prisma.badge.upsert({
        where: { key: b.key },
        update: { name: b.name, description: b.description, icon: b.icon },
        create: { key: b.key, name: b.name, description: b.description, icon: b.icon },
      });
      console.log('upserted badge:', res.key);
    }
    console.log('Badge seeding complete');
  } catch (err) {
    console.error('seed-badges failed', String(err));
    process.exitCode = 2;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

seed();
