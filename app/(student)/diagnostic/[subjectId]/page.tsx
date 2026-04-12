/**
 * Diagnostic test page -- full-screen, no navbar.
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
import { featureFlags } from '@/lib/config';
import { getPartialDiagnostic } from '@/lib/redis/diagnosticPartial';
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore';
import DiagnosticFlow, {
  type DiagnosticQuestion,
} from '@/components/student/diagnostic/DiagnosticFlow';

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const { subjectId } = await params;

  // Fetch student profile -- need board slug, grade, language for question generation
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: { board: true, grade: true, language: true },
  });

  if (!student?.board || !student?.grade) redirect('/student/onboarding');

  // AC-08: enforce 30-day retake cooldown at the page level so the student sees a
  // clear "come back later" screen rather than loading the quiz UI and failing.
  const diagnosticStatus = await getSubjectDiagnosticStatus(userId, subjectId);
  if (diagnosticStatus.status === 'completed' && diagnosticStatus.completedAt) {
    const cooldownMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const eligibleAt = new Date(new Date(diagnosticStatus.completedAt).getTime() + cooldownMs);
    if (Date.now() < eligibleAt.getTime()) {
      const eligibleDateStr = eligibleAt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 px-4">
          <div className="max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FAEEDA] dark:bg-[#BA7517]/20 flex items-center justify-center mx-auto mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" className="w-8 h-8" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Diagnostic completed
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Your next retake is available on
            </p>
            <p className="text-sm font-semibold text-[#BA7517] mb-6">{eligibleDateStr}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
              Retakes use a fresh question set. Results update your knowledge map.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-full min-h-[44px] px-5 py-2.5 bg-[#534AB7] hover:bg-[#4840a3] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      );
    }
  }

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

  // Content gate -- syllabus must have been hydrated (SyllabusWorker writes TopicDef first).
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
          <div className="w-16 h-16 rounded-2xl bg-[#EEEDFE] flex items-center justify-center text-3xl mx-auto mb-5">
            📚
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Vidya is getting ready
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            We are preparing your content. Check back in a few minutes.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 bg-[#534AB7] hover:bg-[#3C3489] text-white text-sm font-medium rounded-xl transition-colors min-h-[44px]"
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

  // If adaptive diagnostic feature is enabled, we do not pre-generate the full
  // question batch on the page. The client will call the `start` API to bootstrap
  // a server-driven adaptive session. Otherwise, generate the full test here.
  let rawQuestions: Awaited<ReturnType<typeof generateSubjectDiagnosticTest>>['questions'] = [];
  let questionsReady = true;
  if (!featureFlags.adaptiveDiagnostic) {
    try {
      const diagnosticTest = await generateSubjectDiagnosticTest({
        boardSlug: student.board,
        grade: student.grade,
        subjectSlug: subjectDef.slug,
        languageCode: student.language ?? undefined,
      });
      rawQuestions = diagnosticTest.questions;
      if (rawQuestions.length === 0) questionsReady = false;
    } catch {
      questionsReady = false;
    }
  }

  // Content not ready: topics exist but questions haven't been generated yet.
  // Show "Vidya is getting ready" rather than bouncing to dashboard.
  if (!questionsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-6">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EEEDFE] flex items-center justify-center text-3xl mx-auto mb-5">
            📚
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Vidya is getting ready
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            We are preparing your content. Check back in a few minutes.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-5 py-2.5 bg-[#534AB7] hover:bg-[#3C3489] text-white text-sm font-medium rounded-xl transition-colors"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

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
      // When running adaptive diagnostic, pass board/grade/subjectSlug so client can call start API
      boardSlug={student.board}
      grade={student.grade}
      subjectSlug={subjectDef.slug}
    />
  );
}
