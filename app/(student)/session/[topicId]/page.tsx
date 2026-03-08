/**
 * FILE OBJECTIVE:
 * - Unified entry point for /session/[id] URLs.
 * - Accepts either a topicId (canonical) or a legacy sessionId.
 *   If the param resolves to a StructuredSession, redirects permanently
 *   to /session/[topicId] (the canonical form). Otherwise renders the
 *   session for the given topicId directly.
 *
 * ARCHITECTURE:
 * - Server component — resolves the param before any client JS runs.
 * - Passes topicId, reasonLabel, estimatedTimeMin as props to SessionContainer
 *   (a "use client" component) rather than using useParams/useSearchParams.
 * - This replaces both the legacy [sessionId] redirect page and the
 *   [topicId] client-only page, eliminating the ambiguous-route conflict.
 *
 * URL shapes:
 *   /session/[topicId]                      — canonical
 *   /session/[topicId]?reason=...&time=8    — with recommendation context
 *   /session/[sessionId]                    — legacy: redirects to canonical
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

interface Props {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ reason?: string; time?: string }>;
}

export default async function SessionPage({ params, searchParams }: Props) {
  const { topicId: id } = await params;
  const { reason, time } = await searchParams;

  // ── Legacy sessionId redirect ─────────────────────────────────────────────
  //
  // If the id matches a StructuredSession, this is an old-style URL.
  // Redirect permanently to the canonical /session/[topicId] form.
  // Auth guard is applied first so unauthenticated users go to sign-in,
  // not to a DB lookup.
  const auth = await getServerSessionForHandlers();
  if (!auth?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/session/${id}`);
  }

  const session = await prisma.structuredSession.findUnique({
    where: { id },
    select: { topicId: true },
  });

  if (session) {
    // Legacy sessionId — redirect to the canonical topicId URL
    redirect(`/session/${session.topicId}`);
  }

  // ── Canonical topicId path ────────────────────────────────────────────────
  //
  // id is a topicId. Pass it directly to SessionContainer as a prop
  // (no useParams/useSearchParams needed in the client component).
  const reasonLabel = reason ?? null;
  const estimatedTimeMin = time ? Number(time) : undefined;

  return (
    <SessionContainer
      topicId={id}
      reasonLabel={reasonLabel}
      estimatedTimeMin={estimatedTimeMin}
    />
  );
}
