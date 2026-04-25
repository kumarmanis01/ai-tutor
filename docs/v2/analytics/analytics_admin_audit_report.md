<!--
FILE OBJECTIVE:
- Final consolidated analytics admin audit report: findings, requirements,
  gaps, and prioritized remediation plan for Spinzy AI Tutor analytics.

LINKED UNIT TEST:
- tests/unit/docs/analytics_event_callsites.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
 - 2026-04-21T00:00:00Z | copilot | created final admin audit report
 - 2026-04-21T10:36:00Z | copilot | appended Decisions & Discussion Log
## Decisions & Discussion Log

- 2026-04-21T10:20:00Z | copilot | Added Implementation Roadmap (Tasks A-L) and established this Decisions Log as the canonical place to record architecture and policy choices.
- 2026-04-21T10:22:00Z | copilot | Architecture decision: Hybrid forwarding recommended — keep raw and operational telemetry internal; forward only sanitized or aggregated events to third-party analytics for exploratory analysis. Forwarder must be gated by ANALYTICS_FORWARDER_ENABLED and ANALYTICS_SINK_URL, and must implement PII-stripping and idempotency.
- 2026-04-21T10:24:00Z | copilot | Privacy decision: Raw LLM prompts must not be persisted in plain text. Persist `prompt_hash` (sha256) and `prompt_redacted_preview` (<=200 chars) only. If raw prompts are required for debugging, use an encrypted feature-flagged secure store with strict retention (default disabled).
- 2026-04-21T10:26:00Z | copilot | Retention policy decisions (defaults): raw `AnalyticsEvent`: 90 days; LLM telemetry (no raw prompt): 365 days; aggregated rollups: 2 years; `AuditLog` immutable retention: 7+ years. Make configurable via env (e.g. ANALYTICS_RETENTION_DAYS).
- 2026-04-21T10:28:00Z | copilot | Data lifecycle & purge strategy: use date-partitioned `AnalyticsEvent` tables, nightly archival to encrypted R2/S3 (manifest recorded), then batched deletion of partitions older than the retention window. Implement a purge worker with safe batching and vacuum steps.
- 2026-04-21T10:30:00Z | copilot | Operational controls: introduce a durable queue (BullMQ/Redis) between ingestion and DB to absorb spikes and retry on transient failures. Aggregator must checkpoint progress to avoid duplicate processing. Forwarder must use exponential backoff, circuit-breaker, and idempotency keys (sha256(eventType + eventId + source)).
- 2026-04-21T10:32:00Z | copilot | Forwarder rules: strip PII before forwarding, map canonical schema to sink schema, include an idempotency key, and log successes/failures. Gate forwarding by `ANALYTICS_FORWARDER_ENABLED` and `ANALYTICS_SINK_URL`.
- 2026-04-21T10:34:00Z | copilot | Immediate priorities (confirmed): Task A (Prompt redaction) — Critical; Task C (subject_selected instrumentation) — High. Aggregator and forwarder remain blocked until redaction policy is enforced.
- 2026-04-21T10:36:00Z | copilot | Governance: any change that affects data retention, raw prompt access, or external forwarding requires Compliance approval and a signed policy placed in `docs/compliance/retention_policy.md` before enabling in production.
- 2026-04-21T10:38:00Z | user | Requested ongoing updates: keep this document updated with all discussions and decisions; maintainers will treat this file as canonical for analytics decisions.

- 2026-04-21T00:00:00Z | copilot | created final admin audit report
-->

# Analytics — Admin Audit Report (v2)

**Executive Summary**

- Purpose: Provide a single authoritative report for admins and engineers describing what the system currently logs, where those logs are emitted, which important user-journey events are missing or inconsistent, privacy/security risks, and a prioritized remediation plan to reach audit-grade observability.
- Scope: Student, Parent, Admin journeys; server and client instrumentation; LLM/tutor telemetry; messaging channels; aggregation & forwarding.
- Key outcome: a CSV of detected server-side event write call sites ([analytics_event_callsites.csv](analytics_event_callsites.csv)), a reconciliation report against the client allowlist ([analytics_event_reconciliation.md](analytics_event_reconciliation.md)), and recommended next steps.

**Where this data came from**

- Repo scan for `prisma.analyticsEvent.create(...)` and `prisma.event.create(...)` call sites.
- Manual review of LLM wrapper (`lib/callLLM.ts`), tutor orchestration (`services/tutor/turn.ts`), onboarding (`app/api/user/onboarding/route.ts`), diagnostics (`app/api/student/diagnostic/submit/route.ts`), messaging (`lib/whatsapp.ts`), and the client analytics endpoint (`app/api/analytics/event/route.ts`).

**Inventory — important server-emitted event types (non-exhaustive)**

- `ai_call` — LLM/embedding telemetry with tokens, cost_usd, cache_hit, session_id, concept_id (emitted from `lib/callLLM.ts` and embedding utilities).
- `trial_start` — produced during trial signup (`app/api/trial/route.ts`).
- `converted_to_paid` / `subscription.verified` — produced on payment/verify flow (`app/api/payments/verify-subscription/route.ts`).
- `ingest_run`, `ingest_run_retry` — ingestion/ops telemetry from ingestion scripts (`scripts/*`, `ingest-curriculum.ts`, `scrape-ncert.ts`, `reembed.ts`).
- Tutor safety & quality: `safety_trigger`, `safety_triggered`, `hallucination_detected`, `hallucination_blocked`, `copy_paste_detected` (`services/tutor/turn.ts`).
- Operational/audit `Event` rows: `otp_widget_token`, `challenge_completed`, `whatsapp_opt_in`, `whatsapp_opt_out`, `whatsapp_message_sent` (`app/api/user/onboarding/route.ts`, `app/api/challenge/submit/route.ts`, `lib/whatsapp.ts`, `utils/logEvent.ts`).
- System job health: `weekly_question_health` (`worker/jobs/weeklyQuestionHealth.ts`).

Refer to full mapping: [analytics_event_callsites.csv](analytics_event_callsites.csv).

**High-level Event Definitions**

- Auth & Session
  - `sign_up`: emitted on successful account creation. Fields: `userId`, `method`, `utm`, `timestamp`, `ip_hash`, `request_id`, `platform`.
  - `sign_in`: login attempts/success. Fields: `userId|null`, `method`, `success` (bool), `failure_code` (opt), `timestamp`, `ip_hash`, `request_id`.
  - `sign_out`: Fields: `userId`, `timestamp`, `session_id`.
  - `session_start` / `session_end`: session lifecycle. Fields: `session_id`, `userId|null`, `platform`, `duration_ms` (end event), `request_id`.

- Onboarding
  - `onboarding_started`: customer begins onboarding. Fields: `userId|null`, `timestamp`, `source`.
  - `onboarding_completed`: profile complete. Fields: `userId`, `grade`, `board`, `subjects[]`, `timestamp`.
  - `subject_selected`: user selects or updates subject preferences. Fields: `userId`, `subject_id`, `previous_subjects` (opt), `timestamp`.

- Diagnostics & Assessment
  - `diagnostic_started`: Fields: `userId`, `diagnostic_id`, `timestamp`, `variant`.
  - `diagnostic_answer`: per-question event. Fields: `userId`, `diagnostic_id`, `question_id`, `answer_id`, `correct` (bool), `time_spent_ms`, `timestamp`.
  - `diagnostic_completed`: Fields: `userId`, `diagnostic_id`, `score`, `percent_correct`, `duration_ms`, `timestamp`.

- Tutor & LLM Telemetry
  - `ai_call`: every LLM or embedding invocation. Fields (minimal): `userId|null`, `model`, `call_type` (`tutor`|`embed`|`hint`), `prompt_hash` (no raw prompt), `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `success` (bool), `error` (opt), `session_id`, `turn_id` (opt), `timestamp`.
  - `tutor_turn`: higher-level tutor-turn events (student-visible). Fields: `session_id`, `turn_id`, `userId`, `tag` (`QUESTION`/`HINT`), `served_from_cache` (bool), `groundedness_score` (opt), `timestamp`.
  - Safety/quality: `safety_trigger`, `safety_triggered`, `hallucination_detected`, `hallucination_blocked`, `copy_paste_detected`. Fields: `userId`, `session_id`, `turn_id`, `reason`, `severity`, `timestamp`.

- Content & Engagement
  - `content_viewed` / `lesson_viewed` / `lesson_completed`: Fields: `userId|null`, `content_id`, `content_type`, `duration_seconds`, `progress_pct`, `source`, `timestamp`.
  - `hint_requested` / `explanation_requested`: Fields: `userId`, `session_id`, `hint_type`, `timestamp`.

- Payments & Subscriptions
  - `purchase_initiated` / `purchase_completed`: Fields: `userId`, `order_id`, `plan_id`, `amount_paise`, `currency`, `provider`, `status`, `timestamp`.
  - `converted_to_paid` / `subscription_started` / `subscription_cancelled`: Fields: `userId`, `plan_id`, `billing_cycle`, `amount`, `timestamp`.

- Messaging & Channels
  - `message_queued` / `message_sent` / `message_delivered` / `message_failed`: Fields: `channel` (`whatsapp`|`email`|`sms`), `provider_message_id`, `recipient_id`, `template_id`, `status`, `failure_reason` (opt), `queued_at`, `sent_at`, `delivered_at`.
  - `parent_message_opt_in` / `parent_message_opt_out`: Fields: `parentId`, `channel`, `timestamp`.

- Admin & Audit (immutable)
  - `admin_sign_in`: Fields: `admin_id`, `mfa_used`, `ip_hash`, `timestamp`.
  - `admin_action`: any change by admin (user edit, role change, feature toggle). Fields: `admin_id`, `action`, `target_id` (user/feature), `diff` or `changes`, `reason`, `request_id`, `timestamp`.
  - Audit rows SHOULD be written to a dedicated `AuditLog` (immutable) table with restricted access.

- System & Workers
  - `job_enqueued` / `job_started` / `job_completed` / `job_failed`: Fields: `job_name`, `job_id`, `run_id`, `status`, `duration_ms`, `error_details` (opt), `timestamp`.
  - `ingest_run` / `ingest_run_retry` / `weekly_question_health`: Fields: `runId`, `fileSource`, `chunksCreated`, `chunksUpdated`, `embeddingsGenerated`, `errors`, `durationMs`, `timestamp`.

- Observability & Errors
  - `api_error` / `external_api_failure`: Fields: `endpoint`, `status_code`, `error_message`, `request_id`, `stack_hash` (opt), `timestamp`.
  - `rate_limit` / `quota_exceeded`: Fields: `resource`, `userId|null`, `limit`, `window`, `timestamp`.

**Minimal canonical event schema (required fields)**

- `event_type` (string)
- `timestamp` (ISO-8601)
- `source` (`client`|`server`|`worker`)
- `actor_id` (string|null)
- `actor_role` (`Student`|`Parent`|`Admin`|`System`)
- `session_id` (string|null)
- `request_id` (string|null)
- `correlation_id` (string|null)
- `platform` (`web`|`android`|`ios`|`worker`)
- `env` (`production`|`staging`|`development`)
- `metadata` (object — event-specific payload)

Notes:

- Always prefer `prompt_hash` over raw prompt text and enforce strict retention and access controls for any raw LLM artifacts.
- Keep sensitive operational events (LLM telemetry, safety signals, provider errors) server-generated only; do not accept them from untrusted clients.
- Use consistent naming and document any additions to this canonical list in `analytics_event_callsites.csv` and the reconciliation doc.

**Client allowlist vs server taxonomy**

- Client `VALID_EVENT_TYPES` (see `app/api/analytics/event/route.ts`) currently allows: `lesson_viewed`, `lesson_completed`, `session_started`, `session_completed`, `quiz_submitted`, `doubt_asked`, `streak_updated`, `xp_earned`, `badge_unlocked`, `hint_requested`, `diagnostic_started`, `diagnostic_completed`, `page_view`.
- Finding: The client allowlist is intentionally narrow. Many server events are server-only and contain sensitive or operational metadata (LLM telemetry, ingestion runs, safety/hallucination signals, message provider errors) and must remain server-only.
- Gap: no explicit `subject_selected` event in server-side analytics (onboarding writes profile but does not emit an explicit `subject_selected` `AnalyticsEvent`). If subject-selection analytics is required for admin funnels, add a controlled client-server flow for `subject_selected`.

**Gaps & Risks (priority-ranked)**

- Lacking subject-selection instrumentation (Product funnel gap). Priority: High.
- No external sink/forwarder configured — dashboards rely on DB-only rollups (Ops/BI gap). Priority: High.
- LLM prompt storage risk: some logs store `requestBody` / `prompt` in turn/content logs. This may capture user-submitted PII or answers. Risk: PII leakage and privacy. Priority: Critical.
- Aggregation worker (`analyticsAggregator`) not fully implemented or scheduled; rollups absent. Priority: High.
- Client/server taxonomy mismatch — potential for duplicated or missing funnel events. Priority: Medium.
- No immutable `AuditLog` for admin actions — audit requirement for compliance. Priority: Medium.

**Detailed recommendations**

Short-term (1–7 days)

- Add `subject_selected` event: implement client instrumentation and a server-side `AnalyticsEvent` write endpoint (extend `VALID_EVENT_TYPES` + server validation to accept `subject_selected`) — Product/Frontend + Backend.
- Remove or redact full raw prompts from persisted turn logs: replace `requestBody: { prompt }` writes with `prompt_hash` and a redacted preview (max 200 chars). If raw capture is required for debugging, store it in an access-controlled secure store (encrypted blob) with strict retention rules. — Backend/Security.
- Add a test to assert `app/api/analytics/event/route.ts` continues to reject unknown client event types and accepts any newly-added ones. (We added tests verifying CSV presence; expand them to validate allowlist behavior.)
- Ensure `utils/logEvent.ts` only writes when session user exists (already guarded) and confirm it is used consistently for client-originated user-auditable events.

Medium-term (1–4 weeks)

- Implement a scheduled `analyticsAggregator` worker (or enable the skeleton at `worker/services/analyticsAggregator.ts`) to compute daily rollups and materialized counters: DAU, onboarding funnel, diagnostic completion rate, LLM cost by user, message delivery rates. Use a checkpointing strategy (already present in the skeleton). — Backend/Infra.
- Add an optional forwarder (config-driven) that posts sanitized payloads to a SaaS analytics sink (PostHog/Amplitude/GA4). Forward only aggregated or sanitized event payloads; never forward raw LLM prompts. Include: batching, retries with exponential backoff, idempotency keys, and success/failure metrics. — Infra/Analytics.
- Build an immutable `AuditLog` table for admin actions (separate from `AnalyticsEvent`) and migrate admin write paths to that table. Mark audit rows as immutable in the application and CI checks. — Backend/Compliance.

Long-term (quarter)

- Build admin dashboards for: onboarding funnel, diagnostic conversion, subject adoption heatmap, LLM cost by user cohort, safety/hallucination alert stream, and message reliability dashboard. Use DB rollups for precise counts and a SaaS sink for exploratory analytics. — Product/BI.
- Implement data retention & archival policies: purge or archive raw logs older than the retention window; keep aggregated counters for longer. — Infra/Compliance.

**Privacy & Security controls**

- Never persist raw PII in `metadata`. Use hashed identifiers and `ip_hash` for geo/abuse detection.
- LLM prompt policy: persist only `prompt_hash`, `prompt_redacted_preview` (<=200 chars), `tokens_in`, `tokens_out`, `cost_usd`, `model`, `session_id`. Move any raw prompt to encrypted secure storage if absolutely required for debugging, with strict RBAC and audit.
- For operational logs that include errors from external providers (e.g., WhatsApp delivery errors), apply redaction rules to remove phone numbers and provider tokens.
- Add alerts for abnormal rates: safety triggers > X/day, hallucination_detected > Y/day, LLM cost/day > budget threshold.

**Aggregator & Forwarder design (implementation sketch)**

- Source: `AnalyticsEvent` table (server-generated) only.
- Worker model:
  - Checkpoint on last processed `analyticsEvent.id` (see `worker/services/analyticsAggregator.ts` skeleton).
  - Batch-read events ordered by id; compute in-memory aggregations per batch; persist rollups to a `analyticsRollup` table or a small cache layer.
  - Forward sanitized payloads to external sink only when `ANALYTICS_SINK_URL` is set in env.
  - Failure handling: retries with backoff; on repeated failure, raise alert and write failure metric to monitoring.

Forwarding rules (must enforce):

- Strip PII from `metadata` before forwarding.
- Map canonical event fields to sink-specific schema.
- Use idempotency key: sha256(eventType + eventId + source) to avoid duplicates.

**Testing & CI requirements**

- Unit tests:
  - Presence tests for canonical docs/files (done).
  - `analytics.endpoint` tests: valid allowlist accepted; invalid types rejected (add tests).
  - LLM logging tests: assert prompt redaction / prompt_hash behavior and that `ai_call` events include numeric `cost_usd`.
  - Aggregator tests: computeRollups should correctly produce DAU and funnel counts for a seeded event set.
- Integration tests:
  - End-to-end test for client → batch endpoint → DB ingest → aggregator consumption (can be mocked).
- CI gates:
  - New code must pass `npm run lint`, `npm run type-check`, and unit tests before merge.

**Operational runbook snapshots**

- Monitor: failed analytics writes, forwarder failures, aggregator checkpoint lag, sudden spike in `ai_call` cost_usd.
- Alerting: safety_trigger or hallucination_detected spikes should create a P1 ticket for product and trust & safety.

**Actionable checklist (owner + priority)**

1. Backend: Implement `subject_selected` server write & extend `VALID_EVENT_TYPES` (Priority: High, ETA: 1–2 days).
2. Backend/Security: Stop persisting raw LLM prompts; replace with `prompt_hash` + redacted preview (Priority: Critical, ETA: 1–3 days).
3. Backend/Infra: Deploy and schedule `analyticsAggregator` worker; enable forwarder behind a feature flag (Priority: High, ETA: 1–2 weeks).
4. Product/Frontend: Add client instrumentation for `subject_selected` and ensure debouncing to avoid duplicates (Priority: High, ETA: 3–5 days).
5. Infra: Configure `ANALYTICS_SINK_URL` and secure key store for forwarder if using SaaS (Priority: Medium, ETA: 1 week after rollups ready).
6. Compliance: Design audit retention policy and immutable `AuditLog` (Priority: Medium, ETA: 2–4 weeks).

**Appendix — files created during audit**

- `analytics_event_callsites.csv` — server-side event call-site mapping.
- `analytics_event_reconciliation.md` — reconciliation between server events and client allowlist.
- `analytics_user_journey.md` — canonical user-journey mapping and recommended event schema.
- `analytics_performance.md` — performance & zero-impact instrumentation strategy.

**Next step (recommended)**

- Prioritise the `prompt redaction` and `subject_selected` instrumentation tasks immediately. Once those are complete, schedule the `analyticsAggregator` deployment and enable controlled forwarding to a SaaS sink.

---

Report prepared by automation based on a code scan and manual review of server-side analytics instrumentation. If you want I can (pick one):

- implement `subject_selected` server handler and client allowlist update,
- implement prompt redaction changes in `lib/callLLM.ts` and add tests,
- or build the aggregator deployment manifests and PM2 worker entry.

Choose one and I will proceed.
