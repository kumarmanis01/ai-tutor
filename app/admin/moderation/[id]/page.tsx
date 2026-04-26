/**
 * FILE OBJECTIVE:
 * - A1.2: Admin content review page -- entry point for single content item review.
 *   Renders the ContentReviewEditor client component with full-screen layout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/[id]/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.2 content review page
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ContentReviewEditor } from './ContentReviewEditor';

export const dynamic = 'force-dynamic';

type ReviewPageProps = {
  params: { id: string };
};

export default async function ContentReviewPage({ params }: ReviewPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  if (session.user.role !== 'admin' && session.user.role !== 'moderator') {
    redirect('/admin');
  }

  return (
    <div className="h-screen overflow-hidden">
      <ContentReviewEditor contentId={params.id} />
    </div>
  );
}
