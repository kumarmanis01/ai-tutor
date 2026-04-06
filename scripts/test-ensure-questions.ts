import 'dotenv/config';
import { ensureQuestions } from '../lib/tests';
import { prisma } from '../lib/prisma';

async function run() {
  try {
    const base = { subject: 'mathematics', grade: '10', board: 'cbse', type: 'mcq' } as any;

    for (const d of ['easy', 'medium', 'hard']) {
      const filters = { ...base, difficulty: d };
      const got = await ensureQuestions(filters, 2);
      console.log(`${d}: returned ${got.length} rows -> ids: ${got.map((q) => q.id).slice(0, 10)}`);
    }
  } catch (e) {
    console.error('error running ensureQuestions test:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
