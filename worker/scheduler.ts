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
import { runRecoveryCheck } from '../lib/failureRecovery.js'
import { precomputeReadiness } from './jobs/precomputeReadiness.js';
import { expireStaleTasks } from '../lib/dailyHabit.js';
import { hydrationReconciler } from './services/hydrationReconciler.js';
import { runDailyCostReport } from './services/costReportingWorker.js'
import { runDataDeletionCycle } from './services/dataDeletionWorker.js';
import { prisma } from '@/lib/prisma';
import { sendPushSafe } from '../lib/push/send.js';
import { PUSH_NOTIFICATIONS } from '../lib/push/notifications.js';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const HYDRATION_RECONCILER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MARK_IGNORED_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DAILY_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const READINESS_PRECOMPUTE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const COST_REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DATA_DELETION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
 * Daily AI cost report + alert (6 AM IST = 00:30 UTC)
 */
async function runCostReportJob() {
  try {
    logger.info('scheduler.costReport.starting')
    const result = await runDailyCostReport()
    logger.info('scheduler.costReport.completed', { ...result })
  } catch (error) {
    logger.error('scheduler.costReport.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  setTimeout(runCostReportJob, COST_REPORT_INTERVAL_MS)
}

/**
 * Pre-compute readiness scores for active students (3 AM IST = 21:30 UTC)
 */
async function runReadinessPrecompute() {
  try {
    logger.info('scheduler.readinessPrecompute.starting')
    const { students, scores } = await precomputeReadiness()
    logger.info('scheduler.readinessPrecompute.completed', { students, scores })
  } catch (error) {
    logger.error('scheduler.readinessPrecompute.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  setTimeout(runReadinessPrecompute, READINESS_PRECOMPUTE_INTERVAL_MS)
}

// ── Push notification helpers (called inside runDailyMaintenanceJob) ─────────

async function runInactivityPush(): Promise<void> {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

  // Students inactive for exactly 2 days (first nudge)
  const inactiveDay2 = await prisma.user.findMany({
    where: {
      role: 'user',
      accountStatus: 'active',
      lastSessionDate: { gte: threeDaysAgo, lt: twoDaysAgo },
    },
    select: { id: true, currentStreak: true },
  })
  for (const student of inactiveDay2) {
    await sendPushSafe(student.id, PUSH_NOTIFICATIONS.inactivity_day2(student.currentStreak ?? 0))
  }

  // Students inactive for exactly 3 days (second nudge with topic)
  const inactiveDay3 = await prisma.user.findMany({
    where: {
      role: 'user',
      accountStatus: 'active',
      lastSessionDate: { gte: fourDaysAgo, lt: threeDaysAgo },
    },
    select: { id: true },
  })
  for (const student of inactiveDay3) {
    const nextItem = await prisma.learningPlanItem.findFirst({
      where: { plan: { studentId: student.id }, status: 'UPCOMING' },
      include: { concept: { select: { name: true } } },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
    })
    const topicName = nextItem?.concept?.name ?? 'your next topic'
    await sendPushSafe(student.id, PUSH_NOTIFICATIONS.inactivity_day3(topicName))
  }
  logger.info('scheduler.push.inactivity', {
    day2: inactiveDay2.length,
    day3: inactiveDay3.length,
  })
}

async function runExamCountdownPush(): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const examMilestones = [14, 7, 3, 1]

  for (const daysLeft of examMilestones) {
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + daysLeft)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const plans = await prisma.learningPlan.findMany({
      where: { examDate: { gte: targetDate, lt: nextDay } },
      select: { studentId: true, subjectId: true },
    })

    for (const plan of plans) {
      if (daysLeft === 14) {
        const readiness = await import('../lib/student/examReadiness.js')
          .then((m) => m.computeReadinessScore(plan.studentId, plan.subjectId))
          .catch(() => ({ score: 0 }))
        await sendPushSafe(
          plan.studentId,
          PUSH_NOTIFICATIONS.exam_14_days(plan.subjectId, readiness.score),
        )
      } else if (daysLeft === 7) {
        const topItem = await prisma.learningPlanItem.findFirst({
          where: { plan: { studentId: plan.studentId }, status: 'UPCOMING' },
          include: { concept: { select: { name: true } } },
          orderBy: [{ weekNumber: 'asc' }],
        })
        await sendPushSafe(
          plan.studentId,
          PUSH_NOTIFICATIONS.exam_7_days(plan.subjectId, topItem?.concept?.name ?? 'revision'),
        )
      } else if (daysLeft === 3) {
        await sendPushSafe(plan.studentId, PUSH_NOTIFICATIONS.exam_3_days(plan.subjectId))
      } else if (daysLeft === 1) {
        await sendPushSafe(plan.studentId, PUSH_NOTIFICATIONS.exam_day(plan.subjectId))
      }
    }
  }
  logger.info('scheduler.push.examCountdown', { milestones: examMilestones })
}

async function runRevisionDuePush(): Promise<void> {
  // Only send if current time is between 07:30-09:00 IST
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const hourIST = nowIST.getUTCHours()
  const minuteIST = nowIST.getUTCMinutes()
  const afterHalfPast7 = hourIST === 7 ? minuteIST >= 30 : hourIST === 8
  if (!afterHalfPast7) return

  const groups = await prisma.studentConceptState.groupBy({
    by: ['studentId'],
    where: { nextReviewAt: { lte: new Date() } },
    _count: { id: true },
  })
  for (const { studentId, _count } of groups) {
    if (_count.id > 0) {
      await sendPushSafe(studentId, PUSH_NOTIFICATIONS.revision_due(_count.id))
    }
  }
  logger.info('scheduler.push.revisionDue', { studentsNotified: groups.length })
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

    // ── Push: inactivity reminders ──────────────────────────────────────
    await runInactivityPush();

    // ── Push: exam countdown reminders ──────────────────────────────────
    await runExamCountdownPush();

    // ── Push: revision due (only between 07:30-09:00 IST) ───────────────
    await runRevisionDuePush();
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
 * Nightly DPDP data deletion (02:00 AM IST = 20:30 UTC)
 */
async function runDataDeletionJob() {
  try {
    logger.info('scheduler.dataDeletion.starting')
    const result = await runDataDeletionCycle()
    logger.info('scheduler.dataDeletion.completed', result)
  } catch (error) {
    logger.error('scheduler.dataDeletion.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  setTimeout(runDataDeletionJob, DATA_DELETION_INTERVAL_MS)
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
  const delayReadinessPrecompute = msUntilNextRun(21) + 30 * 60 * 1000; // 21:30 UTC = 3 AM IST
  const delayCostReport = msUntilNextRun(0) + 30 * 60 * 1000; // 00:30 UTC = 6 AM IST

  logger.info('scheduler.scheduled', {
    hydrationReconcilerInterval: '2 minutes (starts immediately)',
    dailyMaintenanceFirstRun: new Date(Date.now() + delayDailyMaintenance).toISOString(),
    markIgnoredFirstRun: new Date(Date.now() + delayMarkIgnored).toISOString(),
    cleanupFirstRun: new Date(Date.now() + delayCleanup).toISOString(),
    weeklyParentFirstRun: new Date(Date.now() + delayWeeklyParent).toISOString(),
    readinessPrecomputeFirstRun: new Date(Date.now() + delayReadinessPrecompute).toISOString(),
    costReportFirstRun: new Date(Date.now() + delayCostReport).toISOString(),
  });

  // Register this process in WorkerLifecycle so the health page can detect it
  await registerSchedulerHeartbeat();

  // Hydration reconciler: run immediately then every 2 minutes
  runHydrationReconciler();

  // Schedule first runs for other jobs
  setTimeout(runDailyMaintenanceJob, delayDailyMaintenance);
  setTimeout(runMarkIgnoredJob, delayMarkIgnored);
  setTimeout(runCleanupJob, delayCleanup);
  setTimeout(runWeeklyParentJob, delayWeeklyParent);
  setTimeout(runReadinessPrecompute, delayReadinessPrecompute);
  setTimeout(runCostReportJob, delayCostReport);

  // Data deletion: 02:00 AM IST = 20:30 UTC
  const delayDataDeletion = msUntilNextRun(20) + 30 * 60 * 1000
  logger.info('scheduler.scheduled.dataDeletion', { firstRun: new Date(Date.now() + delayDataDeletion).toISOString() })
  setTimeout(runDataDeletionJob, delayDataDeletion);

  logger.info('scheduler.started');
}

let _schedulerLifecycleId: string | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function registerSchedulerHeartbeat(): Promise<void> {
  const id = `scheduler-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await prisma.workerLifecycle.create({
      data: {
        id,
        type: 'scheduler',
        host: os.hostname(),
        pid: process.pid,
        status: 'RUNNING',
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });
    _schedulerLifecycleId = id;

    _heartbeatTimer = setInterval(async () => {
      if (!_schedulerLifecycleId) return;
      try {
        await prisma.workerLifecycle.update({
          where: { id: _schedulerLifecycleId },
          data: { lastHeartbeatAt: new Date() },
        });
      } catch (err) {
        logger.error('scheduler.heartbeat.failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, 60_000);
  } catch (err) {
    // Non-fatal: health page will show no heartbeat, but scheduler still runs
    logger.error('scheduler.lifecycle.registerFailed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function stopSchedulerHeartbeat(): Promise<void> {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  if (_schedulerLifecycleId) {
    try {
      await prisma.workerLifecycle.update({
        where: { id: _schedulerLifecycleId },
        data: { status: 'STOPPED', stoppedAt: new Date() },
      });
    } catch {
      // best-effort
    }
    _schedulerLifecycleId = null;
  }
}

/**
 * Graceful shutdown handler
 */
function shutdown() {
  logger.info('scheduler.shutdown');
  stopSchedulerHeartbeat().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// If running directly (not imported)
const isDirectRun = (() => {
  try {
    const selfPath = fileURLToPath(import.meta.url);
    const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return entryArg.length > 0 && path.resolve(selfPath) === entryArg;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  startScheduler().catch((error) => {
    logger.error('scheduler.fatal', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
