/**
 * FILE OBJECTIVE:
 * - Unified entry point for /session/[id] URLs.
 * - Accepts either a topicId (canonical) or a legacy sessionId.
 *   If the param resolves to a StructuredSession, redirects permanently
 *   to /session/[topicId] (the canonical form). Otherwise renders the
 *   session for the given topicId directly.
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
  const [legacySession, topic] = await Promise.all([
    prisma.structuredSession.findUnique({ where: { id }, select: { topicId: true } }),
    prisma.topicDef.findUnique({
      where: { id },
      select: { chapter: { select: { subjectId: true } } },
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
          topic: { select: { chapter: { select: { subject: { select: { id: true, name: true } } } } } },
        },
      }),
    ]);

    return (
      <AITutorSessionShell
        sessionId={sid}
        conceptId={cid}
        topicId={id}
        conceptName={concept?.name ?? ''}
        subjectId={concept?.topic?.chapter?.subject?.id ?? ''}
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
    />
  );
}
