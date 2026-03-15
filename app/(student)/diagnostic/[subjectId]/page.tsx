/**
 * Diagnostic page — v2 Screen 5
 *
 * Server component:
 *   1. Validates session and subjectId
 *   2. Loads subject info + up to 20 questions (varied by chapter, easiest first)
 *   3. Checks Redis for a partial diagnostic state (24h TTL) and resumes from it
 *   4. Renders DiagnosticFlow (client component) with all required data
 *
 * DiagnosticFlow renders full-screen over the StudentNav via z-[100] overlay.
 */

import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getPartialDiagnostic } from '@/lib/redis/diagnosticPartial';
import DiagnosticFlow, { type DiagnosticQuestion } from '@/components/student/diagnostic/DiagnosticFlow';

interface Props {
  params: Promise<{ subjectId: string }>;
}

/** Pick at most `perChapter` questions per chapter, max `total` total. */
function sampleByChapter(
  questions: (DiagnosticQuestion & { chapterId: string })[],
  perChapter: number,
  total: number,
): DiagnosticQuestion[] {
  const countByChapter = new Map<string, number>();
  const selected: DiagnosticQuestion[] = [];

  for (const q of questions) {
    const count = countByChapter.get(q.chapterId) ?? 0;
    if (count >= perChapter) continue;
    countByChapter.set(q.chapterId, count + 1);
    selected.push(q);
    if (selected.length >= total) break;
  }

  return selected;
}

export default async function DiagnosticPage({ params }: Props) {
  const { subjectId } = await params;

  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    redirect(`/auth/signin?callbackUrl=/diagnostic/${encodeURIComponent(subjectId)}`);
  }

  // Load subject
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true },
  });
  if (!subject) redirect('/dashboard');

  // Load topics with their chapter info for this subject
  const topics = await prisma.topicDef.findMany({
    where: {
      chapter: { subjectId, lifecycle: 'active' },
      lifecycle: 'active',
    },
    select: {
      id: true,
      chapterId: true,
      chapter: { select: { name: true } },
    },
  });

  if (topics.length === 0) {
    // No topics seeded yet — redirect to dashboard with a note
    redirect('/dashboard');
  }

  const topicIds = topics.map((t) => t.id);
  const topicMap = new Map(
    topics.map((t) => [t.id, { chapterId: t.chapterId, chapterName: t.chapter.name }]),
  );

  // Load up to 60 questions (will sample 20 with chapter diversity)
  const rawQuestions = await prisma.question.findMany({
    where: {
      topicId: { in: topicIds },
      choices: { not: null },
      correctAnswer: { not: null },
    },
    orderBy: { irt_b: 'asc' },
    take: 60,
    select: {
      id: true,
      prompt: true,
      choices: true,
      correctAnswer: true,
      topicId: true,
    },
  });

  // Map raw DB rows to DiagnosticQuestion + chapterId for sampling
  const mapped = rawQuestions
    .map((q) => {
      const topic = q.topicId ? topicMap.get(q.topicId) : undefined;
      const rawChoices = q.choices;
      const choices: string[] = Array.isArray(rawChoices)
        ? (rawChoices as unknown[]).map((c) => String(c))
        : [];
      if (choices.length < 2) return null; // skip malformed questions
      return {
        id: q.id,
        prompt: q.prompt,
        choices,
        correctAnswer: q.correctAnswer ?? '',
        chapterId: topic?.chapterId ?? '',
        chapterName: topic?.chapterName ?? '',
        topicId: q.topicId ?? '',
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null && q.chapterId !== '');

  // Sample: up to 3 per chapter, max 20 total
  const questions = sampleByChapter(mapped, 3, 20);

  if (questions.length === 0) {
    // No questions seeded for this subject yet — redirect to dashboard
    redirect('/dashboard');
  }

  // Check Redis for partial state
  const partial = await getPartialDiagnostic(userId, subjectId);
  const initialAnswers = partial?.answers ?? [];
  const initialIndex = partial?.currentIndex ?? 0;

  return (
    <DiagnosticFlow
      subjectId={subject.id}
      subjectName={subject.name}
      questions={questions}
      initialAnswers={initialAnswers}
      initialIndex={Math.min(initialIndex, questions.length - 1)}
    />
  );
}
