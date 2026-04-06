import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const subjectArg = process.argv[2] ?? 'mathematics';
  const boardArg = process.argv[3] ?? 'cbse';
  const gradeArg = process.argv[4] ?? '10';

  console.log(`Debug query: subject='${subjectArg}', board='${boardArg}', grade='${gradeArg}'`);

  try {
    const rows = await prisma.question.findMany({
      where: {
        status: 'ACTIVE',
        board: { equals: boardArg, mode: 'insensitive' },
        grade: String(gradeArg),
      },
      take: 200,
      select: {
        id: true,
        subject: true,
        board: true,
        grade: true,
        difficulty: true,
        source: true,
        prompt: true,
        choices: true,
        topicId: true,
      },
    });

    console.log(`Found ${rows.length} question rows for board=${boardArg}, grade=${gradeArg}`);

    const subjectCounts = new Map<string | null, number>();
    for (const r of rows) {
      const sub = r.subject ?? null;
      subjectCounts.set(sub, (subjectCounts.get(sub) ?? 0) + 1);
    }

    console.log('Subject value counts (sample):');
    for (const [sub, count] of subjectCounts) {
      console.log(JSON.stringify({ subject: sub, count }));
    }

    console.log('Sample rows (first 20):');
    rows.slice(0, 20).forEach((r) => {
      console.log(
        JSON.stringify({
          id: r.id,
          subject: r.subject,
          board: r.board,
          grade: r.grade,
          difficulty: r.difficulty,
          source: r.source,
          promptSnippet: r.prompt?.slice(0, 200),
          choices: r.choices,
          topicId: r.topicId,
        }),
      );
    });
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
