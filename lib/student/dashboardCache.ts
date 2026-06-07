/**
 * FILE OBJECTIVE:
 * - Centralized invalidator for the 60 s student-dashboard aggregate cache
 *   (dash:v1:<userId>). Called from any write that changes dashboard state.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/dashboardCache.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation with standard header.
 */

import { cacheDel } from '@/lib/cache';

export const DASHBOARD_CACHE_KEY = (userId: string) => `dash:v1:${userId}`;

export async function invalidateDashboardCache(userId: string): Promise<void> {
  if (!userId) return;
  await cacheDel(DASHBOARD_CACHE_KEY(userId));
}
