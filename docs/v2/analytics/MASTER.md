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

