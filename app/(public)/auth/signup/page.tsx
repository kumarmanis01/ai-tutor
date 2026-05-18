/**
 * FILE OBJECTIVE:
 * - Permanent 308 redirect. /auth/signup was renamed to /auth/get-started in the Step 3
 *   auth route refactor. This shim keeps old bookmarks and external links working.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | replace signup page with redirect to /auth/get-started
 */
import { redirect } from 'next/navigation';

export default function SignupRedirect() {
  redirect('/auth/get-started');
}
