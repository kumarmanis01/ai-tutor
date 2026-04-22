<!--
FILE OBJECTIVE:
- Master index for the analytics document set under docs/v2/analytics.

LINKED UNIT TEST:
- tests/unit/docs/analytics_master.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-21T10:50:00Z | copilot | created MASTER index for analytics docs
 - 2026-04-22T09:00:00Z | staff-engineer | appended analytics audit findings and instrumentation guide
-->

# Analytics Docs — Master Index

Purpose
- A short directory of analytics-related documentation, their purpose, last-edit timestamp, and required follow-ups. Use this as the canonical entry point for analytics work.

Status Legend
- Needs action: document requires follow-up work or code changes.
- Blocked: blocked until higher-priority task (eg. prompt redaction) is complete.
- Ready: informational; no immediate action required.

Documents
- [analytics_admin_audit_report.md](analytics_admin_audit_report.md)
  - Purpose: Consolidated audit report, findings, decisions, and prioritized implementation roadmap (Tasks A–L).
  - Last edit: 2026-04-21T10:36:00Z
  - Status: Needs action — Critical follow-ups: Task A (prompt redaction), Task C (subject_selected instrumentation), Task E (aggregator implementation — blocked until redaction).

- [analytics_event_callsites.csv](analytics_event_callsites.csv)
  - Purpose: CSV mapping of detected server-side analytics write call-sites (file, location, event_type, table).
  - Last edit: 2026-04-21T00:00:00Z
  - Status: Needs action — Expand with exact line numbers and add automated presence test.

- [analytics_event_reconciliation.md](analytics_event_reconciliation.md)
  - Purpose: Reconciliation between server-emitted events and client `VALID_EVENT_TYPES` allowlist; recommended allowlist updates.
  - Last edit: 2026-04-21T00:00:00Z
  - Status: Needs action — Add tests to lock the allowlist and implement vetted client events (e.g., `subject_selected`).

- [analytics_user_journey.md](analytics_user_journey.md)
  - Purpose: Canonical mapping of Student/Parent/Admin journeys to analytics events and ingestion paths.
  - Last edit: 2026-04-21T00:00:00Z
  - Status: Ready — review with Product to confirm `subject_selected` semantics.

- [analytics_performance.md](analytics_performance.md)
  - Purpose: Zero-impact instrumentation strategy: client batching, enqueueing, worker bulk writes, sampling and SLOs.
  - Last edit: 2026-04-21T10:40:00Z
  - Status: Needs action — implement client library and worker bulk-write patterns; run performance benchmarks.

How to use
1. Read the admin audit report to understand priorities and blockers.
2. Resolve Task A (prompt redaction) before implementing any aggregator or forwarder work.
3. After prompt redaction is in place, implement Task C (subject_selected) and enable aggregator worker (Task E).
4. Push allowlist changes to `app/api/analytics/event/route.ts` and add unit tests referenced in the reconciliation doc.

Owner & Next Steps (recommended)
- Owner: analytics-engineering@ (assign a single owner for coordination).
- Immediate next action (recommended): approve and assign Task A — implement prompt redaction in `lib/callLLM.ts` and add unit/integration tests verifying no raw prompt is persisted.

Notes
- Treat this file as living documentation — update the EDIT LOG when you make changes.
- If you move or rename docs, update the links in this MASTER file.

---

## Findings (2026-04-22) — Staff-engineer audit

- **Overview:** Events flow from client instrumentation into the batch endpoint, are enqueued to BullMQ, consumed by a worker and written into the `AnalyticsEvent` table. Server/business audit events use the separate `Event` table via `logEvent()`.

- **Canonical callsites & modules:**
  - **Client helpers:** [lib/analyticsClient.ts](lib/analyticsClient.ts#L1-L120) and [lib/analytics/client.ts](lib/analytics/client.ts#L1-L120).
  - **Batch ingestion endpoint:** [app/api/analytics/event/route.ts](app/api/analytics/event/route.ts#L1-L124).
  - **Single-event endpoint (quick verification):** [app/api/analytics/track/route.ts](app/api/analytics/track/route.ts#L1-L34).
  - **Queue & worker:** [lib/queues/analyticsQueue.ts](lib/queues/analyticsQueue.ts#L1-L80), queue name in [lib/queues/constants.ts](lib/queues/constants.ts#L1-L20), and worker at [worker/services/analyticsIngestWorker.ts](worker/services/analyticsIngestWorker.ts#L1-L120).
  - **DB model:** `AnalyticsEvent` in [prisma/schema.prisma](prisma/schema.prisma#L350-L368).
  - **Audit/business events:** `logEvent()` → `Event` model via [utils/logEvent.ts](utils/logEvent.ts#L1-L49).

- **Retention & aggregation:** A retention job prunes `AnalyticsEvent` rows after 90 days ([lib/jobs/retention.ts](lib/jobs/retention.ts#L1-L80)). Nightly aggregation/rollups are produced into `AnalyticsDailyAggregate` (see Prisma schema).

- **Allowlist & tests:** Client-emitted event types are controlled by `VALID_EVENT_TYPES` in [app/api/analytics/event/route.ts](app/api/analytics/event/route.ts#L1-L124). Update `tests/unit/api/analytics.allowlist.test.ts` when modifying this list and update `tests/api/analytics.event.test.ts` to cover ingestion behaviour.

### How to add a new analytics event (concise)

1. Decide scope: **server-only** vs **client-emitted**. Server-only events must NEVER be added to the client allowlist.

2. If client-emitted:
  - Add the event name to `VALID_EVENT_TYPES` in [app/api/analytics/event/route.ts](app/api/analytics/event/route.ts#L1-L124).
  - Update `tests/unit/api/analytics.allowlist.test.ts` expected set.
  - Add instrumentation in the client helper ([lib/analytics/client.ts](lib/analytics/client.ts#L1-L120)) by adding to the ALLOWED set and (optionally) a convenience function.
  - Call the helper from the UI or client code where the interaction occurs.

3. If server-emitted:
  - Prefer enqueueing via `getAnalyticsQueue()` ([lib/queues/analyticsQueue.ts](lib/queues/analyticsQueue.ts#L1-L80)) for non-blocking ingestion.
  - Fallback to `prisma.analyticsEvent.create()` when needed (the ingestion endpoint already falls back similarly).
  - For audit/business events (low volume), use `await logEvent('my_event', metadata)` to record to the `Event` model ([utils/logEvent.ts](utils/logEvent.ts#L1-L49)).

4. Tests & CI:
  - Update or add unit tests for any new helper functions.
  - Update allowlist test and API ingestion tests to include the new type.
  - Run `npm run lint`, `npm run type-check`, `npm test` before committing.

5. Documentation & registry:
  - Add an entry to [docs/v2/analytics/analytics_event_callsites.csv](analytics_event_callsites.csv) with file, line, `AnalyticsEvent`, event_type, actor, short description.
  - Update this MASTER file and `analytics_event_reconciliation.md` as appropriate.

6. Privacy & retention:
  - Never store PII in `AnalyticsEvent.metadata`. Use `userId` or anonymised tokens instead.
  - Be aware of the default 90-day prune job ([lib/jobs/retention.ts](lib/jobs/retention.ts#L1-L80)); plan for archival or longer retention via separate storage/rollups if required.

### Quick PR checklist

- **Code:** instrumentation + allowlist/helper change
- **Tests:** updated allowlist test & endpoint tests; unit tests for any new helpers
- **Docs:** update `analytics_event_callsites.csv` and this MASTER doc
- **EDIT LOG:** update file(s) headers' EDIT LOG entries for every changed file
- **Gates:** `npm run lint`, `npm run type-check`, `npm test` (CI must pass)

### Recommended next steps

- Assign an analytics owner to coordinate event definitions and retention policy.
- Implement a sample instrumentation change (e.g., `subject_selected`) using the above steps and include coverage in tests.
- Consider automating callsite extraction and adding a CI check to ensure `analytics_event_callsites.csv` is updated when new callsites are added.


