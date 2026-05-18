/**
 * FILE OBJECTIVE:
 * - Permanent 308 redirect. /auth/signin was renamed to /auth/login in the Step 3
 *   auth route refactor. This shim keeps old bookmarks and external links working.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | replace sign-in page with redirect to /auth/login
 */
import { redirect } from 'next/navigation';

export default function SigninRedirect() {
  redirect('/auth/login');
}
