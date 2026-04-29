/**
 * FILE OBJECTIVE:
 * - Server entry page for S2.2 lesson view on the student learning map.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-map/topic/topicId/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.2 topic lesson page
 */

import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import LessonExperience from '@/components/student/learning-map/LessonExperience';

export const dynamic = 'force-dynamic';

type TopicPageProps = {
  params: Promise<{ topicId: string }>;
};

export default async function TopicLessonPage({ params }: TopicPageProps) {
  const { topicId } = await params;
  const session = await getServerSessionForHandlers();
  const studentId = (session?.user as { id?: string })?.id;

  if (!studentId) {
    redirect('/auth/signin');
  }

  return <LessonExperience studentId={studentId} topicId={topicId} />;
}
