/**
 * FILE OBJECTIVE:
 * - Unified server entry for /session/[topicId].
 * - Handles legacy sessionId -> canonical topicId redirect (DB lookup).
 * - Gates on diagnostic completion for the subject before allowing access
 *   (redirects to /student/diagnostic?subjectId=... if not done).
 * - Supports AI tutor path when sid + cid search params are present.
 * - Passes resolved props to client components; no fetch-to-self.
 *
 * URL shapes:
 *   /session/[topicId]                    -- canonical
 *   /session/[topicId]?reason=...&time=8  -- with recommendation context
 *   /session/[sessionId]                  -- legacy: redirects to canonical
 *   /session/[topicId]?sid=...&cid=...    -- AI tutor path
 *
 * ARCHITECTURE:
 * - Server component: resolves params + DB guard before any client JS runs.
 * - Client components (SessionContainer, AITutorSessionShell) receive typed
 *   props from the server; they do not useParams().
 *
 * EDIT LOG:
 * - 2026-06-04 | claude | rewrite: client shim -> server component; add diagnostic
 *                          guard, legacy sessionId redirect, AI tutor path, reason/time props.
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireActiveSession } from '@/lib/auth';
import { SessionContainer } from '@/components/session/SessionContainer';
import { hasDiagnosticForSubject } from '@/lib/student/diagnosticGuard';
import { isAiTutorEnabledForStudent } from '@/lib/features/aiTutor';
import AITutorSessionShell from '@/components/student/session/AITutorSessionShell';

interface Props {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{
    reason?: string;
    time?: string;
    sid?: string;
    cid?: string;
    focus?: string;
    itemId?: string;
  }>;
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { topicId: id } = await params;
  const { reason, time, sid, cid, focus, itemId } = await searchParams;

  // Auth guard -- unauthenticated users go to sign-in with callbackUrl preserved.
  const auth = await requireActiveSession();
  if (!auth) {
    redirect(`/auth/get-started?callbackUrl=/session/${encodeURIComponent(id)}`);
  }
  const userId = auth.user.id;

  // -- Legacy sessionId redirect ---------------------------------------------------
  //
  // If the id segment resolves to a StructuredSession (old-style URL), redirect
  // permanently to the canonical /session/[topicId] form. The diagnostic guard
  // will run again on the redirected request.
  //
  // Look up both in parallel -- they are mutually exclusive.
  const [legacySession, topic] = await Promise.all([
    prisma.structuredSession.findUnique({
      where: { id },
      select: { topicId: true },
    }),
    prisma.topicDef.findUnique({
      where: { id },
      select: { chapter: { select: { subjectId: true } } },
    }),
  ]);

  if (legacySession) {
    redirect(`/session/${legacySession.topicId}`);
  }

  // -- Diagnostic gate -------------------------------------------------------------
  //
  // Require diagnostic completion for the topic's subject before admitting the
  // student to any session. Redirects to the diagnostic page with subjectId so
  // the picker auto-selects the right subject.
  const subjectId = topic?.chapter?.subjectId;
  if (subjectId) {
    const hasDiag = await hasDiagnosticForSubject(userId, subjectId);
    if (!hasDiag) {
      redirect(`/student/diagnostic?subjectId=${encodeURIComponent(subjectId)}`);
    }
  }

  // -- AI tutor path (sid + cid present) ------------------------------------------
  //
  // sid = tutor session ID from /api/tutor/session/start
  // cid = conceptId from the pre-session screen
  if (sid && cid) {
    const [isAIEnabled, concept] = await Promise.all([
      isAiTutorEnabledForStudent(userId),
      prisma.concept.findUnique({
        where: { id: cid },
        select: {
          name: true,
          topic: {
            select: {
              chapter: {
                select: { subject: { select: { id: true, name: true } } },
              },
            },
          },
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

  // -- V1 MCQ path ----------------------------------------------------------------
  const reasonLabel = reason ?? null;
  const estimatedTimeMin = time ? Number(time) : undefined;

  return (
    <SessionContainer
      topicId={id}
      reasonLabel={reasonLabel}
      estimatedTimeMin={estimatedTimeMin}
      initialFocus={{
        focus: focus ?? undefined,
        itemId: itemId ?? undefined,
      }}
    />
  );
}
