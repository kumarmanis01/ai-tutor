<!--
FILE OBJECTIVE:
- Consolidated mapping of Student/Parent/Admin user journeys and the analytics events that must be logged for observability, product metrics, and auditability.

LINKED UNIT TEST:
- tests/unit/docs/analytics_user_journey.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-21T00:00:00Z | copilot | created analytics user journeys v2 doc
-->

# Analytics — User Journeys (v2)

## Purpose

This document lists the full Student, Parent, and Admin user journeys and the explicit events that must be logged at each touchpoint. It describes a canonical event schema, recommended event types, ingestion paths in the codebase, observed gaps, and prioritized recommendations to achieve consistent, auditable telemetry.

## Scope

- Actors: Student, Parent, Admin (plus Worker/System for background jobs)
- Channels: web client (GTM + batch endpoint), server-side instrumentation, background workers, messaging channels (WhatsApp, email, SMS)
- Persistence: in-DB event store (`AnalyticsEvent`, `Event`, `aITutorTurnLog`, `aIContentLog`) and structured logs via `lib/logger`

## Canonical Event Schema (recommended)

Use a minimal, consistent schema for every event. Store detailed payload in `metadata`.

```json
{
  "event_type": "string",
  "actor_id": "string | null",
  "actor_role": "Student|Parent|Admin|System",
  "actor_anonymous_id": "string",
  "session_id": "string",
  "timestamp": "ISO-8601 string",
  "source": "client|server|worker",
  "platform": "web|android|ios",
  "env": "production|staging|development",
  "request_id": "string",
  "correlation_id": "string",
  "user_agent": "string",
  "ip_hash": "string",
  "app_version": "string",
  "metadata": {}
}
```

Common field notes:
- `actor_id`: canonical PK (User.id) when available; null for unauthenticated actions.
- `actor_anonymous_id`: persist a stable anonymous id for cross-session attribution when anonymous.
- `ip_hash`: store a one-way hash of IP to support geo/abuse signals without PII.
- `request_id` / `correlation_id`: propagate from edge → server → worker for traceability.

## Ingestion paths (observed)

- Client batch endpoint: [app/api/analytics/event/route.ts](app/api/analytics/event/route.ts) — canonical client → server batch ingestion.
- Server direct writes: `prisma.analyticsEvent.create(...)` used across the codebase (LLM, tutor, messaging, onboarding).
- LLM instrumentation: [lib/callLLM.ts](lib/callLLM.ts) — writes `aITutorTurnLog`/`aIContentLog` and emits `ai_call` analytics events.
- Tutor orchestration: [services/tutor/turn.ts](services/tutor/turn.ts) — emits safety, hallucination, and tutor-turn events.
- Diagnostics: [app/api/student/diagnostic/submit/route.ts](app/api/student/diagnostic/submit/route.ts) — persists `AnswerEvent` rows.
- Onboarding / Subject selection: [app/api/user/onboarding/route.ts](app/api/user/onboarding/route.ts) — persists profile and enqueues bootstrap jobs.
- Messaging: [lib/whatsapp.ts](lib/whatsapp.ts) and [app/api/whatsapp/webhook/route.ts](app/api/whatsapp/webhook/route.ts) — opt-in/out and message send events written to `Event`.
- GTM: [components/GoogleTagManager.tsx](components/GoogleTagManager.tsx) — client-side `dataLayer` push for external trackers (optional).

## Student Journey — Events to log (core list)

- `session_start`: when a session is created or resumed. Fields: `session_id`, `auth_method`, `platform`, `device_info`, `referrer`.
- `sign_up`: successful account creation. Fields: `method`, `utm`, `referrer`. Instrument: server-side sign-up endpoint and client GTM (`trackSignup`).
- `sign_in`: login success/failure. Fields: `method`, `success`, `failure_code`.
- `onboarding_complete`: user completed profile (grade/board/subjects). Fields: `subjects[]`, `grade`, `board`. Instrument: onboarding route [app/api/user/onboarding/route.ts](app/api/user/onboarding/route.ts).
- `subject_selected`: user picks or changes a subject. Fields: `subject_id`, `subject_name`, `previous_subject_id`.
- `diagnostic_started`: begins diagnostic. Fields: `diagnostic_id`, `variant`.
- `diagnostic_answer`: per-question event. Fields: `diagnostic_id`, `question_id`, `answer_id`, `correct` (bool), `time_spent_ms`. Persisted via `AnswerEvent` in [app/api/student/diagnostic/submit/route.ts](app/api/student/diagnostic/submit/route.ts).
- `diagnostic_completed`: final score, percent_correct, duration_ms.
- `ai_call` / `tutor_turn`: every LLM call. Fields: `model`, `model_version`, `prompt_type`, `prompt_hash`, `tokens_in`, `tokens_out`, `cost_usd`, `response_time_ms`, `success`, `safety_flags`, `hallucination_detected`.
  - Instrumentation: [lib/callLLM.ts](lib/callLLM.ts) should write `aITutorTurnLog`/`aIContentLog` and emit an `ai_call` analytics event with correlation ids.
- `content_viewed`: user opens an explanation / lesson. Fields: `content_id`, `content_type`, `source`.
- `answer_submitted` / `question_attempted`: assessment interactions.
- `hint_requested` / `explanation_requested`: user assistance flows.
- `purchase` / `subscription_started` / `subscription_cancelled`: payment lifecycle events. Client purchase events also pushed to GTM via `trackPurchase`.
- `message_sent` / `message_delivered` / `message_failed`: messages to users (channel metadata below).

## Parent Journey — Events to log

- `parent_sign_up` / `parent_sign_in`: same fields as user auth events, plus `linked_child_id` when applicable.
- `parent_link_child`: parent links to child account. Fields: `child_id`, `link_method`.
- `parent_view_child_progress`: parent views child dashboard. Fields: `child_id`, `section`.
- `parent_message_opt_in` / `parent_message_opt_out`: messaging preferences (WhatsApp/email/SMS). Instrument: [lib/whatsapp.ts](lib/whatsapp.ts).
- `parent_receive_message` / `parent_reply_message`: inbound interactions from parent channels.

## Admin Journey — Events to log (audit-grade)

- Administrative actions MUST be auditable and immutable. Preferred: dedicated `AuditLog` table; if stored in `AnalyticsEvent` also mark `is_audit=true`.
- `admin_sign_in` / `admin_sign_out` — record MFA status and IP hash.
- `admin_view_user` / `admin_edit_user` — fields: `target_user_id`, `changes`, `reason`, `request_id`.
- `admin_run_report` / `admin_download_report` — fields: `report_id`, `filters`, `row_count`.
- `admin_toggle_feature` — record before/after state.
- `admin_mark_diagnostic_reviewed` — record reviewer id and decision.

Important: do not log PII in the audit message body; link to a secure storage entry if PII is necessary for compliance review.

## Messaging / Channel fields (all channels)

Every message event should include:
- `channel`: `whatsapp|email|sms|push`
- `message_id`: provider id
- `template_id` or `template_name`
- `recipient_id` (user id)
- `status`: `queued|sent|delivered|failed|bounced`
- `failure_reason` (string)
- `queued_at` / `sent_at` / `delivered_at` timestamps

Instrumentation: message senders (e.g. [lib/whatsapp.ts](lib/whatsapp.ts)) must emit both success and failure events and include upstream provider errors.

## Diagnostics & Assessment (detailed)

- Persist per-question `diagnostic_answer` (already present via `AnswerEvent`). Also emit aggregated `diagnostic_completed` with overall score and band.
- Track attempted vs completed rates to build completion funnels for admins.

## LLM / Tutor telemetry (detailed)

- All LLM invocations must be logged with cost metadata, prompt hash (never raw prompt in DB unless redacted & access-controlled), latency, and outcome. Existing instrument point: [lib/callLLM.ts](lib/callLLM.ts).
- Emit correlated `analyticsEvent` rows and persist detailed turn logs in `aITutorTurnLog` / `aIContentLog`.

## Client vs Server instrumentation

- Client-side: use GTM (`components/GoogleTagManager.tsx`) for marketing analytics and push page events to the `dataLayer`.
- Client → Server event pipeline: prefer batching to [app/api/analytics/event/route.ts](app/api/analytics/event/route.ts) via `sendBeacon`/background `fetch`.
- Server-side: always emit `analyticsEvent` rows for business-critical operations (auth, purchases, diagnostics, LLM calls, admin actions).

## Aggregation, Rollups & Forwarding

- Implement an `analyticsAggregator` worker (missing in repository) that reads recent events, computes rollups (daily active users, onboarding funnels, diagnostic conversion, message delivery rates) and writes materialized counters or forwards to external analytics.
- Add an optional forwarder to external SaaS (PostHog / Amplitude / GA4) from the worker so production dashboards can leverage both DB and SaaS.

## Gaps observed in the codebase

- `analyticsAggregator` worker referenced in docs/tests but not present — implement to provide rollups.
- `VALID_EVENT_TYPES` whitelist in [app/api/analytics/event/route.ts](app/api/analytics/event/route.ts) may not include all server-side event types (e.g., `admin_action`, `ai_call` variants). Reconcile server call sites against the whitelist.
- Client subject-selection instrumentation not consistently present — ensure `subject_selected` fires from onboarding and settings UI.
- No automated external forwarding or analytics sink; system is DB-centric.

## Privacy, Security & Compliance

- Never store raw PII in event `metadata`. Use hashed identifiers or secure references.
- For LLM prompts: store only a `prompt_hash` and a redacted version if required. Raw prompts should not be persisted in open tables.
- Use `ip_hash` instead of raw IPs.
- Ensure audit logs are immutable and access-controlled.

## Recommended short-term actions (priority)

1. Add/verify `subject_selected`, `sign_in`, and `sign_up` server-side events and ensure they are allowed by `VALID_EVENT_TYPES`.
2. Implement a lightweight `analyticsAggregator` worker to compute core daily rollups and forward to an external analytics sink if desired.
3. Ensure `lib/callLLM.ts` emits consistent `ai_call` events with cost and correlation ids.
4. Add a test suite that enumerates all `prisma.analyticsEvent.create(...)` and `prisma.event.create(...)` call sites and verifies presence in the canonical events list (next deliverable).

## Recommended medium-term actions

- Build admin dashboards for: onboarding funnel, diagnostic completion funnel, LLM cost per user, message delivery reliability, subject adoption heatmap, safety/hallucination alerts.
- Add data retention & archival policies; purge or archive raw logs older than retention windows.
- Harden audit logging for admin actions into a separate immutable store.

## Appendix — Canonical event types (recommended minimal set)

- Auth: `sign_up`, `sign_in`, `sign_out`, `session_start`
- Onboarding: `onboarding_complete`, `subject_selected`
- Diagnostics: `diagnostic_started`, `diagnostic_answer`, `diagnostic_completed`
- Tutor / AI: `ai_call`, `tutor_turn`, `hallucination_detected`, `safety_trigger`
- Content: `content_viewed`, `hint_requested`, `explanation_requested`
- Payments: `purchase`, `subscription_started`, `subscription_cancelled`
- Messaging: `message_sent`, `message_delivered`, `message_failed`, `message_received`, `parent_message_opt_in`, `parent_message_opt_out`
- Admin / Audit: `admin_sign_in`, `admin_action`, `admin_view_user`, `admin_download_report`
- System / Worker: `job_enqueued`, `job_started`, `job_completed`, `job_failed`

## Next steps

- Call-site CSV created: [docs/v2/analytics_event_callsites.csv](docs/v2/analytics_event_callsites.csv) — full mapping of detected server-side event write call sites (file, line, table, event_type, actor, description).
- Reconciliation report: [docs/v2/analytics_event_reconciliation.md](docs/v2/analytics_event_reconciliation.md) — compares server-emitted events against the client `VALID_EVENT_TYPES` allowlist and lists recommended actions.
- Suggested next actions:
  1. Review the reconciliation recommendations and decide which client events to permit (e.g., `subject_selected`, `challenge_completed`).
  2. Add tests that assert `app/api/analytics/event/route.ts` rejects unknown client event types and accepts any newly-added ones.
  3. Implement or schedule the `analyticsAggregator` worker to compute rollups and optionally forward sanitized analytics to a SaaS sink.

---

Document created by automation.
