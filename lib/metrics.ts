/**
 * FILE OBJECTIVE:
 * - Centralized Prometheus metric counters used across workers and web handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/metrics.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 */

import client from 'prom-client';

const register = client.register;

// Notification metrics
const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total parent notifications sent',
  labelNames: ['type'] as const,
});
const notificationsFailed = new client.Counter({
  name: 'notifications_failed_total',
  help: 'Total parent notifications failed',
  labelNames: ['type', 'reason'] as const,
});

// Redis / suppression metrics
const redisErrors = new client.Counter({
  name: 'redis_client_errors_total',
  help: 'Redis client error events',
});
const suppressionSetFailures = new client.Counter({
  name: 'notification_suppression_set_failures_total',
  help: 'Failures when setting suppression keys',
});
const suppressionDeleteFailures = new client.Counter({
  name: 'notification_suppression_delete_failures_total',
  help: 'Failures deleting suppression keys',
});

export function incNotificationSent(type: string) {
  try {
    notificationsSent.labels(type).inc();
  } catch {}
}
export function incNotificationFailed(type: string, reason: string) {
  try {
    notificationsFailed.labels(type, reason).inc();
  } catch {}
}
export function incRedisError() {
  try {
    redisErrors.inc();
  } catch {}
}
export function incSuppressionSetFailure() {
  try {
    suppressionSetFailures.inc();
  } catch {}
}
export function incSuppressionDeleteFailure() {
  try {
    suppressionDeleteFailures.inc();
  } catch {}
}

export { register };
