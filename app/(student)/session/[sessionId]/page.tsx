/**
 * FILE OBJECTIVE:
 * - Redirect legacy /session/[sessionId] URLs to /session/[topicId].
 * - The new session architecture routes by topicId (idempotent start/resume).
 * - This preserves any existing deep links or bookmarks.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | replaced 1,206-line monolith with redirect
 *                         (session architecture migration — [topicId] is canonical)
 */

import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

interface Props {
  params: Promise<{ sessionId: string }>;
}

/**
 * Server component — resolves sessionId → topicId, then redirects.
 * No client JS needed; this is a pure server redirect.
 */
export default async function LegacySessionRedirect({ params }: Props) {
  const { sessionId } = await params;

  // Auth guard — unauthenticated requests fall through to middleware
  const auth = await getServerSessionForHandlers();
  if (!auth?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/session/${sessionId}`);
  }

  // Resolve sessionId → topicId from StructuredSession
  const session = await prisma.structuredSession.findUnique({
    where: { id: sessionId },
    select: { topicId: true },
  });

  if (!session) {
    // Session doesn't exist — redirect to dashboard rather than hard 404
    redirect('/dashboard');
  }

  // Permanent redirect to canonical [topicId] route
  redirect(`/session/${session.topicId}`);

  // notFound() is unreachable but satisfies React's return type requirement
  return notFound();
}
