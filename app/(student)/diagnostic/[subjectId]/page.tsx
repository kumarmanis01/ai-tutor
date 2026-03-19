/**
 * Diagnostic test page — full-screen, no navbar.
 *
 * Fetches questions via generateSubjectDiagnosticTest (board + grade + subject slug),
 * resumes partial state from Redis, then renders DiagnosticFlow.
 *
 * Route: /diagnostic/[subjectId]   (subjectId = SubjectDef CUID)
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSubjectDiagnosticTest } from '@/lib/diagnostics/diagnosticQuestionService';
import { getPartialDiagnostic } from '@/lib/redis/diagnosticPartial';
import DiagnosticFlow, {
  type DiagnosticQuestion,
} from '@/components/student/diagnostic/DiagnosticFlow';

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage({
  params,
}: {
  params: { subjectId: string };
}) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const { subjectId } = params;

  // Fetch student profile — need board slug, grade, language for question generation
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, language: true },
  });

  if (!student?.board || !student?.grade) redirect('/student/onboarding');

  // Fetch SubjectDef with active chapters + topics so we can map topicId → chapterId/name
  const subjectDef = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      slug: true,
      chapters: {
        where: { lifecycle: 'active' },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          topics: {
            where: { lifecycle: 'active' },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!subjectDef) redirect('/dashboard');

  // Content gate — syllabus must have been hydrated (SyllabusWorker writes TopicDef first).
  // Questions are lazy-promoted from GeneratedQuestion on first session use, so we gate
  // on TopicDef presence, not the Question table which starts empty.
  const topicCount = await prisma.topicDef.count({
    where: {
      chapter: { subjectId: subjectDef.id, lifecycle: 'active' },
      lifecycle: 'active',
    },
  });
  if (topicCount === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="max-w-sm text-center px-6">
          <div className="text-4xl mb-4">📚</div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Vidya is getting ready
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            We&apos;re preparing your {subjectDef.name} diagnostic. This usually takes a few
            minutes. Check back shortly.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-[#534AB7] text-white text-sm rounded-lg hover:bg-[#3d3690] transition-colors min-h-[44px] min-w-[44px] leading-[28px]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Build topicId → {chapterId, chapterName} lookup
  const topicChapterMap = new Map<string, { chapterId: string; chapterName: string }>();
  for (const chapter of subjectDef.chapters) {
    for (const topic of chapter.topics) {
      topicChapterMap.set(topic.id, { chapterId: chapter.id, chapterName: chapter.name });
    }
  }

  // Generate (or retrieve cached) diagnostic questions
  let rawQuestions: Awaited<ReturnType<typeof generateSubjectDiagnosticTest>>['questions'] = [];
  try {
    const diagnosticTest = await generateSubjectDiagnosticTest({
      boardSlug: student.board,
      grade: student.grade,
      subjectSlug: subjectDef.slug,
      languageCode: student.language ?? undefined,
    });
    rawQuestions = diagnosticTest.questions;
  } catch {
    redirect('/dashboard');
  }

  if (rawQuestions.length === 0) redirect('/dashboard');

  // Map service question shape → DiagnosticFlow question shape
  const questions: DiagnosticQuestion[] = rawQuestions.map((q) => {
    const chapterInfo = topicChapterMap.get(q.topicId) ?? { chapterId: '', chapterName: '' };
    return {
      id: q.id,
      prompt: q.questionText,
      choices: q.options.map((o) => o.label),
      correctAnswer: q.correctAnswer,
      topicId: q.topicId,
      chapterId: chapterInfo.chapterId,
      chapterName: chapterInfo.chapterName,
    };
  });

  // Resume partial state from Redis (non-fatal if Redis is unavailable)
  const partial = await getPartialDiagnostic(userId, subjectId);
  const initialAnswers = partial?.answers ?? [];
  const initialIndex = Math.min(
    partial?.currentIndex ?? 0,
    Math.max(0, questions.length - 1),
  );

  return (
    <DiagnosticFlow
      subjectId={subjectId}
      subjectName={subjectDef.name}
      questions={questions}
      initialAnswers={initialAnswers}
      initialIndex={initialIndex}
    />
  );
}
