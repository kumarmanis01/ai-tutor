/**
 * FILE OBJECTIVE:
 * - Parent dashboard page for viewing linked students' learning progress.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/parent/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created parent dashboard page
 */

import type { Metadata } from 'next';
import ParentDashboardClient from './ParentDashboardClient';

export const metadata: Metadata = {
  title: 'Parent Dashboard | Spinzy Academy',
  description: 'Monitor your child\'s learning progress, test scores, and activity on Spinzy Academy.',
};

export default function ParentDashboardPage() {
  return <ParentDashboardClient />;
}
