/**
 * Diagnostic placeholder — redirects to dashboard.
 *
 * The full diagnostic UI will replace this file in a future task.
 * This prevents stale links or direct URL visits from showing a 404.
 */
import { redirect } from 'next/navigation';

export default function DiagnosticPage() {
  redirect('/dashboard');
}
