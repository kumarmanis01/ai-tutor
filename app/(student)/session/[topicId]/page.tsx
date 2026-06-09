/**
 * FILE OBJECTIVE:
 * - Unified entry point for /session/[id] URLs.
 * - Accepts either a topicId (canonical) or a legacy sessionId.
 *   If the param resolves to a StructuredSession, redirects permanently
 *   to /session/[topicId] (the canonical form). Otherwise renders the
 *   session for the given topicId directly.
 * - Fetches TopicProgress server-side and derives a toughness recommendation
 *   via getRecommendedToughness() so the DifficultySlider starts at the
 *   AI-suggested level.
 *
 * ARCHITECTURE:
 * - Server component -- resolves the param before any client JS runs.
 * - Passes topicId, reasonLabel, estimatedTimeMin as props to SessionContainer
 *   (a "use client" component) rather than using useParams/useSearchParams.
 * - This replaces both the legacy [sessionId] redirect page and the
 *   [topicId] client-only page, eliminating the ambiguous-route conflict.
 *
 * URL shapes:
 *   /session/[topicId]                      -- canonical
 *   /session/[topicId]?reason=...&time=8    -- with recommendation context
 *   /session/[sessionId]                    -- legacy: redirects to canonical
 *
 * EDIT LOG:
 * - 2026-06-09T20:00:00Z | claude | remove GenerateView / practice section (moved to /chapter/ page)
 * - 2026-06-09T00:00:00Z | claude | S2-3a: fetch TopicProgress + derive toughness recommendation server-side
 * - 2026-03-08 | claude | created for Session Container Architecture
 * - 2026-03-08 | claude | merged legacy [sessionId] redirect into unified page
 *                          to resolve ambiguous-route build error
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { SessionContainer } from '@/components/session/SessionContainer';
import { hasDiagnosticForSubject } from '@/lib/student/diagnosticGuard';
import { isAiTutorEnabledForStudent } from '@/lib/features/aiTutor';
import AITutorSessionShell from '@/components/student/session/AITutorSessionShell';
import { getTopicProgress, getRecommendedToughness } from '@/lib/mastery/topicProgress';
import type { ToughnessRecommendation } from '@/lib/mastery/topicProgress';

interface Props {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ reason?: string; time?: string; sid?: string; cid?: string }>;
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { topicId: id } = await params;
  const { reason, time, sid, cid, focus, itemId } = await searchParams as any;

  // ── Legacy sessionId redirect ─────────────────────────────────────────────
  //
  // If the id matches a StructuredSession, this is an old-style URL.
  // Redirect permanently to the canonical /session/[topicId] form.
  // Auth guard is applied first so unauthenticated users go to sign-in,
  // not to a DB lookup.
  const auth = await getServerSessionForHandlers();
  if (!auth?.user?.id) {
    redirect(`/auth/login?callbackUrl=/session/${id}`);
  }

  // Look up both in parallel; they are mutually exclusive.
  const [legacySession, topic, userProfile] = await Promise.all([
    prisma.structuredSession.findUnique({ where: { id }, select: { topicId: true } }),
    prisma.topicDef.findUnique({
      where: { id },
      select: {
        slug: true,
        name: true,
        chapter: {
          select: {
            subjectId: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { grade: true, board: true },
    }),
  ]);

  if (legacySession) {
    // Legacy sessionId -- redirect to the canonical topicId URL.
    // The diagnostic guard will run again on the redirected request.
    redirect(`/session/${legacySession.topicId}`);
  }

  // ── Canonical topicId path ────────────────────────────────────────────────
  //
  // id is a topicId. Check the diagnostic gate before rendering.
  const subjectId = topic?.chapter?.subjectId;
  if (subjectId) {
    const hasDiag = await hasDiagnosticForSubject(auth.user.id, subjectId);
    // Route group (student) does not add a URL prefix -- correct path is /diagnostic/[id].
    if (!hasDiag) redirect(`/diagnostic/${subjectId}`);
  }

  // ── Toughness recommendation ──────────────────────────────────────────────
  let difficultyRecommendation: ToughnessRecommendation | null = null;

  const topicSlug = topic?.slug ?? null;
  const subjectName = topic?.chapter?.subject?.name ?? null;
  const userGrade = userProfile?.grade ?? null;
  const userBoard = userProfile?.board ?? null;

  if (topicSlug && subjectName && userGrade && userBoard) {
    const progress = await getTopicProgress(auth.user.id, topicSlug, subjectName, userGrade, userBoard).catch(() => null);
    difficultyRecommendation = getRecommendedToughness({
      state: progress?.state ?? null,
      score: progress?.score ?? 0,
      attempts: progress?.attempts ?? 0,
    });
  } else {
    difficultyRecommendation = getRecommendedToughness({ state: null, score: 0, attempts: 0 });
  }

  // ── AI tutor path (sid + cid present) ───────────────────────────────────────
  //
  // sid = tutor session ID from /api/tutor/session/start
  // cid = conceptId from the pre-session screen
  if (sid && cid) {
    const [isAIEnabled, concept] = await Promise.all([
      isAiTutorEnabledForStudent(auth.user.id),
      prisma.concept.findUnique({
        where: { id: cid },
        select: {
          name: true,
          topic: { select: { chapter: { select: { subject: { select: { name: true } } } } } },
        },
      }),
    ]);

    return (
      <AITutorSessionShell
        sessionId={sid}
        conceptId={cid}
        topicId={id}
        conceptName={concept?.name ?? ''}
        subjectName={concept?.topic?.chapter?.subject?.name ?? ''}
        isAITutorEnabled={isAIEnabled}
      />
    );
  }

  // ── V1 MCQ path ───────────────────────────────────────────────────────────
  const reasonLabel = reason ?? null;
  const estimatedTimeMin = time ? Number(time) : undefined;

  return (
    <SessionContainer
      topicId={id}
      reasonLabel={reasonLabel}
      estimatedTimeMin={estimatedTimeMin}
      initialFocus={{ focus: (focus as string) ?? undefined, itemId: (itemId as string) ?? undefined }}
      difficultyRecommendation={difficultyRecommendation ?? undefined}
    />
  );
}

