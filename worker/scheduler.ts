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
 * - 2026-04-11T07:54:52Z | copilot | fix: remove non-existent 'accountStatus' from Prisma UserWhereInput
 * - 2026-05-05T12:30:00Z | copilot | fix: replace MONTHLY_INTERVAL_MS (overflows 32-bit timer) with msUntilNextMonthlyRun() in self-reschedule
 * - 2026-05-09T00:00:00Z | copilot | add nightly 00:00 UTC unit+integration test execution and email report automation
 */

import { logger } from '../lib/logger.js';
import { safeSetTimeout } from '../lib/safeSetTimeout.js';
import { markIgnoredRecommendations, cleanupOldIgnoredRecommendations } from './jobs/markIgnoredRecommendations.js';
import { aggregateWeeklySummaries } from './jobs/weeklyParentSummary.js';
import { sendParentDigests } from './jobs/parentEmailDigest.js';
import { runWeeklyQuestionHealth } from './jobs/weeklyQuestionHealth.js';
import { runInactivityAlerts } from './jobs/inactivityAlert.js';
import { runRecoveryCheck } from '../lib/failureRecovery.js'
import { precomputeReadiness } from './jobs/precomputeReadiness.js';
import { expireStaleTasks } from '../lib/dailyHabit.js';
import { hydrationReconciler } from './services/hydrationReconciler.js';
import { runDailyCostReport } from './services/costReportingWorker.js'
import { runDataDeletionCycle } from './services/dataDeletionWorker.js';
import { processReadinessDropAlerts } from './services/readinessDropWorker.js';
import { runMonthlyMisconceptionPrevalence } from './services/misconceptionPrevalenceWorker.js';
import { processDoubtEscalationNotifications } from './services/doubtEscalationNotifier.js';
import { weeklyPlanAdjust } from './jobs/weeklyPlanAdjust.js';
import { sendFreemiumResetNotifications } from './jobs/freemiumResetNotifications.js';
import { runWeeklyRatingAggregation } from './jobs/weeklyRatingAggregation.js';
import { runDailyLatencyReport } from './jobs/dailyLatencyReport.js';
import { runDailyQuestionGenMetrics } from './jobs/dailyQuestionGenMetrics.js';
import { runDiagnosticReadinessCheck } from './jobs/diagnosticReadinessCheck.js';
import { runNightlyTestReportAndEmail } from './jobs/nightlyTestReport.js';
import { aggregateDay } from './services/analyticsAggregator.js';
import { prisma } from '../lib/prisma.js';
import { sendPushSafe } from '../lib/push/send.js';
import { PUSH_NOTIFICATIONS } from '../lib/push/notifications.js';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const HYDRATION_RECONCILER_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MARK_IGNORED_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WEEKLY_PLAN_ADJUST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DAILY_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const READINESS_PRECOMPUTE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const COST_REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DATA_DELETION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
// NOTE: MONTHLY_INTERVAL_MS (2_592_000_000) was removed -- it exceeds Node.js 32-bit
// setTimeout limit and caused TimeoutOverflowWarning. Use msUntilNextMonthlyRun() instead.
const WEEKLY_RATING_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DAILY_LATENCY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAILY_QUESTION_GEN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ANALYTICS_AGGREGATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NIGHTLY_TEST_REPORT_TARGET_HOUR_UTC = 0;

let nightlyTestReportRunning = false;

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
    // Run weekly question health check and emit analytics
    try {
      logger.info('scheduler.weeklyQuestionHealth.starting');
      const lowCount = await runWeeklyQuestionHealth();
      logger.info('scheduler.weeklyQuestionHealth.completed', { lowCount });
    } catch (err) {
      logger.error('scheduler.weeklyQuestionHealth.error', { error: err instanceof Error ? err.message : String(err) });
    }
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
 * AC-05 (F-STU-040): Send freemium reset push notifications.
 * Checks calendar internally -- only sends on the day that is 3 days before
 * the 1st of next month; no-ops on all other days.
 */
async function runFreemiumResetNotifications(): Promise<void> {
  try {
    const result = await sendFreemiumResetNotifications()
    if (!result.skipped) {
      logger.info('scheduler.freemiumResetNotifications.completed', {
        daysLeft: result.daysLeft,
        eligible: result.eligible,
        sent: result.sent,
      })
    }
  } catch (error) {
    logger.error('scheduler.freemiumResetNotifications.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const AI_CONTENT_LOG_RETENTION_DAYS = Number(process.env.AI_CONTENT_LOG_RETENTION_DAYS || 30);
const AI_CONTENT_LOG_PURGE_BATCH = 500;

/**
 * Delete AIContentLog rows older than AI_CONTENT_LOG_RETENTION_DAYS.
 * Runs in batches to avoid long-running deletes on Neon.
 */
async function purgeOldAIContentLogs(): Promise<number> {
  const threshold = new Date(Date.now() - AI_CONTENT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.aIContentLog.findMany({
      where: { createdAt: { lt: threshold } },
      select: { id: true },
      take: AI_CONTENT_LOG_PURGE_BATCH,
    });
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    await prisma.aIContentLog.deleteMany({ where: { id: { in: ids } } });
    total += ids.length;
    if (ids.length < AI_CONTENT_LOG_PURGE_BATCH) break;
  }
  return total;
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

    // Run parent inactivity alerts (email / SMS)
    logger.info('scheduler.parentInactivityAlerts.starting');
    const parentAlerts = await runInactivityAlerts();
    logger.info('scheduler.parentInactivityAlerts.completed', { sent: parentAlerts });

    // ── Push: inactivity reminders ──────────────────────────────────────
    await runInactivityPush();

    // ── Parent alerts: inactivity & readiness-drop (daily) ──────────────
    // Ensure readiness precompute has run so that historical snapshots and cache
    // are available for the readiness-drop detector. This is best-effort and
    // will not abort the rest of the maintenance job on failure.
    try {
      logger.info('scheduler.ensureReadinessPrecompute.starting')
      await precomputeReadiness()
      logger.info('scheduler.ensureReadinessPrecompute.completed')
    } catch (e) {
      logger.error('scheduler.ensureReadinessPrecompute.failed', { err: e instanceof Error ? e.message : String(e) })
    }

    // Parent inactivity alerts are handled by `runInactivityAlerts()` above.
    // Avoid calling `processParentInactivityAlerts()` here to prevent duplicate
    // notifications and ensure centralized suppression policies are honored.

    try {
      await processReadinessDropAlerts();
    } catch (e) {
      logger.error('scheduler.readinessDrop.failed', { err: e instanceof Error ? e.message : String(e) });
    }

    // ── Notify students for resolved escalations that haven't been notified yet
    try {
      const processed = await processDoubtEscalationNotifications();
      logger.info('scheduler.doubtEscalationNotifier.completed', { processed });
    } catch (e) {
      logger.error('scheduler.doubtEscalationNotifier.error', { err: e instanceof Error ? e.message : String(e) });
    }

    // ── Notify students waiting for their diagnostic to become available ──────
    try {
      const { checked, notified } = await runDiagnosticReadinessCheck();
      logger.info('scheduler.diagnosticReadinessCheck.completed', { checked, notified });
    } catch (e) {
      logger.error('scheduler.diagnosticReadinessCheck.error', { err: e instanceof Error ? e.message : String(e) });
    }

    // ── Push: exam countdown reminders ──────────────────────────────────
    await runExamCountdownPush();

    // ── Push: revision due (only between 07:30-09:00 IST) ───────────────
    await runRevisionDuePush();

    // ── Push: freemium reset reminder (only fires 3 days before month-end) ──
    await runFreemiumResetNotifications();

    // ── Purge old AIContentLog rows ──────────────────────────────────────
    try {
      const purged = await purgeOldAIContentLogs();
      logger.info('scheduler.aiContentLogPurge.completed', { purged });
    } catch (e) {
      logger.error('scheduler.aiContentLogPurge.error', { err: e instanceof Error ? e.message : String(e) });
    }
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
 * AC-05 (F-STU-003): Weekly learning plan auto-adjust (Sunday 5 AM UTC).
 * Detects students behind their plan and regenerates to re-prioritise.
 */
async function runWeeklyPlanAdjustJob() {
  try {
    logger.info('scheduler.weeklyPlanAdjust.starting')
    const { checked, adjusted } = await weeklyPlanAdjust()
    logger.info('scheduler.weeklyPlanAdjust.completed', { checked, adjusted })
  } catch (error) {
    logger.error('scheduler.weeklyPlanAdjust.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  setTimeout(runWeeklyPlanAdjustJob, WEEKLY_PLAN_ADJUST_INTERVAL_MS)
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
 * Calculate ms until next monthly run (1st of next month at targetHour UTC)
 */
function msUntilNextMonthlyRun(targetHour: number = 4): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  // first day of next month
  const next = new Date(Date.UTC(year, month + 1, 1, targetHour, 0, 0));
  return next.getTime() - now.getTime();
}

async function runMisconceptionPrevalenceJob() {
  try {
    logger.info('scheduler.misconceptionPrevalence.starting');
    const res = await runMonthlyMisconceptionPrevalence();
    logger.info('scheduler.misconceptionPrevalence.completed', res);
  } catch (err) {
    logger.error('scheduler.misconceptionPrevalence.error', { error: err instanceof Error ? err.message : String(err) });
  }

  // safeSetTimeout is required here: msUntilNextMonthlyRun() can return up to ~31 days
  // (~2.6 billion ms) which exceeds Node.js's 32-bit setTimeout limit (2,147,483,647 ms)
  // and causes TimeoutOverflowWarning + clamping to 1 ms.
  safeSetTimeout(runMisconceptionPrevalenceJob, msUntilNextMonthlyRun());
}

/**
 * F-ADM-010 AC-06: Weekly session rating aggregation (Sunday 6 AM UTC)
 */
async function runWeeklyRatingAggregationJob() {
  try {
    logger.info('scheduler.weeklyRatingAggregation.starting')
    const result = await runWeeklyRatingAggregation()
    logger.info('scheduler.weeklyRatingAggregation.completed', { ...result })
  } catch (error) {
    logger.error('scheduler.weeklyRatingAggregation.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  setTimeout(runWeeklyRatingAggregationJob, WEEKLY_RATING_INTERVAL_MS)
}

/**
 * F-ADM-032 AC-02: Daily p95 latency report (01:00 UTC = 6:30 AM IST)
 */
async function runDailyLatencyReportJob() {
  try {
    logger.info('scheduler.dailyLatencyReport.starting')
    const result = await runDailyLatencyReport()
    logger.info('scheduler.dailyLatencyReport.completed', { ...result })
  } catch (error) {
    logger.error('scheduler.dailyLatencyReport.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  setTimeout(runDailyLatencyReportJob, DAILY_LATENCY_INTERVAL_MS)
}

/**
 * F-ADM-032 AC-03: Daily question-gen failure rate (01:30 UTC = 7 AM IST)
 */
async function runDailyQuestionGenMetricsJob() {
  try {
    logger.info('scheduler.dailyQuestionGenMetrics.starting')
    const result = await runDailyQuestionGenMetrics()
    logger.info('scheduler.dailyQuestionGenMetrics.completed', { ...result })
  } catch (error) {
    logger.error('scheduler.dailyQuestionGenMetrics.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  setTimeout(runDailyQuestionGenMetricsJob, DAILY_QUESTION_GEN_INTERVAL_MS)
}

/**
 * Daily analytics aggregation: rolls up AnalyticsEvent rows into
 * AnalyticsDailyAggregate. Runs at 03:30 UTC (9 AM IST) for the previous day.
 */
async function runAnalyticsAggregatorJob() {
  try {
    logger.info('scheduler.analyticsAggregator.starting')
    // Aggregate yesterday so all events for the day are fully ingested
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const courses = await aggregateDay(yesterday)
    logger.info('scheduler.analyticsAggregator.completed', { coursesProcessed: courses.length })
  } catch (error) {
    logger.error('scheduler.analyticsAggregator.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  setTimeout(runAnalyticsAggregatorJob, ANALYTICS_AGGREGATE_INTERVAL_MS)
}

/**
 * Nightly VPS test report (00:00 UTC): run unit + integration suites and email report.
 */
async function runNightlyTestReportJob() {
  if (nightlyTestReportRunning) {
    logger.warn('scheduler.nightlyTests.skipped.alreadyRunning')
    setTimeout(runNightlyTestReportJob, msUntilNextRun(NIGHTLY_TEST_REPORT_TARGET_HOUR_UTC))
    return
  }

  nightlyTestReportRunning = true
  try {
    await runNightlyTestReportAndEmail()
  } catch (error) {
    logger.error('scheduler.nightlyTests.error', {
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    nightlyTestReportRunning = false
    setTimeout(runNightlyTestReportJob, msUntilNextRun(NIGHTLY_TEST_REPORT_TARGET_HOUR_UTC))
  }
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
  const delayNightlyTestReport = msUntilNextRun(NIGHTLY_TEST_REPORT_TARGET_HOUR_UTC); // 00:00 UTC
  const delayWeeklyPlanAdjust = msUntilNextWeeklyRun(0, 5); // Sunday 5 AM UTC

  logger.info('scheduler.scheduled', {
    hydrationReconcilerInterval: '2 minutes (starts immediately)',
    dailyMaintenanceFirstRun: new Date(Date.now() + delayDailyMaintenance).toISOString(),
    markIgnoredFirstRun: new Date(Date.now() + delayMarkIgnored).toISOString(),
    cleanupFirstRun: new Date(Date.now() + delayCleanup).toISOString(),
    weeklyParentFirstRun: new Date(Date.now() + delayWeeklyParent).toISOString(),
    readinessPrecomputeFirstRun: new Date(Date.now() + delayReadinessPrecompute).toISOString(),
    costReportFirstRun: new Date(Date.now() + delayCostReport).toISOString(),
    nightlyTestReportFirstRun: new Date(Date.now() + delayNightlyTestReport).toISOString(),
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
  setTimeout(runNightlyTestReportJob, delayNightlyTestReport);
  setTimeout(runWeeklyPlanAdjustJob, delayWeeklyPlanAdjust);

  // Data deletion: 02:00 AM IST = 20:30 UTC
  const delayDataDeletion = msUntilNextRun(20) + 30 * 60 * 1000
  logger.info('scheduler.scheduled.dataDeletion', { firstRun: new Date(Date.now() + delayDataDeletion).toISOString() })
  setTimeout(runDataDeletionJob, delayDataDeletion);

  // Monthly misconception prevalence job (1st of next month at 04:00 UTC)
  // safeSetTimeout used: delay can be up to ~31 days, exceeding Node.js 32-bit limit.
  const delayMonthlyMisconception = msUntilNextMonthlyRun(4)
  logger.info('scheduler.scheduled.misconceptionPrevalence', { firstRun: new Date(Date.now() + delayMonthlyMisconception).toISOString() })
  safeSetTimeout(runMisconceptionPrevalenceJob, delayMonthlyMisconception);

  // Weekly rating aggregation: Sunday 6 AM UTC
  const delayWeeklyRating = msUntilNextWeeklyRun(0, 6)
  logger.info('scheduler.scheduled.weeklyRatingAggregation', { firstRun: new Date(Date.now() + delayWeeklyRating).toISOString() })
  setTimeout(runWeeklyRatingAggregationJob, delayWeeklyRating)

  // Daily latency report: 01:00 UTC
  const delayLatencyReport = msUntilNextRun(1)
  logger.info('scheduler.scheduled.dailyLatencyReport', { firstRun: new Date(Date.now() + delayLatencyReport).toISOString() })
  setTimeout(runDailyLatencyReportJob, delayLatencyReport)

  // Daily question-gen metrics: 01:30 UTC
  const delayQuestionGenMetrics = msUntilNextRun(1) + 30 * 60 * 1000
  logger.info('scheduler.scheduled.dailyQuestionGenMetrics', { firstRun: new Date(Date.now() + delayQuestionGenMetrics).toISOString() })
  setTimeout(runDailyQuestionGenMetricsJob, delayQuestionGenMetrics)

  // Analytics daily aggregation: 03:30 UTC (9 AM IST) -- aggregate previous day's events
  const delayAnalyticsAggregate = msUntilNextRun(3) + 30 * 60 * 1000
  logger.info('scheduler.scheduled.analyticsAggregator', { firstRun: new Date(Date.now() + delayAnalyticsAggregate).toISOString() })
  setTimeout(runAnalyticsAggregatorJob, delayAnalyticsAggregate)

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
