/**
 * FILE OBJECTIVE:
 * - Server entry page for S2.3 practice flow from lesson/learning map.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-map/topic/topicId/practice/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.3 topic practice page
 */

import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import PracticeFlow from '@/components/student/practice/PracticeFlow';

export const dynamic = 'force-dynamic';

type PracticePageProps = {
  params: { topicId: string };
};

export default async function TopicPracticePage({ params }: PracticePageProps) {
  const { topicId } = params;
  const session = await getServerSessionForHandlers();
  const studentId = (session?.user as { id?: string })?.id;

  if (!studentId) {
    redirect('/auth/signin');
  }

  return <PracticeFlow studentId={studentId} topicId={topicId} />;
}
