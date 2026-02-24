# Release Decision Framework — Soft Launch Gate

This framework defines objective criteria for a three-color release decision (GREEN / YELLOW / RED) for soft-launch readiness. Each criterion has measurable checks and thresholds. Follow the decision tree at the end to reach a consistent outcome.

Summary of decision colors
- GREEN: safe to soft launch
- YELLOW: delay and remediate; may proceed only with documented mitigations and a re-check window
- RED: block launch until fixed

Primary Criteria (checks & thresholds)

1) Engine Integrity
- Checks: `engine.loop.detected` count, repeated rule oscillations, rule regressions found in `test-mvp-flow` scenarios.
- GREEN: `engine.loop.detected` ≤ 1 per 60m; `test-mvp-flow.cjs` passes all scenarios; no reproducible oscillations on manual runs.
- YELLOW: `engine.loop.detected` between 2–5 in 60m OR one non-blocking `test-mvp-flow` scenario fails but root cause is known and patch planned within 24h.
- RED: `engine.loop.detected` > 5 in 60m OR `test-mvp-flow` fails critical scenario (e.g., mastery regression) OR reproducible incorrect learning decisions.

2) Curriculum Depth
- Checks: subjects count, topics per subject, questions per topic, `GeneratedTest` coverage (see `scripts/expand-seed-curriculum.cjs`).
- GREEN: ≥ 3 subjects; ≥ 10 active topics per subject; ≥ 5 questions per topic; `GeneratedTest` present for each topic.
- YELLOW: Minor gaps (some subjects with 7–9 topics) but prioritized content for pilot users is present and documented.
- RED: Major gaps (subjects with <5 topics or topics missing questions or generated tests) that would materially alter learning paths.

3) Concurrency Test Results
- Checks: `scripts/concurrency-stress-test.cjs` outcomes, HTTP 5xx counts, duplicate STM detection.
- GREEN: Concurrency test passes with no HTTP 5xx, no duplicate STM rows, latencies within acceptable SLA (p95 < 1.5s for core endpoints).
- YELLOW: Intermittent 5xx or p95 spikes during stress test but no data corruption; mitigation plan (vertical scaling, PgBouncer, caching) exists and can be applied before expansion.
- RED: Persistent 5xx, duplicate STM rows, or data corruption observed under test.

4) Failure Injection Results
- Checks: `scripts/failure-injection-test.cjs` and `scripts/failure-injection-test.cjs` findings — graceful degradation and no partial writes.
- GREEN: API returns safe fallback (no 500), DB integrity preserved, no partial writes detected.
- YELLOW: Observed transient errors but no data corruption; documented retry/backoff mitigation and short remediation window.
- RED: Partial writes, corrupt mastery state, or inability to recover gracefully.

5) UX Sanity
- Checks: manual runs via `scripts/manual-user-simulation.cjs`, PO/QA walkthroughs, key funnel metrics.
- GREEN: Manual persona flows complete without confusing or blocking UX; `next_action_click_rate` and `completion_rate` within expected band.
- YELLOW: Minor UX friction (wording, minor flow choices) not blocking core learning; plan for fixes in next sprint.
- RED: Core flow confusion causing inability to proceed (e.g., no actionable next-action returned for many users).

6) Logging Hygiene
- Checks: `scripts/audit-logs-safety.cjs` and spot checks for no raw JWT/email/answer logging.
- GREEN: Audit script reports no violations; structured logging in place with sanitization.
- YELLOW: Non-production `console.log` found only in `scripts/` or dev-only files; remove before full launch and re-run audit.
- RED: Sensitive data logged (JWTs, raw answers, emails) in production code paths.

7) Data Integrity Invariants
- Checks: DB UNIQUE constraints (`studentId, topicId`), duplicate detection queries, `LearningSession` consistency (no endedAt=null & isCompleted=true), audit log presence.
- GREEN: All invariants hold, no duplicates, audit logs for critical events present.
- YELLOW: Invariants hold but monitoring or alerting gaps exist; add checks and re-run within 24h.
- RED: Violations of invariants detected.


Decision Tree (execution-ready)

1. Run `scripts/prelaunch-check.cjs`. If it fails → RED.
2. Run `scripts/audit-logs-safety.cjs`. If it fails → RED (sensitive logging) or YELLOW for dev-only console usage.
3. Run `scripts/expand-seed-curriculum.cjs` (idempotent) and validate curriculum metrics. If major gaps → RED.
4. Run `scripts/test-mvp-flow.cjs`. If critical scenario fails → RED; if non-critical fails with known fix → YELLOW.
5. Run `scripts/concurrency-stress-test.cjs`. If duplicate STM or persistent 5xx → RED. If intermittent 5xx but no corruption → YELLOW.
6. Run `scripts/failure-injection-test.cjs`. If partial writes or corrupt mastery → RED; transient errors only → YELLOW.
7. Run UX manual tests (`manual-user-simulation.cjs`) with PO and QA: if core flows fail → RED; minor friction → YELLOW.
8. Aggregate: If all checks are GREEN → GREEN decision. If any RED → RED. If no RED but any YELLOW → YELLOW.

Remediation & Re-check requirements
- YELLOW: Provide a remediation plan with owner, estimated fix time, and re-check window (≤ 48 hours). Re-run failing scripts after fix.
- RED: Stop rollout. Owner must provide root-cause analysis, rollback plan if applicable, and testable fix before re-evaluation.

Example quick checklist (pre-release)
- [ ] `prelaunch-check.cjs` pass
- [ ] `audit-logs-safety.cjs` pass
- [ ] `test-mvp-flow.cjs` pass
- [ ] `concurrency-stress-test.cjs` pass (no duplicates)
- [ ] `failure-injection-test.cjs` pass
- [ ] Manual persona flows validated
- [ ] Backup taken and rollback steps documented

Notes
- Use objective evidence (script output, query results, log excerpts, metrics dashboards) when classifying YELLOW vs RED. Do not rely on anecdote.
- Ensure all remediation actions are documented in the incident ticket and include verification steps.
