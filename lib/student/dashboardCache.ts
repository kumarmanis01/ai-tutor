/**
 * Centralized dashboard cache invalidator.
 *
 * The student dashboard endpoint caches its aggregate response for 60 s
 * (see app/api/dashboard/route.ts `dash:v1:<userId>`). Without explicit
 * invalidation, completing a session, submitting homework, or any other
 * write that affects the dashboard surface leaves the student looking at
 * stale numbers for up to a minute.
 *
 * Call this immediately after any write that changes dashboard state.
 * It's best-effort and never throws -- the dashboard route will recompute
 * on the next request if the delete fails.
 */

import { cacheDel } from '@/lib/cache';

export const DASHBOARD_CACHE_KEY = (userId: string) => `dash:v1:${userId}`;

export async function invalidateDashboardCache(userId: string): Promise<void> {
  if (!userId) return;
  await cacheDel(DASHBOARD_CACHE_KEY(userId));
}
