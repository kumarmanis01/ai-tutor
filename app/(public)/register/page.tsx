/**
 * FILE OBJECTIVE:
 * - Public registration page. Renders StudentRegistrationWizard.
 *   Accessible without authentication (no requireActiveSession guard).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/public/register.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

import type { Metadata } from 'next';
// import StudentRegistrationWizard from '@/components/student/registration/StudentRegistrationWizard';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Get Started -- Spinzy AI Tutor',
  description: 'Create your student profile and start learning with Spinzy AI Tutor.',
};

export default function RegisterPage() {
  // return <StudentRegistrationWizard />;
  redirect('/auth/signin');
}
