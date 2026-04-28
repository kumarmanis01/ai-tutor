/**
 * FILE OBJECTIVE:
 * - Lightweight wrapper for the canonical inactivity-alert job implementation.
 * - This module delegates to `worker/jobs/inactivityAlert.ts` to avoid duplicated
 *   logic between service and job layers. Keeps policy logic centralized.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/inactivityAlertWorker.test.ts
 */

import { logger } from '@/lib/logger';
import { runInactivityAlerts } from '@/worker/jobs/inactivityAlert';

export async function processParentInactivityAlerts(now = new Date()): Promise<void> {
  try {
    await runInactivityAlerts();
  } catch (err) {
    logger.error('inactivityAlertWorker.wrapperFailed', { error: String(err) });
  }
}

export default processParentInactivityAlerts;
