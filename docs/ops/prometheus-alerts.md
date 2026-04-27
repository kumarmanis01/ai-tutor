<!--
FILE OBJECTIVE:
- Document Prometheus metric names introduced for parent notifications and provide
  example alert rules for Ops / SRE to import into their Prometheus/Alertmanager.

LINKED UNIT TEST:
- n/a

EDIT LOG:
- 2026-04-10T00:00:00Z | engineer | added metrics + example alerts
-->

# Prometheus metrics & example alerts — Parent Notifications

This document lists the Prometheus metrics added to the codebase and provides
example alerting rules you can import into your Prometheus/Alertmanager setup.

Metrics introduced

- `notifications_sent_total{type="..."}` — counter: parent notifications successfully sent (label `type` = `milestone`|`digest`|`inactivity`).
- `notifications_failed_total{type="...",reason="..."}` — counter: failed sends with reason label.
- `redis_client_errors_total` — counter: Redis client-level error events observed by the process.
- `notification_suppression_set_failures_total` — counter: failures setting suppression keys (unexpected Redis failures).
- `notification_suppression_delete_failures_total` — counter: failures deleting suppression keys when student becomes active.

Why these alerts?

- Notification failures affect user trust and must be visible to SRE/ops.
- Suppression set/delete failures indicate problems with Redis or code paths that may prevent future alerts from being delivered or cleared.
- Redis client errors are a generic signal of connectivity or provider issues.

Example PrometheusRule (group) — copy into your alert rules file

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: parent-notifications-rules
  labels:
    role: alert-rules
spec:
  groups:
    - name: parent-notifications.rules
      rules:
        - alert: NotificationsFailedSpike
          expr: increase(notifications_failed_total[5m]) > 5
          for: 2m
          labels:
            severity: page
          annotations:
            summary: "Spike in parent notification failures"
            description: "{{ $value }} failures in the last 5m across types. Check mailer / SMS provider and app logs."

        - alert: NotificationSuppressionSetFailures
          expr: increase(notification_suppression_set_failures_total[5m]) > 0
          for: 1m
          labels:
            severity: warning
          annotations:
            summary: "Suppression key set failures"
            description: "Failure(s) setting notification suppression keys observed in the last 5m. This can cause duplicate sends or missed suppression windows."

        - alert: NotificationSuppressionDeleteFailures
          expr: increase(notification_suppression_delete_failures_total[5m]) > 0
          for: 1m
          labels:
            severity: warning
          annotations:
            summary: "Suppression key delete failures"
            description: "Failures deleting suppression keys when students became active. Investigate Redis errors and app logs."

        - alert: RedisClientErrors
          expr: increase(redis_client_errors_total[5m]) > 3
          for: 2m
          labels:
            severity: page
          annotations:
            summary: "Redis client error spike"
            description: "Multiple Redis client errors observed in the last 5m. Check Redis connectivity, auth, and provider status."

        - alert: NotificationsFailedHighRatePerMinute
          expr: increase(notifications_failed_total[1m]) > 3
          for: 1m
          labels:
            severity: page
          annotations:
            summary: "High rate of notification failures (1m)"
            description: "Rapid notification failure rate—investigate mailer/SMS provider, network, or outgoing queue."
```

Suggested runbook steps (brief)

- When `NotificationsFailedSpike` or `NotificationsFailedHighRatePerMinute` fires:
  1. Check the app logs for the `notifications` namespace (web/worker). Look for error messages from `sendMailSafe` or `sendSms` and the underlying provider responses.
  2. Validate provider health (e.g., SendGrid/Twilio/MSG91) and quota/credentials.
  3. If upstream provider is healthy, inspect Redis and notification policy failures.

- When `NotificationSuppressionSetFailures` or `NotificationSuppressionDeleteFailures` fires:
  1. Check Redis connectivity and auth; inspect the `redis_client_errors_total` metric.
  2. Search app logs for `notification.policy: recordSend failed` or `streak.clearInactivitySuppression.error` messages.
  3. If Redis provider has a transient issue, consider failover or restart procedure per infra runbook.

Note

- These example rules are intentionally conservative; adjust `increase()` windows and thresholds to your environment and SLOs before enabling paging alerts.
