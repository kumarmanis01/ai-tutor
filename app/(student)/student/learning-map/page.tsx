/**
 * FILE OBJECTIVE:
 * - Server page entry for S2.1 Learning Map Home Screen.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-map/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.1 learning map page
 */

import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import LearningMapClient from './LearningMapClient';

export const dynamic = 'force-dynamic';

export default async function StudentLearningMapPage() {
  const session = await getServerSessionForHandlers();
  const studentId = (session?.user as { id?: string })?.id;

  if (!studentId) {
    redirect('/auth/signin');
  }

  return <LearningMapClient studentId={studentId} />;
}
