/**
 * FILE OBJECTIVE:
 * - Render the subject diagnostic page with readiness gating, cooldown checks, and question bootstrapping.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/diagnostic/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | enforce full profile completion check and align parent channel field selection
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isProfileComplete } from '@/lib/student/profileGuard';
import { generateSubjectDiagnosticTest } from '@/lib/diagnostics/diagnosticQuestionService';
import { featureFlags } from '@/lib/config';
import { getPartialDiagnostic } from '@/lib/redis/diagnosticPartial';
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore';
import DiagnosticFlow, {
  type DiagnosticQuestion,
} from '@/components/student/diagnostic/DiagnosticFlow';
import SubjectLanguageControl from '@/components/student/SubjectLanguageControl';
import DiagnosticWaitingScreen from '@/components/student/diagnostic/DiagnosticWaitingScreen';

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const authSession = await requireActiveSession();
  if (!authSession) redirect('/');

  const userId = (authSession.user as { id: string }).id;
  const { subjectId } = await params;
  const sp = searchParams ? await searchParams : {};
  const fromEnrollment = sp.from === 'enrollment';
  const afterResultsPath = fromEnrollment ? '/enroll/diagnostic-queue' : '/dashboard';

  // Fetch student profile and completed diagnostics in parallel.
  // Full profile needed to validate enrollment; board/grade/language for question generation;
  // completedSubjectIds for post-submit nudge toast.
  const [student, completedDiagnostics] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        board: true,
        grade: true,
        language: true,
        subjects: true,
        age: true,
        parentEmail: true,
        parentWhatsappPhone: true,
      },
    }),
    prisma.diagnosticSession.findMany({
      where: { studentId: userId, status: 'COMPLETED' },
      select: { subjectId: true },
    }),
  ]);

  // AC: Enforce full profile completion, not just board/grade.
  // This aligns with the layout's profile gate and prevents incomplete students from entering.
  if (!student || !isProfileComplete(student)) redirect('/student/onboarding');

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
      <DiagnosticWaitingScreen
        subjectId={subjectId}
        subjectName={subjectDef.name}
        reason="topics"
      />
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
        // Pass the already-resolved SubjectDef.id to bypass the slug/lifecycle re-lookup
        subjectId: subjectDef.id,
      });
      rawQuestions = diagnosticTest.questions;
      if (rawQuestions.length === 0) questionsReady = false;
    } catch {
      questionsReady = false;
    }
  }

  // Content not ready: topics exist but questions haven't been generated yet.
  if (!questionsReady) {
    return (
      <DiagnosticWaitingScreen
        subjectId={subjectId}
        subjectName={subjectDef.name}
        reason="questions"
      />
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

  // Resume partial state + pending subject list in parallel.
  // pendingSubjects: subjects the student enrolled in (user.subjects) that don't yet
  // have a completed diagnostic -- used for the post-submit nudge toast.
  // Falls back to all active subjects for the grade/board when no enrolled list exists.
  const completedSubjectIdSet = new Set(completedDiagnostics.map((d) => d.subjectId));

  // Parse user.subjects (handles both String[] and Postgres wire-format string)
  let enrolledSubjectNames: string[] | null = null;
  if (student.subjects) {
    if (Array.isArray(student.subjects) && student.subjects.length > 0) {
      enrolledSubjectNames = (student.subjects as string[]).filter(Boolean);
    } else if (typeof student.subjects === 'string' && (student.subjects as string).length > 0) {
      const cleaned = (student.subjects as string).replace(/^\{/, '').replace(/\}$/, '').trim();
      const parts = cleaned.length > 0 ? cleaned.split(',').map((s) => s.trim()).filter(Boolean) : [];
      if (parts.length > 0) enrolledSubjectNames = parts;
    }
  }

  const [partial, pendingSubjectRows] = await Promise.all([
    getPartialDiagnostic(userId, subjectId),
    prisma.subjectDef.findMany({
      where: {
        lifecycle: 'active',
        id: { notIn: [...completedSubjectIdSet, subjectId] },
        class: {
          grade: Number(student.grade),
          board: { slug: { equals: student.board!, mode: 'insensitive' } },
        },
        // Only include subjects the student has enrolled in -- if no enrolled list
        // exists fall back to all subjects (legacy accounts without subject selection).
        ...(enrolledSubjectNames && enrolledSubjectNames.length > 0
          ? { OR: [{ name: { in: enrolledSubjectNames } }, { slug: { in: enrolledSubjectNames } }] }
          : {}),
      },
      select: { name: true },
    }),
  ]);
  const pendingDiagnosticSubjectNames = pendingSubjectRows.map((s) => s.name);
  const initialAnswers = partial?.answers ?? [];
  const initialIndex = Math.min(
    partial?.currentIndex ?? 0,
    Math.max(0, questions.length - 1),
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{subjectDef.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Diagnostic assessment for {subjectDef.name}</p>
          </div>
          <div>
            <SubjectLanguageControl subjectId={subjectId} />
          </div>
        </div>
      </div>

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
        pendingDiagnosticSubjectNames={pendingDiagnosticSubjectNames}
        afterResultsPath={afterResultsPath}
      />
    </div>
  );
}
