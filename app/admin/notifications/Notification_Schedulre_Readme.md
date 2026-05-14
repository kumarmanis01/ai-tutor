<!--
FILE OBJECTIVE:
- Document the notifications scheduling flow and how to add/trigger scheduled notifications.

LINKED UNIT TEST:
- tests/unit/docs/notifications_scheduler.spec.ts

EDIT LOG:
- 2026-05-14T00:00:00Z | copilot | created README for notification scheduler and added pending diagnostic schedule
-->

# Notification scheduler — Admin guide

This document explains how scheduled notifications work, how to add a new scheduled notification, how admins can view scheduled sends, and how to trigger the "Pending diagnostics" reminder (every Tuesday) manually.

1) How to add a new notification schedule?

- Add a human-friendly entry to [app/admin/notifications/page.tsx](app/admin/notifications/page.tsx) `SCHEDULED` array so the admin UI shows the job name, cadence and status.
- Implement the scheduled job in the workers under `worker/services/` and, if necessary, provide a job definition under `worker/jobs/`. Use the existing pattern:
  - Create a worker service `worker/services/<name>Worker.ts` that computes the target audience and either enqueues outbox rows (`prisma.outbox.create`) or calls delivery helpers.
  - Wire the service into `worker/bootstrap.ts` so it runs on the desired schedule by enqueueing the related job or by adding a scheduler entry (follow existing weeklyDigest and diagnostic auto-submit examples).
  - Create unit tests under `tests/unit/worker/` covering happy/error/edge cases.
  - Add an audit row using `prisma.notificationLog.create(...)` so admin UI can show recent sends.

2) Admin view of scheduled notifications sent

- The admin UI for notifications is at `/admin/notifications` and renders the `SCHEDULED` list (in `page.tsx`) and a Recent sends table backed by `prisma.notificationLog`.
- Each scheduled job should write a `NotificationLog` row with fields: `audience`, `channel`, `title`, `body`, `sentTo`, `status` and `adminId` (or null for automated runs). The recent sends table reads from `prisma.notificationLog` and shows the last 10 sends.

3) Pending diagnostics reminder (new schedule)

- Purpose: remind students who have not yet completed any diagnostic to take the diagnostic test. Cadence: Every Tuesday at 10:00 IST.
- UI: added to `SCHEDULED` in [app/admin/notifications/page.tsx](app/admin/notifications/page.tsx).
- Implementation (manual override currently available): a new admin API route was added at `/api/admin/notifications/trigger-pending-diagnostics` which:
  - Finds students (`User.role = 'user'`) who do not have a `DiagnosticSession` with `status = COMPLETED`.
  - Sends a push notification (and an email when an email is available) using existing `sendPushSafe`/`sendMailSafe` helpers.
  - Writes a `NotificationLog` audit row for visibility in the admin UI.

4) Manual override — send scheduled notification now

- Admins can trigger the pending diagnostics reminder immediately using either:
  - The button in the Admin composer: open `/admin/notifications` and click "Run pending diagnostics now" in the Broadcast composer (this calls the new API route).
  - Or call the API directly (authenticated admin session):

```
POST /api/admin/notifications/trigger-pending-diagnostics
```

Response: `{ ok: true, sentTo: <number> }`

Notes & next steps
- Scheduling for automatic weekly runs should be added in the worker scheduler (e.g. add a job that runs every Tuesday and calls the same service used by the API). For safety and auditability prefer creating outbox rows that are dispatched by `outboxdispatcher` at the appropriate `meta.deliverAt` instant.
- Ensure the worker job respects opt-outs and notification policy checks (`lib/notifications/policy.ts`) for parent-facing notifications. For student-facing push/email sends the policy may differ — please consult `lib/notifications/*` and the worker examples (e.g. `weeklyDigestWorker.ts`) for patterns.
- If you want the scheduled run to use WhatsApp templates, implement template sending via `lib/whatsapp/sender` and ensure template approval/locale handling.

If you'd like, I can add the worker-side scheduled job (run every Tuesday) that reuses the same logic as the manual endpoint and enqueues outbox rows for gradual dispatch. Should I proceed with that? 
