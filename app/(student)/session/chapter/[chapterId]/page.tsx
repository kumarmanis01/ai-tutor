/**
 * FILE OBJECTIVE:
 * - Permanent redirect from /session/chapter/[id] to /chapter/[id].
 *   The page was moved so the global Topbar renders (Topbar suppresses on /session/ paths).
 *
 * EDIT LOG:
 * - 2026-06-09T16:00:00Z | claude | replace with redirect to /chapter/[chapterId]
 * - 2026-06-09T12:00:00Z | claude | initial implementation (now moved to /chapter/)
 */

import { permanentRedirect } from 'next/navigation';

interface Props {
  params: Promise<{ chapterId: string }>;
}

export default async function ChapterSessionRedirectPage({ params }: Props) {
  const { chapterId } = await params;
  permanentRedirect(`/chapter/${chapterId}`);
}
