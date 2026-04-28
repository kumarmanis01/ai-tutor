# SPINZY ADMIN SYSTEM AUDIT

**Audit scope:** Admin capabilities in the Spinzy codebase.  
**Reference:** Admin navigation is defined in `components/Admin/AdminSidebar.tsx`.  
**Rules:** Audit only; no proposals or code changes.

---

## SECTION 1 — Admin Authentication

**Status:** EXISTS

**Files:**

- `app/admin/layout.tsx` — Server-side check: `getServerSessionForHandlers()`; if no session or `session.user.role !== 'admin'`, calls `notFound()`. All `/admin/*` routes are protected at layout level.
- `lib/auth.ts` — `requireAdmin()` (throws if not admin); `requireAdminOrModerator()` (allows `admin` or `moderator`). Used by many admin API routes.
- `auth/adminGuard.ts` — `requireAdmin(session)` (checks `session.user.role !== 'ADMIN'`; note uppercase in this file). Used by some admin suggestion routes.
- Admin API routes — Most use either inline `session.user.role !== 'admin'` or `requireAdminOrModerator()` / `requireAdmin()` from `@/lib/auth`.

**Explanation:** Access to `/admin` is gated by the root admin layout (session + role check). Individual admin APIs enforce role again (defense-in-depth). Two role checks exist: `lib/auth` uses `'admin'` (lowercase); `auth/adminGuard.ts` uses `'ADMIN'` (uppercase). User table and session typically use lowercase `role`; layout and most APIs use lowercase.

---

## SECTION 2 — Curriculum Management

**Status:** EXISTS

**Files:**

- **UI pages:** `app/admin/boards/page.tsx`, `app/admin/classes/page.tsx`, `app/admin/subjects/page.tsx`, `app/admin/syllabus/page.tsx`, `app/admin/syllabi/page.tsx`, `app/admin/courses/page.tsx`, `app/admin/courses/[syllabusId]/page.tsx`, `app/admin/courses/[syllabusId]/[version]/page.tsx`, `app/admin/chapters/page.tsx`, `app/admin/topics/page.tsx`.
- **UI components:** `app/admin/components/BoardsClient.tsx`, `app/admin/components/ClassesClient.tsx`, `app/admin/components/SubjectsClient.tsx`, `app/admin/components/ChaptersClient.tsx`, `app/admin/topics/TopicsClient.tsx` — Each lists entities and supports approve/reject or moderation actions where applicable.
- **APIs:** `app/api/admin/syllabi/route.ts`, `app/api/admin/syllabus/[id]/approve/route.ts`, `app/api/admin/chapters/[id]/approve/route.ts`, `app/api/admin/chapters/[id]/reject/route.ts`, `app/api/admin/topics/[id]/approve/route.ts`, `app/api/admin/topics/pause/route.ts`, `app/api/admin/topics/resume/route.ts`.
- **Database models:** Curriculum hierarchy (Board, Class, SubjectDef, ChapterDef, TopicDef, Syllabus, etc.) in `prisma/schema.prisma`.

**Explanation:** Curriculum is managed via dedicated admin pages for boards, classes, subjects, syllabus, courses, chapters, and topics. Not all of these appear in AdminSidebar (e.g. Boards, Classes, Subjects, Syllabus, Catalog do; chapters and topics may be reached via syllabus/courses or direct routes). Pages use client components that fetch admin APIs and show approve/reject/moderation actions where relevant.

---

## SECTION 3 — Topic/App Generation

**Status:** EXISTS

**Files:**

- **UI pages:** `app/admin/content-engine/control-panel/page.tsx` (AI Generation), `app/admin/content-engine/hydrateAll/page.tsx`, `app/admin/content-engine/hydrate-all/page.tsx`, `app/admin/regeneration-jobs/page.tsx`, `app/admin/regeneration-jobs/[id]/page.tsx`, `app/admin/syllabus/page.tsx` (per-topic Generate button), `app/admin/catalog/page.tsx`, `app/admin/content-central/page.tsx`.
- **UI components:** `app/admin/content-engine/hydrateAll/components/TriggerForm.tsx`, `app/admin/content-engine/hydrateAll/components/ProgressDashboard.tsx`, `app/admin/content-engine/hydrateAll/components/JobsTable.tsx`.
- **APIs:** `app/api/admin/content-engine/hydrate-all/route.ts`, `app/api/admin/hydrateAll/route.ts`, `app/api/admin/hydrateAll/[jobId]/route.ts`, `app/api/admin/hydrateAll/[jobId]/retry/route.ts`, `app/api/admin/content-engine/jobs/route.ts`, `app/api/admin/content-engine/jobs/[id]/route.ts`, `app/api/admin/content-engine/jobs/[id]/[action]/route.ts`, `app/api/admin/regeneration-jobs/route.ts`, `app/api/admin/regeneration-jobs/[id]/trigger/route.ts`, `app/api/admin/topics/[id]/generate/route.ts`, `app/api/admin/catalog/seed/route.ts`, `app/api/admin/catalog/parse-image/route.ts`, `app/api/admin/catalog/parse-pdf/route.ts`.

**Explanation:** Topic and content generation is covered by (1) AI Generation / Control Panel, (2) Hydrate All pipeline (trigger and monitor), (3) Regeneration jobs (legacy), (4) per-topic Generate on syllabus page, (5) Content Catalog and Content Central. Execution jobs (content engine) are listed and can be retried/requeued/cancelled via admin APIs and job detail pages.

---

## SECTION 4 — AI Content Moderation

**Status:** EXISTS

**Files:**

- **UI pages:** `app/admin/content-approval/page.tsx` (unified “Content Review” — syllabus, chapters, topics, notes, tests), `app/admin/content-engine/moderation/page.tsx` (deprecated; redirects to content-approval), `app/admin/content-engine/moderation/[contentId]/page.tsx` (per-content moderation with approve/reject actions).
- **APIs:** `app/api/admin/content-approval/route.ts` (list pending), `app/api/admin/content-approval/[type]/[id]/route.ts` (approve/reject by type and id), `app/api/admin/content-engine/moderation/route.ts`, `app/api/admin/content-engine/moderation/[id]/route.ts`, `app/api/admin/content-engine/moderation/[id]/[action]/route.ts`, `app/api/admin/content/approve/route.ts`. Notes/tests: `app/api/admin/notes/[id]/approve.ts`, `app/api/admin/notes/[id]/reject.ts`, `app/api/admin/tests/[id]/approve.ts`, `app/api/admin/tests/[id]/reject.ts`.

**Explanation:** A unified Content Review (Content Approval) page lists all pending AI-generated content by type and supports approve/reject with optional detail modal. The old content-engine moderation page redirects to Content Review. Per-item moderation is also available via content-engine/moderation/[contentId]. Moderation actions are backed by admin-only APIs that update content status and write audit logs.

---

## SECTION 5 — Student Analytics

**Status:** PARTIAL

**Files:**

- **UI pages:** `app/admin/users/page.tsx` (user list with role/status; not learning analytics), `app/admin/charts/users/page.tsx`, `app/admin/charts/api-usage/page.tsx`, `app/admin/analytics/course/[courseId]/page.tsx` (course-level views, completions, funnel), `app/admin/api-usage/page.tsx`.
- **APIs:** `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/charts/users/route.ts`, `app/api/admin/charts/api-usage/route.ts`, `app/api/admin/analytics/course/[courseId]/route.ts`, `app/api/admin/analytics/signals/route.ts`, `app/api/admin/api-usage/route.ts`.
- **Database models:** `AnalyticsDailyAggregate`, `AnalyticsSignal` (and related analytics tables) used by analytics/course and analytics/signals.

**Explanation:** Admin has user management (list, edit role/status), API usage and chart views, and course-level analytics (views, completions, funnel, drop-off approximation). There is no dedicated “student analytics” dashboard (e.g. per-student learning progress, mastery, or engagement). Analytics are course-centric and signals-based; student-level learning analytics are not surfaced as a dedicated admin capability.

---

## SECTION 6 — Recommendation Engine Monitoring

**Status:** EXISTS

**Files:**

- **UI pages:** `app/admin/recommendations/page.tsx` — “Recommendation Traces” page; fetches traces, displays table with timestamp, student, type, entity, score, signals, version; includes SignalsSummary/SignalsDetail.
- **APIs:** `app/api/admin/recommendation-trace/route.ts` (GET by studentId; reads RecommendationTrace from Redis; admin-only), `app/api/admin/recommendations/traces/route.ts` (used by recommendations page for list), `app/api/admin/recommendations/seed/route.ts` (admin seed).
- **Backend:** `lib/homeEngine/recommendationTrace.ts` (trace schema); traces written by getNextAction when `ENABLE_RECOMMENDATION_TRACE` is set; TTL in Redis.

**Explanation:** Admin can view recommendation traces per student (and list traces) to debug why a student received a given recommendation. Trace includes rules evaluated, matched rule, final decision, and optional topic scoring breakdown. Not linked from AdminSidebar; reachable via direct route or admin home quick links if added. Recommendation-trace API requires `studentId`; traces page uses recommendations/traces API for the list.

---

## SECTION 7 — Weak Topic Monitoring

**Status:** NOT FOUND

**Files:** None in `app/admin` or `app/api/admin` that reference weak topics, weak topic lists, or StudentTopicProgress/StudentTopicMastery for an admin “weak topic” view.

**Explanation:** Weak topic logic exists in the product (getWeakTopics, WeakTopicsSection on student dashboard, P2 weak_topic_urgent). There is no admin UI or admin API to monitor weak topics across students (e.g. list of students with weak topics, or topic-level weak counts). No AdminSidebar entry and no admin service/route for weak topic monitoring.

---

## SECTION 8 — Parent Reporting Control

**Status:** NOT FOUND

**Files:** No admin pages or admin APIs under `app/admin` or `app/api/admin` that control parent reports, toggle parent report generation, or manage weekly/monthly parent report settings. Parent-facing features live in `app/api/parent/*`, `app/(student)/parent/*`, and `worker/jobs/weeklyParentSummary.ts`.

**Explanation:** Parent dashboard and weekly aggregation exist; there is no admin control surface to enable/disable parent reports, configure report frequency, or manage which parents receive reports. No AdminSidebar entry for parent reporting control.

---

## SECTION 9 — Learning Outcome Analytics

**Status:** NOT FOUND

**Files:** No admin pages or admin APIs that expose “learning outcome analytics” (e.g. baseline accuracy, accuracy change, mastery improvement, or learning-outcome dashboards). `services/motivation` and product-layer learning-outcome design exist elsewhere; they are not wired into admin.

**Explanation:** Admin has course-level analytics and analytics signals, but no dedicated learning-outcome metrics (improvement over time, mastery deltas, or outcome-focused reports) in the admin UI or admin API surface.

---

## SECTION 10 — Content Quality Monitoring

**Status:** PARTIAL

**Files:**

- **UI:** `app/admin/content-approval/page.tsx` (unified content review — quality is implied by approve/reject workflow), `app/admin/content-central/page.tsx`, `app/admin/content-engine/rollbacks/page.tsx`. Suggestion flows: `app/api/admin/suggestions/route.ts`, `app/api/admin/suggestions/[id]/accept/route.ts`, `app/api/admin/suggestions/[id]/dismiss/route.ts` (no dedicated admin suggestions page found in sidebar).
- **Database/models:** Content status, approval state, and rollback-related data in Prisma schema.

**Explanation:** Content quality is addressed indirectly through (1) Content Review (approve/reject pending content), (2) Content Central, and (3) Rollbacks. There is no dedicated “content quality monitoring” dashboard (e.g. quality scores, rejection rates, or automated quality checks). Docs mention “No content quality validation system” in HYDRATEALL; quality is human review and rollback, not a continuous monitoring product.

---

## SECTION 11 — System Health Monitoring

**Status:** EXISTS

**Files:**

- **UI pages:** `app/admin/system/metrics/page.tsx` (telemetry charts — queue depth, workers, jobs, alerts), `app/admin/system/alerts/page.tsx` (active/resolved alerts table), `app/admin/content-engine/workers/page.tsx`, `app/admin/content-engine/queue/page.tsx`, `app/admin/content-engine/redis/page.tsx`, `app/admin/workers/page.tsx` (legacy workers list).
- **APIs:** `app/api/admin/system/metrics/route.ts`, `app/api/admin/system/telemetry/route.ts`, `app/api/admin/system/alerts/route.ts`, `app/api/admin/content-engine/workers/route.ts`, `app/api/admin/content-engine/queue/route.ts`, `app/api/admin/content-engine/redis/route.ts`, `app/api/admin/content-engine/status/route.ts`, `app/api/admin/workers/route.ts`, `app/api/admin/jobs/status/route.ts`, `app/api/admin/orchestrator/status/route.ts`.
- **Components:** `components/Admin/TelemetryView.tsx` (used on metrics page).

**Explanation:** Admin has a System Monitoring section in the sidebar: Workers, Queue, Redis, System Metrics, System Alerts, and Engine Audit Logs. Metrics page uses telemetry API with keys such as queue depth, worker counts, job counts, and alerts. Alerts page lists alert type, severity, message, active state, and timestamps. Content-engine status and orchestrator status are available via API. No separate “health” dashboard; health is inferred from metrics and alerts.

---

## SECTION 12 — Admin Activity Logs

**Status:** EXISTS

**Files:**

- **UI pages:** `app/admin/audit-logs/page.tsx` (“Platform Audit Logs” — table of audit logs with user, action, details, time), `app/admin/content-engine/audit-logs/page.tsx` (“Engine Audit Logs” — content engine execution and job events).
- **APIs:** `app/api/admin/audit-logs/route.ts` (GET; returns last 100 AuditLog with user; admin-only), `app/api/admin/content-engine/audit-logs/route.ts` (GET; returns filtered AuditLog entries for approve/reject/job/worker/cancel/retry/requeue; transformed for UI).
- **Database models:** `AuditLog` (id, userId, action, details, createdAt, user relation) in `prisma/schema.prisma`. Both platform and engine audit logs read from the same AuditLog table; engine route filters by action patterns.
- **Components:** `components/AuditTrailViewer.tsx` (used on platform audit-logs page), `components/Admin/AdminSidebar.tsx` (lists “Platform Audit Logs” and “Engine Audit Logs”).

**Explanation:** Two audit log surfaces: (1) Platform Audit Logs — all recent audit log rows for general admin activity; (2) Engine Audit Logs — same table filtered to content-engine-related actions (approve, reject, job, worker, cancel, retry, requeue). Both are admin-only and listed in AdminSidebar under “General Admin” and “System Monitoring” respectively.

---

## Summary Table

| Section                             | Status    | Notes                                                                             |
| ----------------------------------- | --------- | --------------------------------------------------------------------------------- |
| 1. Admin Authentication             | EXISTS    | Layout + API role checks; `requireAdmin` / `requireAdminOrModerator`              |
| 2. Curriculum Management            | EXISTS    | Boards, classes, subjects, syllabus, courses, chapters, topics pages and APIs     |
| 3. Topic/App Generation             | EXISTS    | Control panel, Hydrate All, regeneration jobs, topic generate, catalog            |
| 4. AI Content Moderation            | EXISTS    | Unified Content Review + content-engine moderation APIs                           |
| 5. Student Analytics                | PARTIAL   | User list, charts, API usage, course analytics; no per-student learning analytics |
| 6. Recommendation Engine Monitoring | EXISTS    | Recommendation traces page and recommendation-trace/traces APIs                   |
| 7. Weak Topic Monitoring            | NOT FOUND | No admin UI or API for weak topics                                                |
| 8. Parent Reporting Control         | NOT FOUND | No admin control for parent reports                                               |
| 9. Learning Outcome Analytics       | NOT FOUND | No admin learning-outcome analytics                                               |
| 10. Content Quality Monitoring      | PARTIAL   | Content review and rollbacks; no quality dashboard or automated metrics           |
| 11. System Health Monitoring        | EXISTS    | Metrics, alerts, workers, queue, Redis, status APIs                               |
| 12. Admin Activity Logs             | EXISTS    | Platform and Engine audit logs (same AuditLog table)                              |

---

_End of audit. No changes proposed._
