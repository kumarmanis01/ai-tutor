import 'dotenv/config';
import { generateSubjectDiagnosticTest } from '../lib/diagnostics/diagnosticQuestionService';

async function main() {
  try {
    const result = await generateSubjectDiagnosticTest({
      boardSlug: 'cbse',
      grade: '10',
      subjectSlug: 'mathematics',
      languageCode: 'en',
    });

    console.log('Diagnostic questions count:', result.questions.length);
    console.log('Counts by difficulty:');
    const byDiff: Record<string, number> = {};
    for (const q of result.questions) byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1;
    console.log(byDiff);
    console.log('Sample question ids:', result.questions.slice(0, 20).map((q) => ({ id: q.id, difficulty: q.difficulty, topicId: q.topicId })));
  } catch (e) {
    console.error('generateSubjectDiagnosticTest failed:', e);
  } finally {
    // disconnect prisma if available
    try { const { prisma } = await import('../lib/prisma'); await prisma.$disconnect(); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
