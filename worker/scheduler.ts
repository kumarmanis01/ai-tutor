#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Scheduled job runner for daily maintenance tasks
 * - Runs markIgnoredRecommendations daily at 2 AM UTC
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/scheduler.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-01 | claude | created scheduler for ignored recommendations job
 */

import { logger } from '../lib/logger.js';
import { markIgnoredRecommendations, cleanupOldIgnoredRecommendations } from './jobs/markIgnoredRecommendations.js';
import { aggregateWeeklySummaries } from './jobs/weeklyParentSummary.js';
import { sendParentDigests } from './jobs/parentEmailDigest.js';
import { runRecoveryCheck } from '../lib/failureRecovery.js';
import { expireStaleTasks } from '../lib/dailyHabit.js';
import { hydrationReconciler } from './services/hydrationReconciler.js';

const HYDRATION_RECONCILER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MARK_IGNORED_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DAILY_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculate milliseconds until next scheduled time (2 AM UTC)
 */
function msUntilNextRun(targetHour: number = 2): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(targetHour, 0, 0, 0);

  // If target time has passed today, schedule for tomorrow
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Run the mark ignored job and schedule next run
 */
async function runMarkIgnoredJob() {
  try {
    logger.info('scheduler.markIgnored.starting');
    const count = await markIgnoredRecommendations();
    logger.info('scheduler.markIgnored.completed', { count });
  } catch (error) {
    logger.error('scheduler.markIgnored.error', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Schedule next run in 24 hours
  setTimeout(runMarkIgnoredJob, MARK_IGNORED_INTERVAL_MS);
}

/**
 * Run the cleanup job and schedule next run
 */
async function runCleanupJob() {
  try {
    logger.info('scheduler.cleanup.starting');
    const count = await cleanupOldIgnoredRecommendations();
    logger.info('scheduler.cleanup.completed', { count });
  } catch (error) {
    logger.error('scheduler.cleanup.error', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Schedule next run in 7 days
  setTimeout(runCleanupJob, CLEANUP_INTERVAL_MS);
}

/**
 * Run weekly parent summary aggregation then email digests
 */
async function runWeeklyParentJob() {
  try {
    logger.info('scheduler.weeklyParentSummary.starting');
    const count = await aggregateWeeklySummaries();
    logger.info('scheduler.weeklyParentSummary.completed', { count });

    // Send digests after aggregation completes
    logger.info('scheduler.parentEmailDigest.starting');
    const sent = await sendParentDigests();
    logger.info('scheduler.parentEmailDigest.completed', { sent });
  } catch (error) {
    logger.error('scheduler.weeklyParentJob.error', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Schedule next run in 7 days
  setTimeout(runWeeklyParentJob, WEEKLY_INTERVAL_MS);
}

/**
 * Run the hydration reconciler and schedule next run
 */
async function runHydrationReconciler() {
  try {
    logger.info('scheduler.hydrationReconciler.starting');
    await hydrationReconciler.reconcile();
    logger.info('scheduler.hydrationReconciler.completed');
  } catch (error) {
    logger.error('scheduler.hydrationReconciler.error', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Schedule next run in 2 minutes
  setTimeout(runHydrationReconciler, HYDRATION_RECONCILER_INTERVAL_MS);
}

/**
 * Run daily maintenance: expire stale tasks + recovery check
 */
async function runDailyMaintenanceJob() {
  try {
    logger.info('scheduler.dailyMaintenance.starting');

    // Expire yesterday's pending daily tasks
    const expired = await expireStaleTasks();
    logger.info('scheduler.dailyMaintenance.tasksExpired', { expired });

    // Run failure recovery check
    const recoveryEvents = await runRecoveryCheck();
    logger.info('scheduler.dailyMaintenance.recoveryCheck', { recoveryEvents });
  } catch (error) {
    logger.error('scheduler.dailyMaintenance.error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Schedule next run in 24 hours
  setTimeout(runDailyMaintenanceJob, DAILY_MAINTENANCE_INTERVAL_MS);
}

/**
 * Calculate ms until next target day+hour (e.g. Sunday 4 AM UTC)
 */
function msUntilNextWeeklyRun(targetDay: number, targetHour: number): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(targetHour, 0, 0, 0);

  const currentDay = now.getUTCDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
    daysUntil += 7;
  }
  next.setUTCDate(now.getUTCDate() + daysUntil);

  return next.getTime() - now.getTime();
}

/**
 * Start the scheduler
 */
export async function startScheduler() {
  logger.info('scheduler.starting');

  // Validate required environment variables
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  // Calculate time until first run (2 AM UTC)
  const delayMarkIgnored = msUntilNextRun(2);
  const delayCleanup = msUntilNextRun(3); // 3 AM UTC for cleanup
  const delayWeeklyParent = msUntilNextWeeklyRun(0, 4); // Sunday 4 AM UTC
  const delayDailyMaintenance = msUntilNextRun(1); // 1 AM UTC for task expiry + recovery

  logger.info('scheduler.scheduled', {
    hydrationReconcilerInterval: '2 minutes (starts immediately)',
    dailyMaintenanceFirstRun: new Date(Date.now() + delayDailyMaintenance).toISOString(),
    markIgnoredFirstRun: new Date(Date.now() + delayMarkIgnored).toISOString(),
    cleanupFirstRun: new Date(Date.now() + delayCleanup).toISOString(),
    weeklyParentFirstRun: new Date(Date.now() + delayWeeklyParent).toISOString(),
  });

  // Hydration reconciler: run immediately then every 2 minutes
  runHydrationReconciler();

  // Schedule first runs for other jobs
  setTimeout(runDailyMaintenanceJob, delayDailyMaintenance);
  setTimeout(runMarkIgnoredJob, delayMarkIgnored);
  setTimeout(runCleanupJob, delayCleanup);
  setTimeout(runWeeklyParentJob, delayWeeklyParent);

  logger.info('scheduler.started');
}

/**
 * Graceful shutdown handler
 */
function shutdown() {
  logger.info('scheduler.shutdown');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  startScheduler().catch((error) => {
    logger.error('scheduler.fatal', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
