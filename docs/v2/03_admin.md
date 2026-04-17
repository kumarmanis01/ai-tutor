
AI HOME TUTOR PLATFORM
Admin Actor
Approach Document — Platform Operations, Content & Quality Control


Actor
Document Version
Scope
Stack
Admin
1.0 — MVP
MVP Phase 1 — ~1K concurrent
Node.js + TS + Prisma + Neon + React


CONFIDENTIAL — FOR INTERNAL REVIEW ONLY

1. Overview
The Admin is a trusted internal team member responsible for platform health, content quality, AI behaviour monitoring, and business operations. At MVP, the team is expected to be ≤ 5 people. There is no dedicated admin UI at MVP — operations are performed via Prisma Studio, Neon query console, direct CLI scripts, and application logs. The admin's primary obligation is to keep the AI operating accurately and safely, and to maintain curriculum content quality.

MVP PRINCIPLE
Zero admin UI at MVP. Every hour spent building internal tooling is an hour not spent on the student product. Revisit when operational volume exceeds what Prisma Studio + SQL queries can handle — target: > 10,000 active students or > 5 team members.


1.1 Admin Roles (MVP)
Role
Responsibilities
Access Level
Founder / Product Admin
Business metrics, subscription management, user escalations, feature flags
Full — all schemas
Content Admin
Curriculum ingestion, question bank review, misconception library, flagged content
curriculum + assessment schemas
AI Quality Analyst
Session quality sampling, hallucination monitoring, escalation review, cost monitoring
sessions + analytics schemas (read-only)



2. Content Operations
F-ADM-001
Curriculum Ingestion Pipeline
MVP

CLI-driven pipeline to ingest board textbook content and build the RAG knowledge base.
AC#
Acceptance Criterion
Priority
AC-01
Ingestion is a CLI script — not a UI. Script accepts: PDF path, board, subject, grade, language. Example: node ingest.js --file ncert_math10.pdf --board CBSE --subject Mathematics --grade 10 --lang en
MUST
AC-02
Pipeline steps: PDF text extraction → chapter-level chunking (500 tokens, 50-token overlap) → metadata tagging (board, subject, chapter_code, topic_code, concept_ids[]) → embedding generation (text-embedding-3-small) → pgvector storage.
MUST
AC-03
Idempotent: re-running ingestion on the same PDF + same metadata does not create duplicate chunks. Existing chunks are versioned and replaced.
MUST
AC-04
MVP seed content: CBSE Grade 10 Mathematics + Science (English medium). Minimum viable for launch. All other content added post-launch.
MUST
AC-05
Ingestion run log: every run writes a summary to analytics.events (chunks_created, chunks_updated, embeddings_generated, duration_ms, errors). Viewable via Neon console.
MUST
AC-06
Concept taxonomy (Board → Subject → Chapter → Topic → Concept hierarchy) must be manually seeded via SQL before ingestion. Ingestion maps chunks to existing taxonomy — does not auto-create concepts.
MUST
AC-07
Failed chunks (embedding API error, parsing error) logged separately. Admin re-runs failed chunks by ID: node ingest.js --retry-failed --run-id <id>
SHOULD

Phase 2 — Ingestion Pipeline Enhancements (Planned)

These enhancements are scoped for Phase 2 to increase reliability, observability, and admin ergonomics for the curriculum ingestion pipeline.

- **Staging & CI-driven seed:** Add a guarded CI job to run the CBSE Grade 10 seed against a staging database with pre-flight checks (dry-run mode, cost-estimate, and feature-flag gating). Ensure `OPENAI_API_KEY` is scoped to non-production credentials.
- **Integration tests & fixtures:** Add integration tests for `scripts/parse-pdf-cli.ts` and the seed runner using small PDF fixtures and mocked embedding responses to validate upsert/idempotency and `IngestRunLog` behaviours.
- **Admin retry UI & tooling:** Small admin console (internal) to inspect `IngestRunLog` entries, view `errorDetails`, and re-run failed chunk batches by run id or chunk id with rate limits and dry-run preview.
- **Partial re-ingest & backfill:** Support targeted re-ingestion by chapter/topic/concept with idempotent upserts and worker-based, rate-limited backfill utilities.
- **Cost & observability:** Per-run embedding call counts, estimated cost, and alerts when a run exceeds configurable cost thresholds. Surface run metrics in `analytics.events` and a lightweight admin dashboard.
- **Operational safety:** Require explicit audit/log entry and admin confirmation for any run targeting production datasets. Provide a `--dry` and `--preview` mode for all CLI commands.
- **Performance tuning & resilience:** Add circuit-breakers, exponential backoff for embedding calls, and batch-size tuning tests to balance latency, cost, and reliability.



F-ADM-002
Concept Taxonomy Management
MVP

Management of the curriculum hierarchy that underpins the knowledge graph.
AC#
Acceptance Criterion
Priority
AC-01
Taxonomy is seeded via SQL scripts — not a UI. Schema: boards → subjects → chapters → topics → concepts. Each level has: code (e.g., CBSE-MATH10-CH01-T01-C001), name, description, irt_b (expected difficulty).
MUST
AC-02
Concepts have additional fields: bloom_level (remember/understand/apply/analyse/evaluate/create), prerequisite_concept_ids[], commonly_confused_with_ids[]. These drive AI teaching and misconception detection.
MUST
AC-03
Taxonomy changes are versioned. A concept's IRT parameters or prerequisite links can be updated — changes are stamped with updated_at and updated_by. Historical versions retained.
SHOULD
AC-04
Before any new subject/grade is made available to students: taxonomy must be complete (all concepts seeded) AND curriculum chunks ingested AND minimum 5 questions per concept in the question bank.
MUST
AC-05
Subject availability is controlled by a feature flag per (board, subject, grade) combination. Admin enables availability when content readiness criteria are met.
MUST


F-ADM-003
Question Bank Management
MVP

Oversight of the AI-generated question bank — review, approval, and quarantine management.
AC#
Acceptance Criterion
Priority
AC-01
Questions are primarily AI-generated. Admin's role is exception handling: reviewing quarantined questions, not bulk authoring.
MUST
AC-02
Quarantine trigger: 3 or more student flags on the same question (flagged as wrong or ambiguous). Quarantined questions are excluded from serving immediately on 3rd flag — before admin review.
MUST
AC-03
Admin reviews quarantined questions via Prisma Studio: query WHERE status = quarantined. Actions: approve (return to active), reject (mark as invalid), edit (update question + reinstate).
MUST
AC-04
Admin can manually seed questions for a concept: using a seed script that bypasses AI generation quality gates (for content expert-authored questions). These are tagged source = manual.
SHOULD
AC-05
IRT parameter validation: new AI-generated questions start as unvalidated. After 50 student responses, a nightly BullMQ job fits the 3PL IRT model and promotes the question to validated. Admin can force-validate a question (for manually authored questions).
MUST
AC-06
Question bank health report: weekly automated query — questions per concept (flagging concepts with < 5 active questions), validation rate, rejection rate by subject. Emailed to content admin.
SHOULD


F-ADM-004
Misconception Library Management
MVP

Maintenance of the per-subject library of common student misconceptions.
AC#
Acceptance Criterion
Priority
AC-01
Misconception library seeded manually by subject experts via SQL insert. Schema: misconception_id, subject, concept_ids[], description, diagnostic_signals (wrong_answer_patterns[], error_type), correction_prompt_fragment, contrastive_example, prevalence_rate.
MUST
AC-02
MVP minimum: 20 misconceptions per subject (Mathematics + Science for CBSE Grade 10). Each misconception must have: at least 2 diagnostic signal patterns, a correction prompt fragment, and a contrastive example.
MUST
AC-03
New misconceptions discovered from escalated doubts (AI failed to resolve after 3 attempts) are queued in a review table. Admin reviews weekly: write the correction, add to library.
MUST
AC-04
Misconception prevalence_rate is updated automatically by a monthly analytics job: count of detections / total relevant attempts. High-prevalence misconceptions (> 30%) reviewed for curriculum chunk improvement.
SHOULD

Seeding Misconceptions
---------------------

The repository includes idempotent seed scripts for launch content: 20 misconceptions each for CBSE Grade 10 Mathematics and Science. Files:

- prisma/seeds/misconceptions_cbse_grade10_mathematics.ts
- prisma/seeds/misconceptions_cbse_grade10_science.ts

Run (local/dev):

```bash
# Dry-run (no DB changes)
node -r ts-node/register prisma/seeds/misconceptions_cbse_grade10_mathematics.ts --dry
# Real run (uses @prisma/client)
node prisma/seeds/misconceptions_cbse_grade10_mathematics.ts
```

The seed modules export both an array (for unit tests) and a `seedMisconceptions(prisma, {dryRun})` function. They perform idempotent upserts keyed by stable `id` values and write no audit logs; admin audit actions are created when using the admin UI to edit entries.




3. AI Quality Monitoring
CRITICAL RESPONSIBILITY
AI quality monitoring is the admin's most important operational responsibility at MVP. The AI is the product. Hallucinations, incorrect explanations, or poor pedagogical decisions directly damage student learning and platform trust. Admin must review sampled sessions daily.


F-ADM-010
Session Quality Sampling
MVP

Daily manual review of random session transcripts to catch AI quality issues.
AC#
Acceptance Criterion
Priority
AC-01
Every session transcript (session_turns) is stored and queryable. Admin can read full AI-student conversation for any session.
MUST
AC-02
Daily sample query: random 10 sessions from previous day WHERE session_turns.role = ai. Admin reads transcripts in Neon console or exports to CSV.
MUST
AC-03
Admin flags problematic sessions with a quality_flag field: values (hallucination / incorrect_explanation / poor_pedagogy / off_topic / safety_concern). Flagged sessions trigger prompt review.
MUST
AC-04
Safety concern flags: reviewed within 2 hours. All other quality flags: reviewed within 48 hours.
MUST
AC-05
Flagged sessions are used as negative examples for future prompt iteration. Admin writes a correction note linked to the session.
SHOULD
AC-06
Student session rating data (1–5 stars from session summary screen) queried weekly: avg rating per subject, per concept, per day. Sustained ratings < 3 stars on a concept → content review triggered.
MUST


F-ADM-011
Doubt Escalation Queue
MVP

Review and resolution of doubts the AI failed to resolve after 3 attempts.
AC#
Acceptance Criterion
Priority
AC-01
Doubts escalated after 3 AI resolution failures are written to a escalations table: doubt text, all 3 AI attempts, concept_id, student_id (anonymised for reviewer), escalated_at.
MUST
AC-02
Admin queries escalations table weekly: SELECT * FROM escalations WHERE resolved_at IS NULL ORDER BY escalated_at. Reviews AI responses, identifies root cause (wrong curriculum chunk? missing misconception? prompt failure?).
MUST
AC-03
Admin resolution actions: update relevant curriculum chunk → re-ingest, add new misconception to library, flag prompt issue for next iteration cycle, write a direct resolution that is cached in doubt_kb.
MUST
AC-04
Escalated doubt is marked resolved_at + resolution_type when admin resolves it. Student is notified: "We've updated our explanation for this topic — here's an improved answer."
SHOULD
AC-05
Trending topics in escalations (same concept escalated by > 5 different students in a week) trigger a content priority alert: that concept's curriculum chunk needs immediate review.
MUST


Phase 2 — Enhancements (Planned)

These improvements are planned for Phase 2 to increase reliability, traceability, and administrator control for the doubt escalation workflow:

- Admin UI & One-Click Notify: a small admin console to review escalations, preview cached resolution, and trigger immediate student notification.
- Notification Preferences & Consent: store per-student / parent notification preferences and respect parental consent; include opt-out handling and audit trails.
- Multi-channel Delivery & Retry: configurable retries and exponential backoff for fallback channels; add delivery metrics and support for additional gateways (WhatsApp/SMS) where permitted.
- KB Traceability & Versioning: persist `doubtKbId` on escalations, surface KB revision history and source (admin edit / curriculum update) for auditability.
- Audit & Delivery Metrics: emit structured events for notification attempts, delivery/fallback rates, and user clicks; surface in admin reports and alerting.
- Admin-triggered Backfill Tool: safe, rate-limited backfill to populate `notifiedAt` for historical resolved escalations.
- Admin API Harden & Audit: rate-limit and strengthen auth on the admin notify API; log admin actions to the audit_log table.
- End-to-end Tests & Monitoring: integration tests for notification flow, idempotency under retries, and provider failures; dashboards for delivery health.
- Performance & Safety: batch processing tuning, concurrency limits, idempotency guarantees, and circuit-breakers around external providers.

Priority: SHOULD for user-facing reliability; MUST for auditability and consent.


F-ADM-012
LLM Cost Monitoring
MVP

Daily tracking of AI API costs to stay within budget and detect anomalies.
AC#
Acceptance Criterion
Priority
AC-01
Every LLM API call writes a cost event to analytics.events: model, input_tokens, output_tokens, cost_usd, call_type (teach/evaluate/classify/embed), concept_id, session_id.
MUST
AC-02
Daily cost report query: SUM(cost_usd) grouped by call_type, model, subject. Available via Neon console. Target: < $200/day at 1K concurrent.
MUST
AC-03
Cost anomaly detection: if daily cost > 1.5x rolling 7-day average → admin alert via email. Indicates runaway loop, cache miss, or traffic spike.
MUST
AC-04
Cost per session metric tracked: SUM(cost_usd) / COUNT(sessions) per day. Acceptable range at MVP: $0.15–$0.25 per session. Alert if outside this range.
MUST
AC-05
Cache hit rate monitored: (explanation_cache_hits / total_teach_calls) per day. Target > 55%. Cache hit rate drop → investigate cache invalidation issue.
SHOULD


F-ADM-013
Hallucination & Safety Flag Review
MVP

Monitoring of AI content safety layer triggers and potential hallucinations.
AC#
Acceptance Criterion
Priority
AC-01
AI safety layer is injected into every session system prompt. When triggered, a safety_event is written to analytics.events with: trigger_type, session_id, offending_turn_id.
MUST
AC-02
Admin queries safety events daily: SELECT * FROM analytics.events WHERE event_type = safety_triggered ORDER BY occurred_at DESC. Reviews within 2 hours of trigger.
MUST
AC-03
Hallucination detection: AI responses containing factual claims not grounded in RAG-retrieved chunks are flagged with a low_groundedness_score. Admin reviews weekly summary of low-groundedness responses.
MUST
AC-04
If hallucination detected in a curriculum explanation: the relevant curriculum chunk is updated or the concept is temporarily suspended from AI teaching (feature flag) until fixed.
MUST
AC-05
Student account suspension: if a student is found attempting to jailbreak the AI (prompt injection, off-curriculum manipulation), admin can suspend the account. Suspension is reversible.
MUST



4. User & Subscription Management
F-ADM-020
User Account Operations
MVP

Admin management of student and parent accounts.
AC#
Acceptance Criterion
Priority
AC-01
Admin can view any user account via Prisma Studio: student profile, subscription status, session history, knowledge graph state, payment history.
MUST
AC-02
Admin can suspend an account (temporary) or deactivate (permanent with data retention). Suspension: student cannot log in. Deactivation: initiates DPDP data deletion workflow.
MUST
AC-03
Admin can manually change a student's grade (requires an audit log entry: admin_id, reason, previous_grade, new_grade, timestamp). Grade change triggers diagnostic reset for affected subjects.
MUST
AC-04
Admin can reset a student's diagnostic for a specific subject (e.g., student genuinely changed board mid-year). Reset audit logged. Student notified.
MUST
AC-05
Duplicate account detection: admin can query students sharing same mobile number or same device fingerprint. Flags potential abuse (multiple free accounts from same household vs legitimate siblings).
SHOULD
AC-06
Admin can merge two accounts (e.g., student accidentally created duplicate). Merge preserves: better subscription, higher mastery scores, complete session history. Irreversible — requires admin confirmation.
SHOULD


F-ADM-021
Subscription & Payment Operations
MVP

Manual subscription adjustments, refunds, and goodwill extensions.
AC#
Acceptance Criterion
Priority
AC-01
Admin can manually extend a student's subscription: by N days, for a specified reason (goodwill, technical issue, promotional). Audit logged.
MUST
AC-02
Admin can issue a manual refund: mark payment as refunded in the system. Actual Razorpay refund must also be initiated separately from Razorpay dashboard. Both steps required for reconciliation.
MUST
AC-03
Admin can apply a custom discount coupon to a specific account: percentage or fixed amount, one-time or recurring, expiry date. Coupon system supports: STUDENT_NAME specific, global, or batch codes.
SHOULD
AC-04
Admin can view full payment event history per student: all Razorpay webhook events, retry attempts, grace periods, plan changes. For dispute resolution.
MUST
AC-05
Subscription analytics queryable: MRR, ARR, churn rate, trial-to-paid conversion, average subscription duration. Available via Neon console SQL queries.
MUST



5. Business & Platform Metrics
TOOLING
All metrics at MVP are queried directly from Neon PostgreSQL via the Neon console SQL editor. No dedicated analytics dashboard. Target: weekly metrics review by founder using a saved query library.


F-ADM-030
Core Growth Metrics
MVP

Weekly business health metrics — the minimum viable analytics for MVP operations.
AC#
Acceptance Criterion
Priority
AC-01
Daily Active Students (DAS): COUNT DISTINCT student_id FROM sessions WHERE started_at >= CURRENT_DATE. Target > 300 by end of Month 2.
MUST
AC-02
Weekly Active Students (WAS): COUNT DISTINCT student_id FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAYS.
MUST
AC-03
North Star — Sessions per student per week: AVG(session_count) FROM (SELECT student_id, COUNT(*) FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAYS GROUP BY student_id). Target > 5.
MUST
AC-04
Freemium → Paid conversion rate: COUNT(subscriptions created this month) / COUNT(users registered this month). Target > 8% by Month 3.
MUST
AC-05
MRR: SUM(monthly_equivalent_amount) FROM subscriptions WHERE status = active.
MUST
AC-06
Churn rate: COUNT(subscriptions cancelled this month) / COUNT(active subscriptions at start of month). Target < 8%.
MUST
AC-07
LTV / CAC ratio: tracked manually from MRR data + marketing spend. Target > 3:1 by Month 6.
SHOULD

Implementation Status — AC-07 (Automated LTV/CAC): COMPLETED

- Summary: Implemented automation for LTV/CAC (F-ADM-030) to replace the previous manual process. Key deliverables:
	- Prisma models: `MarketingSpend`, `LtvSnapshot` and SQL migrations under `prisma/migrations/20260417020000_add_marketing_spend` and `prisma/migrations/20260417030000_add_ltv_snapshot`.
	- Scheduled snapshot job: `jobs/metricsSnapshot.ts` (exports `runSnapshot(createdBy?)`) and registration in `lib/jobs/registerJobs.ts` for daily snapshots.
	- On-demand metrics API: `app/api/admin/metrics/ltv-cac/route.ts` (month-to-date by default) and history API at `app/api/admin/metrics/ltv-cac/history/route.ts`.
	- Admin UI: minimal dashboard at `app/admin/metrics/ltv-cac/page.tsx` showing current metrics and recent snapshots.
	- Admin CLI: `scripts/insert-marketing-spend.ts` to insert monthly marketing spend entries (paise-based amounts).
	- Unit tests: basic test coverage for the metrics API at `tests/unit/app/api/admin/metrics_ltv_cac.spec.ts`.

Notes / Outstanding dev tasks (pre-flight before production runs):
- Apply database migrations and generate Prisma client: `npx prisma migrate dev --name add_marketing_and_ltv_snapshot` then `npx prisma generate`.
- Resolve Prisma schema validation tooling warning: CI/type-check flagged `datasource.url` deprecation (may be a Prisma CLI/tooling mismatch vs project lockfile). Align local Prisma CLI version or adapt `prisma.config.ts` as required.
- Add integration tests for `jobs/metricsSnapshot` persistence and for `scripts/insert-marketing-spend` CLI behavior.
- Verify worker/orchestrator scheduling and run a one-off `runSnapshot()` to create initial snapshot row.

Phase 2 — Growth Metrics Enhancements (Planned)

These are recommended Phase 2 items to make the LTV/CAC pipeline production-ready and more useful to ops and business stakeholders:

- Centralize metric SQL: move duplicated raw SQL aggregators into a shared helper (`lib/metrics/aggregator.ts`) used by API, job, and admin page to ensure consistency and single-source-of-truth.
- End-to-end tests: add an integration test that runs the snapshot job against a test DB, asserts `LtvSnapshot` creation, and validates basic calculations (ARPU, churn, LTV, CAC, ratio).
- Metrics dashboard & alerts: build a lightweight admin dashboard (Grafana/Prometheus or internal UI) with time series of `ltv_paise`, `cac_paise`, `ltv_cac_ratio`; add alerting rules (e.g., `ltv_cac_ratio < 2` triggers warning).
- Marketing spend UI: expose a simple admin form to add/edit monthly `MarketingSpend` entries with validation and audit logging (createdBy + notes). Enforce TTL/soft-delete policies for historical spend edits.
- Channel breakdowns & attribution: extend snapshots to include `marketing_spend_by_channel` and CAC per-channel; add endpoint to query CAC by channel and time window.
- Backfill tooling & idempotency: provide safe backfill scripts and idempotent snapshot runner to re-compute historical snapshots where marketing spend was entered retrospectively.
- Observability & provenance: log inputs to snapshot runs (start/end dates, source of marketing spend) and persist `createdBy` and `notes` to `LtvSnapshot` for auditability.
- CI gates & coverage: require unit + integration tests for job and CLI in CI; add a smoke job that runs snapshot in a staging DB during deploy pre-flight.



F-ADM-031
Learning Outcome Metrics
MVP

Metrics validating that students are actually learning — the platform's core value proof.
AC#
Acceptance Criterion
Priority
AC-01
Average mastery gain per session: AVG(mastery_score_after - mastery_score_before) FROM session_concept_events. Target > 0.05 per session.
MUST
AC-02
Chapter completion rate: COUNT(concepts WHERE mastery_score > 0.75) / COUNT(total_concepts_in_chapter) per student, averaged across platform. Target > 60% chapter completion before students advance.
MUST
AC-03
Mock exam score improvement: compare first mock exam score vs latest mock exam score per student per subject. Target: > 70% of active students show positive improvement.
MUST
AC-04
Hint dependency rate: AVG(hints_given / max_hints) per concept. Concepts with > 80% students requesting all 3 hints → content review triggered.
SHOULD
AC-05
Spaced repetition compliance: % of due revision cards completed on schedule. Target > 65%. Low compliance → investigate UX friction or notification timing.
SHOULD


F-ADM-032
Platform Health Metrics
MVP

Technical health indicators — reviewed daily.
AC#
Acceptance Criterion
Priority
AC-01
Session error rate: COUNT(sessions WHERE status = error) / COUNT(sessions total). Alert if > 1%.
MUST
AC-02
AI response p95 latency: 95th percentile of latency_ms from session_turns WHERE role = ai. Alert if > 10 seconds.
MUST
AC-03
Question generation failure rate: COUNT(event_type = question_gen_failed) / COUNT(event_type = question_gen_attempted). Alert if > 5%.
MUST
AC-04
Neon connection pool utilisation: monitored via Neon dashboard. Alert if > 80% of pool connections in use.
MUST
AC-05
Redis memory utilisation: monitored via PM2 + redis-cli INFO memory. Alert if > 80% of 512 MB cap.
MUST
AC-06
VPS CPU + memory: monitored via UptimeRobot (free tier) + PM2 memory logs. Alert if CPU > 80% sustained 5 minutes or any process hits max_memory_restart.
MUST



6. Compliance & Data Governance
F-ADM-040
DPDP Act Compliance (India)
MVP

India Digital Personal Data Protection Act 2023 compliance for student data.
AC#
Acceptance Criterion
Priority
AC-01
All personal data of students under 18 requires verifiable parental consent before processing. Consent stored with: timestamp, IP, consent_version, parent_mobile_hash.
MUST
AC-02
Data minimisation: only data required for platform functionality is collected. No marketing profiling data collected for minors.
MUST
AC-03
Right to erasure: parent can request data deletion from account settings. Deletion workflow: account deactivated immediately → data pseudonymised within 7 days → PII purged within 30 days → audit log retained 7 years.
MUST
AC-04
Data localisation: all primary data stored in Neon PostgreSQL with Indian region preferred, or closest APAC region. Object storage (R2) configured to APAC region.
MUST
AC-05
Third-party data sharing: student data is never sold or shared with advertisers. AI providers (OpenAI, Anthropic) receive anonymised session content only — no PII in prompts (PII redaction layer enforced).
MUST
AC-06
Data breach response: if breach detected, affected users notified within 72 hours per DPDP requirements. Breach response runbook maintained in internal docs.
MUST


F-ADM-041
Audit Logging
MVP

Immutable audit trail for all admin actions and security events.
AC#
Acceptance Criterion
Priority
AC-01
All admin actions are logged to an audit_log table: admin_id, action_type, target_entity, target_id, previous_value (JSON), new_value (JSON), timestamp, IP.
MUST
AC-02
Audit log is append-only. No admin can delete or modify audit log entries. Database-level constraint + separate role enforcement.
MUST
AC-03
Security events logged: failed login attempts (> 3 in 10 minutes), admin role changes, subscription manual adjustments, account suspensions/deactivations.
MUST
AC-04
Audit log retained minimum 7 years (legal requirement). After 1 year: archived to Cloudflare R2 as compressed JSON. Queryable via admin CLI.
MUST



7. Phase 2 Admin Features (Scoped, Not Built at MVP)
Feature
Code
Description
Admin Dashboard UI
F-ADM-P2-001
Dedicated internal web UI replacing Prisma Studio + SQL queries. Triggered when team > 5 or operational volume > 10K students.
Content Management UI
F-ADM-P2-002
UI for curriculum ingestion, taxonomy management, question bank review, misconception library editing.
A/B Test Framework
F-ADM-P2-003
Test different explanation strategies, hint phrasings, and gamification mechanics across student cohorts.
Cohort Retention Analysis
F-ADM-P2-004
Day 1/7/14/30/90 retention curves by acquisition cohort. Churn prediction model.
Bulk Institutional Onboarding
F-ADM-P2-005
CSV import for school/institution student enrolment. B2B channel operations.
AI Fine-Tuning Pipeline
F-ADM-P2-006
Tooling to collect high-quality session data, label it, and submit for fine-tuning smaller models (cost optimisation).
Geographic Demand Heatmap
F-ADM-P2-007
Map showing student registrations + engagement by city/district. Drives regional marketing decisions.


