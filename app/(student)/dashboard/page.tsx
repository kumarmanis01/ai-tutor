/**
 * /dashboard -- redirects to /student/learning-map
 * All entry-points that used to target /dashboard will land on the learning map.
 */

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function StudentDashboardRedirectPage() {
  redirect('/student/learning-map');
}
