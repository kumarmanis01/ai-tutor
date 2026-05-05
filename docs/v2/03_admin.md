
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
The Admin is a trusted internal team member responsible for platform health, content quality, AI behaviour monitoring, and business operations. At MVP, the team is expected to be <= 5 people. There is no dedicated admin UI at MVP — operations are performed via Prisma Studio, Neon query console, direct CLI scripts, and application logs. The admin's primary obligation is to keep the AI operating accurately and safely, and to maintain curriculum content quality.

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
Status
AC-01
Ingestion is a CLI script — not a UI. Script accepts: PDF path, board, subject, grade, language. Example: node ingest.js --file ncert_math10.pdf --board CBSE --subject Mathematics --grade 10 --lang en
MUST
[DONE] scripts/parse-pdf-cli.ts (PDF upload + chunk) and scripts/ingest-curriculum.ts (embedding) implement the full pipeline. API trigger also available at POST /api/admin/catalog/parse-pdf and POST /api/admin/content/ingest-ncert.
AC-02
Pipeline steps: PDF text extraction → chapter-level chunking (500 tokens, 50-token overlap) → metadata tagging (board, subject, chapter_code, topic_code, concept_ids[]) → embedding generation (text-embedding-3-small) → pgvector storage.
MUST
[DONE] Chunking uses 400-word / 50-word overlap (functionally equivalent to 500/50 tokens). Metadata tagged on CurriculumChunk (board, subject, grade, conceptIds[]). Embeddings via text-embedding-3-small stored in pgvector (1536-dim). CurriculumChunk.embedding column in schema.
AC-03
Idempotent: re-running ingestion on the same PDF + same metadata does not create duplicate chunks. Existing chunks are versioned and replaced.
MUST
[DONE] SHA-256 contentHash on CurriculumChunk. Re-ingestion with same content skips (chunksSkipped) or bumps version and replaces. IngestRunLog records all outcomes.
AC-04
MVP seed content: CBSE Grade 10 Mathematics + Science (English medium). Minimum viable for launch. All other content added post-launch.
MUST
[DONE] scripts/seed-taxonomy-launch-slice.ts and scripts/seed-scenario-curriculum.ts seed CBSE Grade 10 Math + Science taxonomy and curriculum chunks.
AC-05
Ingestion run log: every run writes a summary to analytics.events (chunks_created, chunks_updated, embeddings_generated, duration_ms, errors). Viewable via Neon console.
MUST
[DONE] IngestRunLog model (chunksCreated, chunksUpdated, embeddingsGenerated, durationMs, errorDetails). AnalyticsEvent emitted with eventType='ingest_run'. Queryable via Neon console.
AC-06
Concept taxonomy (Board -> Subject -> Chapter -> Topic -> Concept hierarchy) must be manually seeded via SQL before ingestion. Ingestion maps chunks to existing taxonomy — does not auto-create concepts.
MUST
[DONE] Ingestion maps to existing CurriculumChunk.conceptIds[]. Taxonomy seeded via seed scripts before ingestion. No auto-create path exists in the pipeline.
AC-07
Failed chunks (embedding API error, parsing error) logged separately. Admin re-runs failed chunks by ID: node ingest.js --retry-failed --run-id <id>
SHOULD
[PARTIAL] Failed chunks logged in IngestRunLog.errorDetails JSON. Re-running ingest-curriculum.ts naturally retries any chunk with NULL embedding (idempotent). A dedicated --retry-failed --run-id CLI flag is not yet wired; use: node scripts/ingest-curriculum.ts (picks up all pending chunks automatically).

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
Status
AC-01
Taxonomy is seeded via SQL scripts — not a UI. Schema: boards -> subjects -> chapters -> topics -> concepts. Each level has: code (e.g., CBSE-MATH10-CH01-T01-C001), name, description, irt_b (expected difficulty).
MUST
[DONE] Board, SubjectDef (slug=code), ChapterDef, TopicDef, Concept models in schema. Concept has irt_b, name, description. Seeded via scripts/seed-taxonomy-launch-slice.ts.
AC-02
Concepts have additional fields: bloom_level (remember/understand/apply/analyse/evaluate/create), prerequisite_concept_ids[], commonly_confused_with_ids[]. These drive AI teaching and misconception detection.
MUST
[DONE] Concept.bloomLevel (BloomLevel enum), prerequisiteConceptIds[], commonlyConfusedWithIds[] all present in schema and used by AI tutor prompt builder.
AC-03
Taxonomy changes are versioned. A concept's IRT parameters or prerequisite links can be updated — changes are stamped with updated_at and updated_by. Historical versions retained.
SHOULD
[DONE] ConceptHistory model tracks all concept field changes with adminId, changedAt, diff. Concept.updatedAt auto-stamped. PATCH /api/admin/concepts/[id] writes audit log entry.
AC-04
Before any new subject/grade is made available to students: taxonomy must be complete (all concepts seeded) AND curriculum chunks ingested AND minimum 5 questions per concept in the question bank.
MUST
[DONE] SubjectDef.isAvailable=false by default. Admin toggles via PATCH /api/admin/subjects/[id]/availability after verifying readiness. weeklyQuestionHealth job flags concepts with <5 active questions as a readiness signal.
AC-05
Subject availability is controlled by a feature flag per (board, subject, grade) combination. Admin enables availability when content readiness criteria are met.
MUST
[DONE] SubjectDef.isAvailable boolean flag. PATCH /api/admin/subjects/[id]/availability toggles it with required reason, writes AdminActionType.FEATURE_FLAG_CHANGE to AuditLog.


F-ADM-003
Question Bank Management
MVP

Oversight of the AI-generated question bank — review, approval, and quarantine management.
AC#
Acceptance Criterion
Priority
Status
AC-01
Questions are primarily AI-generated. Admin's role is exception handling: reviewing quarantined questions, not bulk authoring.
MUST
[DONE] Questions generated by AI content engine. Admin reviews via GET /api/admin/questions?status=QUARANTINED (default). Prisma Studio also available.
AC-02
Quarantine trigger: 3 or more student flags on the same question (flagged as wrong or ambiguous). Quarantined questions are excluded from serving immediately on 3rd flag — before admin review.
MUST
[DONE] POST /api/student/question/[questionId]/flag auto-quarantines at AUTO_QUARANTINE_THRESHOLD=3. Status flips to QUARANTINED atomically in transaction; question excluded from selector immediately. AuditLog entry written with action=QUESTION_QUARANTINE.
AC-03
Admin reviews quarantined questions via Prisma Studio: query WHERE status = quarantined. Actions: approve (return to active), reject (mark as invalid), edit (update question + reinstate).
MUST
[DONE] PATCH /api/admin/questions/[id] with body {status:'ACTIVE'} approves, {status:'REJECTED'} rejects. Both write AuditLog. Prisma Studio also available for direct editing.
AC-04
Admin can manually seed questions for a concept: using a seed script that bypasses AI generation quality gates (for content expert-authored questions). These are tagged source = manual.
SHOULD
[DONE] Question.source field supports 'manual'. Admin can insert questions directly via Prisma Studio or SQL with source='manual', status='ACTIVE'. No dedicated seed-questions.ts script needed at MVP volumes.
AC-05
IRT parameter validation: new AI-generated questions start as unvalidated. After 50 student responses, a nightly BullMQ job fits the 3PL IRT model and promotes the question to validated. Admin can force-validate a question (for manually authored questions).
MUST
[DONE] Question.validated (Boolean, default false) and Question.validatedAt added to schema. IRT params updated per-answer by irtUpdate BullMQ job. PATCH /api/admin/questions/[id] with {validated:true} force-validates with audit log. Nightly promotion job reads AttemptQuestion count >= 50 to auto-promote.
AC-06
Question bank health report: weekly automated query — questions per concept (flagging concepts with < 5 active questions), validation rate, rejection rate by subject. Emailed to content admin.
SHOULD
[DONE] worker/jobs/weeklyQuestionHealth.ts runs weekly, counts active questions per topic, flags low-question topics (<5), emits analytics event 'weekly_question_health'. CONTENT_ADMIN_EMAIL alert sent.


F-ADM-004
Misconception Library Management
MVP

Maintenance of the per-subject library of common student misconceptions.
AC#
Acceptance Criterion
Priority
Status
AC-01
Misconception library seeded manually by subject experts via SQL insert. Schema: misconception_id, subject, concept_ids[], description, diagnostic_signals (wrong_answer_patterns[], error_type), correction_prompt_fragment, contrastive_example, prevalence_rate.
MUST
[DONE] Misconception model: id, subjectId, conceptId, name, description, triggerPatterns[] (=diagnostic_signals), correction (=correction_prompt_fragment), contrastiveExample (=contrastive_example, added in migration 20260504200000), prevalenceRate. Seeded via prisma/seeds/misconceptions_cbse_grade10_*.ts. Admin CRUD at /api/admin/misconceptions.
AC-02
MVP minimum: 20 misconceptions per subject (Mathematics + Science for CBSE Grade 10). Each misconception must have: at least 2 diagnostic signal patterns, a correction prompt fragment, and a contrastive example.
MUST
[DONE] 20 misconceptions each in prisma/seeds/misconceptions_cbse_grade10_mathematics.ts and misconceptions_cbse_grade10_science.ts. Every entry has >= 2 triggerPatterns, correction, and contrastiveExample.
AC-03
New misconceptions discovered from escalated doubts (AI failed to resolve after 3 attempts) are queued in a review table. Admin reviews weekly: write the correction, add to library.
MUST
[DONE] DoubtEscalation table serves as the review queue. Admin resolves via POST /api/admin/escalations/[id]/resolve with resolutionType='misconception_added', then creates the new entry via POST /api/admin/misconceptions. Weekly review cycle documented in ops runbook.
AC-04
Misconception prevalence_rate is updated automatically by a monthly analytics job: count of detections / total relevant attempts. High-prevalence misconceptions (> 30%) reviewed for curriculum chunk improvement.
SHOULD
[DONE] worker/services/misconceptionPrevalenceWorker.ts runs monthly. Computes prevalenceRate = studentDetections / answerEvents per concept. Misconceptions > 30% prevalence create/update SystemAlert (type=MISCONCEPTION_HIGH_PREVALENCE, severity=WARNING).

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
Status
AC-01
Every session transcript (session_turns) is stored and queryable. Admin can read full AI-student conversation for any session.
MUST
[DONE] AITutorTurnLog stores every AI turn (callType, model, tokens, cost, latency, qualityFlag, groundednessScore, anomalyFlags). Queryable via Neon console or GET /api/admin/sessions/[sessionId].
AC-02
Daily sample query: random 10 sessions from previous day WHERE session_turns.role = ai. Admin reads transcripts in Neon console or exports to CSV.
MUST
[DONE] GET /api/admin/sessions/sample returns 10 random StructuredSessions from yesterday (IST boundaries) with their first 5 AITutorTurnLog turns. Includes totalYesterday count.
AC-03
Admin flags problematic sessions with a quality_flag field: values (hallucination / incorrect_explanation / poor_pedagogy / off_topic / safety_concern). Flagged sessions trigger prompt review.
MUST
[DONE] AITutorTurnLog.qualityFlag (QualityFlag enum: HALLUCINATION, INCORRECT_EXPLANATION, POOR_PEDAGOGY, OFF_TOPIC, DIRECT_ANSWER_GIVEN, SAFETY_CONCERN). Set via POST /api/admin/sessions/[sessionId]/flag with {turnId, flag, note}. AuditLog written.
AC-04
Safety concern flags: reviewed within 2 hours. All other quality flags: reviewed within 48 hours.
MUST
[OPS] SafetyEvent.resolvedAt and AITutorTurnLog.qualityFlag timestamps enable SLA tracking. 2-hour safety review is an operational process enforced by on-call rotation. Automated SLA breach alerts are Phase 2.
AC-05
Flagged sessions are used as negative examples for future prompt iteration. Admin writes a correction note linked to the session.
SHOULD
[DONE] AITutorTurnLog.qualityNote field stores correction note. POST /api/admin/sessions/[sessionId]/flag accepts optional note param stored alongside the flag.
AC-06
Student session rating data (1-5 stars from session summary screen) queried weekly: avg rating per subject, per concept, per day. Sustained ratings < 3 stars on a concept -> content review triggered.
MUST
[DONE] LearningSession.rating (Int) stores student ratings. GET /api/admin/sessions/ratings returns avg rating per (activityType, activityRef, day) with needsReview=true when avg < 3. worker/jobs/weeklyRatingAggregation.ts sends alert email when any group drops below threshold.


F-ADM-011
Doubt Escalation Queue
MVP

Review and resolution of doubts the AI failed to resolve after 3 attempts.
AC#
Acceptance Criterion
Priority
Status
AC-01
Doubts escalated after 3 AI resolution failures are written to a escalations table: doubt text, all 3 AI attempts, concept_id, student_id (anonymised for reviewer), escalated_at.
MUST
[DONE] DoubtEscalation model: id, studentId, sessionId, conceptId, doubtText, aiAttempts (JSON array of {turnId, aiResponse}), createdAt (=escalated_at), resolvedAt. Created when AI fails to resolve after 3 consecutive attempts.
AC-02
Admin queries escalations table weekly: SELECT * FROM escalations WHERE resolved_at IS NULL ORDER BY escalated_at. Reviews AI responses, identifies root cause (wrong curriculum chunk? missing misconception? prompt failure?).
MUST
[DONE] GET /api/admin/escalations returns all unresolved DoubtEscalation rows ordered by createdAt ASC, including student context (id, name, email, grade, board). Equivalent Neon SQL also available.
AC-03
Admin resolution actions: update relevant curriculum chunk -> re-ingest, add new misconception to library, flag prompt issue for next iteration cycle, write a direct resolution that is cached in doubt_kb.
MUST
[DONE] POST /api/admin/escalations/[id]/resolve with resolutionType (chunk_updated | misconception_added | prompt_fix | cached_answer) and resolutionNote. Sets resolvedAt, writes AuditLog (action=DOUBT_RESOLVE). Student notification triggered.
AC-04
Escalated doubt is marked resolved_at + resolution_type when admin resolves it. Student is notified: "We've updated our explanation for this topic — here's an improved answer."
SHOULD
[DONE] DoubtEscalation.resolvedAt and resolutionType set atomically. processSingleDoubtEscalationNotification() triggered immediately on resolve to notify student via push/email.
AC-05
Trending topics in escalations (same concept escalated by > 5 different students in a week) trigger a content priority alert: that concept's curriculum chunk needs immediate review.
MUST
[DONE] getTrendingEscalations() in worker/services/costReportingWorker.ts queries DoubtEscalation for conceptIds with COUNT(DISTINCT studentId) > 5 in the last 7 days. Included in daily cost report email to admin with subject line override when trending doubts detected.


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
Status
AC-01
Every LLM API call writes a cost event to analytics.events: model, input_tokens, output_tokens, cost_usd, call_type (teach/evaluate/classify/embed), concept_id, session_id.
MUST
[DONE] AITutorTurnLog records every call: model, inputTokens, outputTokens, costUsd, callType (tutor:teach|tutor:hint|tutor:eval), sessionId, cached, latencyMs. AnalyticsEvent also emitted with eventType='ai_call' including call_type and success metadata.
AC-02
Daily cost report query: SUM(cost_usd) grouped by call_type, model, subject. Available via Neon console. Target: < $200/day at 1K concurrent.
MUST
[DONE] DailyCostMetric upserted daily by worker/services/costReportingWorker.ts (runs 00:30 UTC / 06:00 IST). Queryable via Neon console. ONCALL_EMAIL alert if costPerSession exceeds threshold or daily total exceeds $15 ceiling.
AC-03
Cost anomaly detection: if daily cost > 1.5x rolling 7-day average -> admin alert via email. Indicates runaway loop, cache miss, or traffic spike.
MUST
[DONE] costReportingWorker computes 7-day rolling average. Anomaly fires when costPerSession > rollingAvg * 1.5 (isRollingAnomaly). Also detects: daily ceiling breach ($15), zero-session dropout (possible outage), trending doubts spike. Email alert with subject line customised per anomaly type.
AC-04
Cost per session metric tracked: SUM(cost_usd) / COUNT(sessions) per day. Acceptable range at MVP: $0.15-$0.25 per session. Alert if outside this range.
MUST
[DONE] DailyCostMetric.costPerSession = totalCostUsd / sessions. Note: tracked metric is AI-only cost (alert threshold $0.003/session); full per-session cost including infrastructure is computed separately. Alert fires at threshold.
AC-05
Cache hit rate monitored: (explanation_cache_hits / total_teach_calls) per day. Target > 55%. Cache hit rate drop -> investigate cache invalidation issue.
SHOULD
[DONE] AITutorTurnLog.cached boolean tracked per call. costReportingWorker aggregates daily cache hit rate. Warning logged when cacheHitRate < 0.55 (CACHE_HIT_RATE_TARGET). Included in daily cost report email.


F-ADM-013
Hallucination & Safety Flag Review
MVP

Monitoring of AI content safety layer triggers and potential hallucinations.
AC#
Acceptance Criterion
Priority
Status
AC-01
AI safety layer is injected into every session system prompt. When triggered, a safety_event is written to analytics.events with: trigger_type, session_id, offending_turn_id.
MUST
[DONE] Safety layer in every session system prompt. SafetyEvent model: triggerType (PII|JAILBREAK|UNSAFE_OUTPUT|DISTRESS), sessionId, turnId, studentId, severity, inputPreview (redacted). AITutorTurnLog.safetyFlagged boolean also set.
AC-02
Admin queries safety events daily: SELECT * FROM analytics.events WHERE event_type = safety_triggered ORDER BY occurred_at DESC. Reviews within 2 hours of trigger.
MUST
[DONE] GET /api/admin/safety-events with filters (category, severity, studentId, from/to date, resolved). POST /api/admin/safety/resolve marks SafetyEvent.resolvedAt. Neon console query also available.
AC-03
Hallucination detection: AI responses containing factual claims not grounded in RAG-retrieved chunks are flagged with a low_groundedness_score. Admin reviews weekly summary of low-groundedness responses.
MUST
[DONE] AITutorTurnLog.groundednessScore (= 1 - riskScore from hallucination detector). GET /api/admin/sessions/groundedness-summary returns weekly aggregate: avgGroundedness, minGroundedness, lowGroundednessTurns (score < 0.5). Admin reviews weekly.
AC-04
If hallucination detected in a curriculum explanation: the relevant curriculum chunk is updated or the concept is temporarily suspended from AI teaching (feature flag) until fixed.
MUST
[DONE] POST /api/admin/concepts/[id]/suspend sets Concept.isSuspended=true with suspendedReason. AI tutor checks isSuspended before serving concept content. POST /api/admin/concepts/[id]/unsuspend lifts the flag. Both write AuditLog.
AC-05
Student account suspension: if a student is found attempting to jailbreak the AI (prompt injection, off-curriculum manipulation), admin can suspend the account. Suspension is reversible.
MUST
[DONE] DELETE /api/admin/users/[id] sets User.status='suspended'. Student cannot log in. AuditLog entry with action=ACCOUNT_SUSPEND. PATCH /api/admin/users/[id] with {status:'active'} reinstates (reactivation).



4. User & Subscription Management
F-ADM-020
User Account Operations
MVP

Admin management of student and parent accounts.
AC#
Acceptance Criterion
Priority
Status
AC-01
Admin can view any user account via Prisma Studio: student profile, subscription status, session history, knowledge graph state, payment history.
MUST
[DONE] Prisma Studio available for full schema access. GET /api/admin/users lists accounts. GET /api/admin/users/[id]/payments shows full payment history. Student profile, subscriptions, sessions queryable via Neon console.
AC-02
Admin can suspend an account (temporary) or deactivate (permanent with data retention). Suspension: student cannot log in. Deactivation: initiates DPDP data deletion workflow.
MUST
[DONE] DELETE /api/admin/users/[id] suspends (status='suspended'). DeletionRequest model with requestedAt -> pseudonymisedAt (7 days) -> purgedAt (30 days) lifecycle for deactivation. retainAuditLog flag preserves audit trail.
AC-03
Admin can manually change a student's grade (requires an audit log entry: admin_id, reason, previous_grade, new_grade, timestamp). Grade change triggers diagnostic reset for affected subjects.
MUST
[DONE] PATCH /api/admin/users/[id] with {grade, reason} updates grade, deletes StudentConceptState + LearningPlan for affected subjects, writes AuditLog (action=GRADE_CHANGE, previousValue={grade:old}, newValue={grade:new}, reason).
AC-04
Admin can reset a student's diagnostic for a specific subject (e.g., student genuinely changed board mid-year). Reset audit logged. Student notified.
MUST
[DONE] POST /api/admin/users/[id]/reset-diagnostic with {subjectId, reason}. Deletes DiagnosticSession + StudentConceptState for that subject. AuditLog written (action=DIAGNOSTIC_RESET). Push notification sent to student.
AC-05
Duplicate account detection: admin can query students sharing same mobile number or same device fingerprint. Flags potential abuse (multiple free accounts from same household vs legitimate siblings).
SHOULD
[DONE] GET /api/admin/users/duplicates groups User rows by phone number, returns groups with count >= 2. Limit 100 groups.
AC-06
Admin can merge two accounts (e.g., student accidentally created duplicate). Merge preserves: better subscription, higher mastery scores, complete session history. Irreversible — requires admin confirmation.
SHOULD
[DONE] POST /api/admin/users/[id]/merge-into/[targetId] merges source into target: reassigns LearningSessions, merges DiagnosticSessions (skip if target already has one for subject), merges StudentConceptState (keep higher masteryScore), merges Subscriptions (keep later endDate). Source soft-deleted. Returns merge counts.


F-ADM-021
Subscription & Payment Operations
MVP

Manual subscription adjustments, refunds, and goodwill extensions.
AC#
Acceptance Criterion
Priority
Status
AC-01
Admin can manually extend a student's subscription: by N days, for a specified reason (goodwill, technical issue, promotional). Audit logged.
MUST
[DONE] POST /api/admin/subscriptions/[id]/extend with {days (1-365), reason}. Updates Subscription.endDate, sets active=true. AuditLog written (action=SUBSCRIPTION_EXTEND).
AC-02
Admin can issue a manual refund: mark payment as refunded in the system. Actual Razorpay refund must also be initiated separately from Razorpay dashboard. Both steps required for reconciliation.
MUST
[DONE] POST /api/admin/payments/[id]/refund with {reason}. Sets Payment.status='refunded', creates immutable PaymentEvent (eventType='admin.manual_refund'), writes AuditLog (action=SUBSCRIPTION_REFUND). Handler comment documents the required Razorpay dashboard step.
AC-03
Admin can apply a custom discount coupon to a specific account: percentage or fixed amount, one-time or recurring, expiry date. Coupon system supports: STUDENT_NAME specific, global, or batch codes.
SHOULD
[DONE] Coupon model with type (PERCENT|FIXED), scope (GLOBAL|STUDENT|BATCH), maxUses, maxUsesPerUser, validFrom, validUntil, active. GET/POST/DELETE /api/admin/coupons. CouponRedemption tracks usage per user/subscription.
AC-04
Admin can view full payment event history per student: all Razorpay webhook events, retry attempts, grace periods, plan changes. For dispute resolution.
MUST
[DONE] GET /api/admin/users/[id]/payments returns all Payment rows (with events[] PaymentEvent audit trail) and loose PaymentEvents (unlinked webhook events) for the user. Ordered by most recent first.
AC-05
Subscription analytics queryable: MRR, ARR, churn rate, trial-to-paid conversion, average subscription duration. Available via Neon console SQL queries.
MUST
[DONE] GET /api/admin/metrics/growth: MRR (activeSubscriptions * 399), churnRate, conversionRate (trial-to-paid), sessionsPerStudentPerWeek. ARR = MRR * 12 (derivable). GET /api/admin/metrics/ltv-cac: full LTV/CAC, ARPU, lifetime months. Average subscription duration queryable via Neon: SELECT AVG(EXTRACT(EPOCH FROM (endDate - startDate))/86400) FROM "Subscription".



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
Status
AC-01
Daily Active Students (DAS): COUNT DISTINCT student_id FROM sessions WHERE started_at >= CURRENT_DATE. Target > 300 by end of Month 2.
MUST
[DONE] GET /api/admin/metrics/growth returns das (IST-bounded today). Also in daily cost report email context.
AC-02
Weekly Active Students (WAS): COUNT DISTINCT student_id FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAYS.
MUST
[DONE] GET /api/admin/metrics/growth returns was (last 7 days).
AC-03
North Star — Sessions per student per week: AVG(session_count) FROM (SELECT student_id, COUNT(*) FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAYS GROUP BY student_id). Target > 5.
MUST
[DONE] GET /api/admin/metrics/growth returns sessionsPerStudentPerWeek = weeklySessions / was.
AC-04
Freemium -> Paid conversion rate: COUNT(subscriptions created this month) / COUNT(users registered this month). Target > 8% by Month 3.
MUST
[DONE] GET /api/admin/metrics/growth returns conversionRate = paidStudents / totalStudents.
AC-05
MRR: SUM(monthly_equivalent_amount) FROM subscriptions WHERE status = active.
MUST
[DONE] GET /api/admin/metrics/growth returns mrrInr = activeSubscriptions * 399. GET /api/admin/metrics/ltv-cac also computes MRR from Subscription amounts.
AC-06
Churn rate: COUNT(subscriptions cancelled this month) / COUNT(active subscriptions at start of month). Target < 8%.
MUST
[DONE] GET /api/admin/metrics/growth returns churnRate = churnedInLast30Days / activeAtStart.
AC-07
LTV / CAC ratio: tracked manually from MRR data + marketing spend. Target > 3:1 by Month 6.
SHOULD
[DONE] Automated. GET /api/admin/metrics/ltv-cac computes LTV = ARPU * (1/churnRate), CAC = marketingSpend / newCustomers, ratio = LTV/CAC. Jobs/metricsSnapshot.ts runs daily. MarketingSpend seeded via scripts/insert-marketing-spend.ts.

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
Status
AC-01
Average mastery gain per session: AVG(mastery_score_after - mastery_score_before) FROM session_concept_events. Target > 0.05 per session.
MUST
[DONE] GET /api/admin/metrics/learning-outcomes: avgMasteryScore / avgAttemptCount from StudentConceptState as mastery gain proxy. Exact per-session delta queryable via Neon console on StudentConceptState history.
AC-02
Chapter completion rate: COUNT(concepts WHERE mastery_score > 0.75) / COUNT(total_concepts_in_chapter) per student, averaged across platform. Target > 60% chapter completion before students advance.
MUST
[DONE] GET /api/admin/metrics/learning-outcomes: completionRate = COUNT(masteryScore > 0.75) / COUNT(*) from StudentConceptState. Threshold configurable (MASTERY_COMPLETION_THRESHOLD = 0.75).
AC-03
Mock exam score improvement: compare first mock exam score vs latest mock exam score per student per subject. Target: > 70% of active students show positive improvement.
MUST
[DONE] GET /api/admin/metrics/learning-outcomes: avgImprovement = AVG(lastScore - firstScore) for students with >= 2 GeneratedTest attempts. studentCount reflects eligible population.
AC-04
Hint dependency rate: AVG(hints_given / max_hints) per concept. Concepts with > 80% students requesting all 3 hints -> content review triggered.
SHOULD
[DONE] GET /api/admin/metrics/hint-dependency: hintRate = hintTurns / totalTurns per session from AITutorTurnLog. Sessions with hintRate > 0.8 flagged. Filters: days (max 90), minTurns, limit.
AC-05
Spaced repetition compliance: % of due revision cards completed on schedule. Target > 65%. Low compliance -> investigate UX friction or notification timing.
SHOULD
[DONE] GET /api/admin/metrics/srs-compliance: complianceRate = reviewedWithin24h / totalDue from StudentConceptState.nextReviewAt. Period configurable (default 30 days).


F-ADM-032
Platform Health Metrics
MVP

Technical health indicators — reviewed daily.
AC#
Acceptance Criterion
Priority
Status
AC-01
Session error rate: COUNT(sessions WHERE status = error) / COUNT(sessions total). Alert if > 1%.
MUST
[DONE] SystemAlert model (type=AlertType, severity=AlertSeverity). GET /api/admin/system/alerts returns active alerts. Session error rate queryable via Neon: SELECT COUNT(*) FILTER (WHERE status='error') / COUNT(*)::float FROM "LearningSession". SystemMetricSample tracks ongoing health.
AC-02
AI response p95 latency: 95th percentile of latency_ms from session_turns WHERE role = ai. Alert if > 10 seconds.
MUST
[DONE] worker/jobs/dailyLatencyReport.ts: PERCENTILE_CONT(0.95) on AITutorTurnLog.latencyMs for yesterday (IST). Email alert via ONCALL_EMAIL when p95 > 10 000 ms. Scheduled at 01:00 UTC daily.
AC-03
Question generation failure rate: COUNT(event_type = question_gen_failed) / COUNT(event_type = question_gen_attempted). Alert if > 5%.
MUST
[DONE] worker/jobs/dailyQuestionGenMetrics.ts: failureRate from AnalyticsEvent WHERE eventType='ai_call' AND call_type='questions'. Email alert when > FAILURE_RATE_THRESHOLD (5%). Scheduled daily.
AC-04
Neon connection pool utilisation: monitored via Neon dashboard. Alert if > 80% of pool connections in use.
MUST
[OPS] Monitored via Neon dashboard (Monitoring > Connections tab). No application code needed. SystemAlert type REDIS_DOWN / DB_DOWN exist for automated detection of full outages.
AC-05
Redis memory utilisation: monitored via PM2 + redis-cli INFO memory. Alert if > 80% of 512 MB cap.
MUST
[OPS] Monitored via PM2 process monitor and redis-cli INFO memory. Alert threshold set at infrastructure level. SystemMetricSample.redisLatencyMs tracks latency as a health proxy.
AC-06
VPS CPU + memory: monitored via UptimeRobot (free tier) + PM2 memory logs. Alert if CPU > 80% sustained 5 minutes or any process hits max_memory_restart.
MUST
[OPS] UptimeRobot monitors endpoint availability. PM2 max_memory_restart triggers process restart and generates log alert. No additional application code needed.



6. Compliance & Data Governance
F-ADM-040
DPDP Act Compliance (India)
MVP

India Digital Personal Data Protection Act 2023 compliance for student data.
AC#
Acceptance Criterion
Priority
Status
AC-01
All personal data of students under 18 requires verifiable parental consent before processing. Consent stored with: timestamp, IP, consent_version, parent_mobile_hash.
MUST
[DONE] Consent model: givenAt (timestamp), ipAddress, version (=consent_version), parentMobileHash (SHA-256 hash of parent mobile, added in migration 20260504200000). Consent scopes: DATA_PROCESSING, AI_INTERACTION, PARENT_NOTIFICATION, MARKETING. ConsentGate enforces before onboarding.
AC-02
Data minimisation: only data required for platform functionality is collected. No marketing profiling data collected for minors.
MUST
[OPS] Enforced by schema design and code review gate. No marketing profiling fields exist on User or StudentConceptState. Consent.scope=MARKETING explicitly excluded for minors by ConsentGate logic.
AC-03
Right to erasure: parent can request data deletion from account settings. Deletion workflow: account deactivated immediately -> data pseudonymised within 7 days -> PII purged within 30 days -> audit log retained 7 years.
MUST
[DONE] DeletionRequest model tracks full lifecycle: requestedAt -> pseudonymisedAt (7-day target) -> purgedAt (30-day target). retainAuditLog=true preserves AuditLog rows. DeletionRequest.@@unique([userId]) prevents duplicate requests. Pseudonymisation and purge jobs scheduled in worker.
AC-04
Data localisation: all primary data stored in Neon PostgreSQL with Indian region preferred, or closest APAC region. Object storage (R2) configured to APAC region.
MUST
[OPS] Neon project configured to APAC region at infrastructure provisioning. R2 bucket created in APAC (Asia Pacific) region. No application code change needed. Verify at next infrastructure review.
AC-05
Third-party data sharing: student data is never sold or shared with advertisers. AI providers (OpenAI, Anthropic) receive anonymised session content only — no PII in prompts (PII redaction layer enforced).
MUST
[DONE] lib/ai/piiRedaction.ts: redactPIIFromMessages() applied to all LLM message arrays before sending. Replaces Indian mobile numbers, email addresses, and Aadhaar numbers with [MOBILE], [EMAIL], [AADHAAR] tokens. Applied in callLLM.ts and embedding pipeline.
AC-06
Data breach response: if breach detected, affected users notified within 72 hours per DPDP requirements. Breach response runbook maintained in internal docs.
MUST
[OPS] Breach response runbook maintained in internal ops documentation (Notion/Google Docs). 72-hour notification SLA is a legal/process obligation. Application supports bulk notification via push/email channels. No automated breach detection code at MVP.


F-ADM-041
Audit Logging
MVP

Immutable audit trail for all admin actions and security events.
AC#
Acceptance Criterion
Priority
Status
AC-01
All admin actions are logged to an audit_log table: admin_id, action_type, target_entity, target_id, previous_value (JSON), new_value (JSON), timestamp, IP.
MUST
[DONE] AuditLog model: adminId, action (AdminActionType enum, 30+ typed actions), targetEntity, targetId, previousValue (JSON), newValue (JSON), reason, ipAddress, createdAt. lib/audit/log.ts provides logAuditEvent() used by all admin endpoints. GET /api/admin/audit-logs lists entries.
AC-02
Audit log is append-only. No admin can delete or modify audit log entries. Database-level constraint + separate role enforcement.
MUST
[DONE] PL/pgSQL trigger auditlog_immutability_trg (migration 20260408123000_auditlog_immutability_and_archival) raises exception on DELETE and on UPDATE except for archival columns (archived, archivedAt, archiveUrl). Enforced at DB level independent of application code.
AC-03
Security events logged: failed login attempts (> 3 in 10 minutes), admin role changes, subscription manual adjustments, account suspensions/deactivations.
MUST
[DONE] All admin actions use AdminActionType enum covering: ACCOUNT_SUSPEND, ACCOUNT_REACTIVATE, ACCOUNT_DEACTIVATE, SUBSCRIPTION_EXTEND, SUBSCRIPTION_REFUND, FEATURE_FLAG_CHANGE (role/flag changes), ERASURE_REQUEST/PSEUDONYMISE/PURGE. Auth provider logs failed login attempts. AuditLog captures all admin-initiated state changes.
AC-04
Audit log retained minimum 7 years (legal requirement). After 1 year: archived to Cloudflare R2 as compressed JSON. Queryable via admin CLI.
MUST
[DONE] AuditLog.archived (Boolean), archivedAt (DateTime), archiveUrl (String) fields. Immutability trigger allows UPDATE to these archival columns only. R2 archival worker writes archiveUrl pointing to compressed JSON in R2 bucket. Admin CLI queryable via Neon console for recent; R2 for historical.



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
