<!--
FILE OBJECTIVE:
- Document Prometheus alert and Grafana dashboard for Outbox dead-letter monitoring.

LINKED ALERT RULE:
- deploy/monitoring/prometheus/outbox_deadletter.rules.yml

EDIT LOG:
- 2026-04-11T00:00:00Z | copilot | created outbox dead-letter monitoring docs and alert rule
-->

# Outbox Dead-Letter Monitoring

Purpose: surface and page on any moved Outbox rows (persistent dead letters) so engineers can react before backlogs grow.

Files:

- Prometheus rule: [deploy/monitoring/prometheus/outbox_deadletter.rules.yml](deploy/monitoring/prometheus/outbox_deadletter.rules.yml)
- Grafana dashboard JSON (import): [deploy/monitoring/grafana/dashboards/outbox_deadletter.json](deploy/monitoring/grafana/dashboards/outbox_deadletter.json)

Alert behaviour
---------------

- The rule `OutboxDeadLetterDetected` fires when `sum by(queue, reason) (increase(outbox_deadletter_total[5m])) > 0` for 2m.
- Labels: `severity: page`, `team: content-engineering`.

Why this rule
----------------

- `outbox_deadletter_total` is incremented whenever `Outbox` rows exceed the retry limit and are moved to `OutboxDeadLetter` (see `worker/outboxDispatcher.ts`). A non-zero increase indicates new failures that require investigation.

How to enable
-------------

1. Add the rule file to Prometheus `rule_files` in your Prometheus configuration (example):

```yaml
rule_files:
  - "/etc/prometheus/rules/*.rules.yml"
```

Place `outbox_deadletter.rules.yml` into your rules directory and reload Prometheus (or restart the pod).

2. Ensure Alertmanager/Grafana alerts route `severity: page` to on-call. Update `alertmanager.yml` as needed for routing.

Grafana dashboard
-----------------

- Import the provided dashboard JSON at [deploy/monitoring/grafana/dashboards/outbox_deadletter.json](deploy/monitoring/grafana/dashboards/outbox_deadletter.json) via Grafana → Create → Import.
  - Or use the included import script:

```bash
GRAFANA_URL=https://grafana.example.com GRAFANA_API_KEY=ey... ./deploy/monitoring/grafana/import_dashboard.sh deploy/monitoring/grafana/dashboards/outbox_deadletter.json
```
- Panels query Prometheus for `increase(outbox_deadletter_total[5m])` and `increase(...[1h])` grouped by `queue`.

Runbook (quick)
---------------

1. Inspect the recent dead letters:

```sql
SELECT id, originalOutboxId, queue, deadLetterReason, attempts, failedAt
FROM "OutboxDeadLetter"
ORDER BY failedAt DESC
LIMIT 50;
```

2. Check worker logs around the failedAt timestamps for the `worker/outboxDispatcher` and the target queue processor.

3. If the error is transient (e.g., R2 upload), consider re-enqueueing the payload after investigating the root cause. If systemic, escalate to infra and DB owners.

4. After remediation, verify the alert clears and monitor `increase(outbox_deadletter_total[1h])` for regressions.

Contact
-------
- Team: `content-engineering`
- Runbook link: this document
