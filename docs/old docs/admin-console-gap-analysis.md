# Admin Console Gap Analysis — Production Readiness

**Based on:** Spinzy Admin System Audit  
**Focus:** What is missing for a production-ready Admin Console in each area.  
**Output:** Current system, missing capabilities, and minimum required admin tools per area.

---

## SECTION 1 — Curriculum Management

**Current System**

- Admin pages exist for the full hierarchy: Boards, Classes, Subjects, Syllabus, Syllabi, Courses (with versioned syllabus), Chapters, Topics.
- Client components (BoardsClient, ClassesClient, SubjectsClient, ChaptersClient, TopicsClient) list entities and support approve/reject or moderation actions where content is AI-generated.
- APIs: syllabi list, syllabus approve, chapters approve/reject, topics approve/pause/resume. Curriculum data lives in Prisma (Board, Class, SubjectDef, ChapterDef, TopicDef, etc.).
- Not all curriculum pages are consistently exposed in AdminSidebar (e.g. Chapters and Topics may require direct URLs or navigation from syllabus/courses).

**Missing Capabilities**

- Single curriculum “tree” or map view (board → grade → subject → chapter → topic) for quick navigation and coverage visibility.
- Bulk operations (e.g. approve/reject by chapter or subject, reorder topics).
- Lifecycle/status visibility (e.g. draft vs approved vs published) across the tree.
- Validation or consistency checks (e.g. orphan topics, missing prerequisites, duplicate orders).
- Clear entry point and breadcrumbs so admins can reliably reach every level from the sidebar.

**Minimum Required Admin Tools**

- One curriculum overview page (tree or list by board/grade/subject) with links to each level, plus status/lifecycle indicators.
- Ensure Boards, Classes, Subjects, Syllabus, Courses, Chapters, and Topics are all reachable from AdminSidebar (or one “Curriculum” hub that links to them).
- At least one bulk action (e.g. “Approve all pending in this chapter”) to reduce repetitive single-item approval.
- Optional: read-only validation report (e.g. topics without notes, chapters with no topics) so ops can fix data before students see it.

---

## SECTION 2 — AI Content Generation

**Current System**

- AI Generation (control panel), Hydrate All (trigger + pipeline monitor), Regeneration jobs (legacy), per-topic Generate on syllabus page, Content Catalog, Content Central.
- Execution jobs: list, filter, view detail, Retry/Requeue/Cancel via content-engine jobs APIs and job detail pages. Hydrate All has TriggerForm, ProgressDashboard, JobsTable; failed child jobs can be retried from Monitor.
- APIs for hydrate-all, hydrateAll (with jobId and retry), content-engine jobs (list, by-id, actions), regeneration-jobs (list, trigger), topics/[id]/generate, catalog seed/parse.

**Missing Capabilities**

- Rate or concurrency limits for generation (e.g. max concurrent jobs per type) to avoid overload.
- Clear “generation status” by curriculum unit (e.g. which topics/chapters have pending, running, or failed generation) without opening each job.
- Feature-flag or kill-switch to pause all new generation (e.g. during incident or model change).
- Cost or token-usage visibility per job or per run (if applicable).
- Distinction between “trigger new” vs “retry failed” in the UI so admins don’t accidentally duplicate work.

**Minimum Required Admin Tools**

- One “Generation status” or “Content readiness” view: by board/grade/subject (or by topic) show pending/running/failed/completed counts (or list of entities with status), with links to relevant jobs.
- Ability to pause new generation (e.g. env flag or admin toggle that blocks new Hydrate All / topic generate triggers); resume when ready.
- Job list filters and labels (e.g. “Hydrate All” vs “Single topic” vs “Regeneration”) so admins can quickly find and retry the right jobs.
- Optional: simple rate or concurrency cap (e.g. max N jobs of type X) to protect the system under load.

---

## SECTION 3 — AI Moderation

**Current System**

- Unified Content Review (content-approval) page: lists pending content by type (syllabus, chapter, topic, note, test); approve/reject with optional detail modal.
- Content-engine moderation: deprecated page redirects to Content Review; per-content moderation at content-engine/moderation/[contentId] with approve/reject. APIs for content-approval (list, approve/reject by type/id), content-engine moderation (list, by-id, action), and notes/tests approve/reject. Actions write to audit logs.

**Missing Capabilities**

- Queue depth or SLA view: how many items are pending review and how long they have been waiting (e.g. “> 24h”).
- Rejection reasons or categories (e.g. quality, safety, wrong topic) for reporting and model improvement.
- Moderation history per content item (who approved/rejected when, with optional comment) visible in admin.
- Assignee or “claimed by” so multiple moderators don’t double-review; optional priority or due date.
- Export or report of moderation activity (e.g. weekly approval/rejection counts by type) for compliance or product review.

**Minimum Required Admin Tools**

- Pending queue view with age (e.g. “Pending &gt; 24h”) and optional sort by oldest first so nothing stalls.
- When rejecting, require or encourage a reason/category (stored with audit log or content metadata) and show it in moderation history.
- Moderation history per item (list of actions: approved/rejected, by whom, when, reason if any) on the content detail or Content Review modal.
- Optional: simple report (e.g. last 7 days approved/rejected by type) on a single admin page or export.

---

## SECTION 4 — Student Learning Analytics

**Current System**

- User management: list users, edit role/status (admin/users). Charts: users chart, API usage chart (admin/charts/users, admin/charts/api-usage). Course-level analytics: views, completions, funnel, drop-off approximation (admin/analytics/course/[courseId]). Analytics signals API (admin/analytics/signals). API usage list (admin/api-usage). Data: AnalyticsDailyAggregate, AnalyticsSignal, ApiUsage.

**Missing Capabilities**

- Per-student learning view: progress along curriculum (e.g. topics/chapters completed), session count, time-on-platform, or last active.
- Student-level mastery or accuracy (e.g. from StudentTopicMastery / StudentTopicProgress) in admin.
- Segmentation or filters (e.g. by board, grade, signup date, or “at-risk”: no session in 7 days).
- Export (CSV/Excel) of student list with key learning metrics for school or ops use.
- No single “Student learning” dashboard that answers “how are students doing?” without drilling into a specific course.

**Minimum Required Admin Tools**

- One “Student learning” or “Learners” admin page: list students with at least minimal learning metrics (e.g. sessions count, last active, topics completed or mastery summary). Click-through to a per-student learning summary (topics studied, weak topics if available, recent activity).
- Filters: by board, grade, and optionally “last active &gt; N days” or “no session in 7 days.”
- Read-only use of existing data (StudentTopicProgress, StudentTopicMastery, StructuredSession, or equivalent); no new engine logic required for a first version.
- Optional: CSV export of student list + key metrics (e.g. email, board, grade, sessions, last active) for reporting.

---

## SECTION 5 — Recommendation Engine Monitoring

**Current System**

- Recommendation Traces page: fetches traces (recommendations/traces API), shows table (timestamp, student, type, entity, score, signals, version) with SignalsSummary/SignalsDetail. recommendation-trace API: GET by studentId, reads RecommendationTrace from Redis (admin-only). Traces written by getNextAction when ENABLE_RECOMMENDATION_TRACE is set; TTL in Redis. Seed API for recommendations. Traces page is not linked in AdminSidebar.

**Missing Capabilities**

- Recommendation Traces discoverable from AdminSidebar (or Admin home) so support/ops can debug “why did this student get this topic?” without knowing the URL.
- Search or filter traces by student (email or id), date range, or rule matched (e.g. “all P2 weak_topic_urgent in last 24h”).
- Sample or aggregate view: e.g. distribution of rules fired (P0–P6) over last 24h to spot engine drift or one rule dominating.
- Clear note when ENABLE_RECOMMENDATION_TRACE is off (e.g. on the traces page) so admins know why no data appears.
- Optional: “Simulate recommendation” for a student (call getNextAction and show result) for support without changing production state.

**Minimum Required Admin Tools**

- Add “Recommendation Traces” (or “Recommendation debugging”) to AdminSidebar under a logical section (e.g. “Learning” or “Debug”).
- Traces page: student picker or search (by email/id), optional date filter; display latest trace(s) for that student with full rule list and final decision.
- Optional: “Trace status” banner on the page when ENABLE_RECOMMENDATION_TRACE is false (e.g. “Tracing is disabled; enable to see traces”).
- Optional: simple aggregate (e.g. “Last 24h: P0=…, P1=…, P2=…” counts) so product can monitor rule distribution.

---

## SECTION 6 — Weak Topic Monitoring

**Current System**

- None in admin. Weak topic logic exists in product only: getWeakTopics (StudentTopicProgress/mastery), WeakTopicsSection on student dashboard, P2 weak_topic_urgent in getNextAction. No admin UI or API to view weak topics across students or by topic.

**Missing Capabilities**

- List of students who have one or more weak topics (with count or list of topics).
- Topic-level view: which topics are “weak” for the most students (e.g. topic name, count of students with that topic weak); useful for curriculum or content fixes.
- Ability to see weak topic definition (e.g. mastery &lt; 0.4 and practiceCount &gt; 5) in one place in admin for consistency with product.
- Optional: export (e.g. CSV) of student–weak-topic pairs for school or content teams.

**Minimum Required Admin Tools**

- One read-only admin page “Weak topic monitoring”: data from existing getWeakTopics (or equivalent read from StudentTopicProgress/StudentTopicMastery).
  - Tab or section “By student”: list students with at least one weak topic; expand or link to list of weak topics per student.
  - Tab or section “By topic”: list topics with count of students who have that topic as weak; sort by count descending.
- Admin API (GET) that returns either (1) students with weak topics and their weak topic ids/names, or (2) topic-level counts. No new tables required if data is derived from existing progress/mastery tables.
- Optional: CSV export “students with weak topics” (student id/email, topic names) for external reporting.

---

## SECTION 7 — Parent Reporting Control

**Current System**

- None in admin. Parent-facing: parent dashboard API, parent progress, weekly activity; student/parent pages; weekly aggregation job (weeklyParentSummary) that writes WeeklyStudentSummary and refreshes subject/attention/readiness. No admin UI or API to control who gets reports, frequency, or toggles.

**Missing Capabilities**

- Visibility: which students have linked parents and whether they are in scope for weekly report (e.g. “students with linked parents” count or list).
- Toggle or flag to disable report generation for a student (e.g. opt-out) or globally (e.g. “pause weekly reports” during incident).
- Control of report frequency (e.g. weekly vs monthly) if product supports it; otherwise at least “on/off” for weekly.
- View of last report generated (e.g. week ending, or “last run at”) per student or globally so support can confirm reports ran.
- No need for admin to edit report content; only control of whether/when it runs and for whom.

**Minimum Required Admin Tools**

- One “Parent reporting” admin page (read-only at minimum): list or count of students with linked parents; optional “last weekly summary date” or “last run” per student or for the job.
- Ability to disable weekly report generation (e.g. feature flag or admin toggle) so reports can be paused without code deploy. Re-enable when ready.
- Optional: per-student “exclude from parent reports” flag (e.g. on User or ParentStudent) so one family can opt out without affecting others.
- No change to report content or AI; only control of execution and scope.

---

## SECTION 8 — Learning Outcome Analytics

**Current System**

- None in admin. Product-side: motivation service accepts accuracyTrend; learning-outcome design and LearningOutcomeService exist in product-layer docs but are not exposed in admin. Course-level analytics and analytics signals exist in admin but are not learning-outcome focused (no baseline accuracy, improvement, or mastery deltas).

**Missing Capabilities**

- Aggregate learning-outcome metrics in admin: e.g. average accuracy or mastery by subject/grade/board; proportion of students “improved” vs “stable” vs “needs practice” if that classification exists.
- Time trend: e.g. weekly or monthly rollup of “improvement rate” or “mastery gain” so product can measure impact of changes.
- Drill-down: by board, grade, or subject to see which segments are improving or stuck.
- No requirement for real-time per-student view in admin; aggregate and trend are enough for production readiness of an “outcome analytics” surface.

**Minimum Required Admin Tools**

- One “Learning outcomes” (or “Outcome analytics”) admin page that consumes existing or new read-only outcome metrics (e.g. from LearningOutcomeService or from StudentTopicMastery/StudentTopicProgress aggregates).
  - Show at least: current-period aggregate (e.g. average accuracy or mastery by subject/grade), and optional “trend” (e.g. vs previous period or simple improved/stable/declined share).
  - Filters: board, grade, subject, date range.
- Admin API (GET) that returns aggregated outcome metrics (no PII); used by the page. Implementation can be a thin read-only layer over existing progress/mastery data.
- Optional: export (CSV) of aggregated outcomes by segment (e.g. by subject and week) for reporting or school use.
- If product does not yet compute “improvement” or “trend,” minimum is “current snapshot” (e.g. average mastery/accuracy by segment); trend can be added when the product layer supports it.

---

## SECTION 9 — System Monitoring

**Current System**

- System Monitoring section in sidebar: Workers, Queue, Redis, System Metrics, System Alerts, Engine Audit Logs. Pages: system/metrics (telemetry charts: queue depth, workers, jobs, alerts), system/alerts (table: type, severity, message, active, first/last seen), content-engine/workers, content-engine/queue, content-engine/redis, workers (legacy). APIs: system/metrics, system/telemetry, system/alerts, content-engine workers/queue/redis/status, workers, jobs/status, orchestrator/status. TelemetryView component used on metrics page.

**Missing Capabilities**

- Single “Health” or “Status” dashboard: one page that shows red/amber/green (or equivalent) for critical components (e.g. queue depth, worker availability, Redis, job failure rate, orchestrator) so ops can see overall health at a glance.
- Alerting integration: ensure critical alerts (e.g. queue backed up, workers down, spike in failed jobs) can trigger notifications (e.g. email, Slack) when alerts are created or updated; admin UI can remain the place to view and acknowledge.
- Retention of metrics and alerts: telemetry and alerts may be in-memory or short-TTL; for production, consider retention (e.g. 7–30 days) for post-incident review.
- Runbook or “what to do” hints next to key metrics (e.g. “If queue depth &gt; X, check workers and Redis”) so new ops can act without deep context.

**Minimum Required Admin Tools**

- One “System health” or “Status” dashboard page that aggregates existing APIs: show key metrics (queue depth, worker count, failed jobs in last 24h, Redis connectivity, orchestrator status) with simple status indicators (e.g. green/amber/red) and thresholds where they exist. Link to existing Workers, Queue, Redis, Alerts, and Engine Audit Logs for detail.
- Ensure System Alerts are visible and that “active” vs “resolved” is clear; optional: “Acknowledge” or “Snooze” so ops can track which alerts have been seen.
- Document or link runbook for common failures (e.g. “Queue backing up” → check workers and Redis; “High failed jobs” → open Execution Jobs, filter failed, retry or investigate). Can be a static doc or small “Help” section on the health page.
- Optional: persist telemetry or alerts for at least 7 days (e.g. in DB or log store) so incidents can be reviewed later; if not in scope, at least document current retention so ops know what to expect.

---

## Summary

| Area                          | Current                                 | Gap focus                                      | Minimum admin tools                                                                           |
| ----------------------------- | --------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Curriculum                 | Full hierarchy + approve/reject         | Tree view, bulk actions, visibility in sidebar | Curriculum overview, sidebar links, one bulk action, optional validation report               |
| 2. AI Content Generation      | Control panel, Hydrate All, jobs, retry | Status by entity, pause, rate/limits           | Generation status view, pause toggle, clear job filters                                       |
| 3. AI Moderation              | Content Review, per-item moderation     | Queue age, rejection reasons, history          | Pending queue with age, reject reason + history, optional report                              |
| 4. Student Learning Analytics | Users, charts, course analytics         | Per-student learning, segments, export         | Student learning page + per-student summary, filters, optional export                         |
| 5. Recommendation Monitoring  | Traces page + API by studentId          | Discoverability, filters, trace status         | Sidebar link, student search/date filter, trace-off banner, optional aggregates               |
| 6. Weak Topic Monitoring      | None                                    | Full gap                                       | Read-only page: by student + by topic; admin API; optional export                             |
| 7. Parent Reporting Control   | None                                    | Full gap                                       | Parent reporting page (who’s in scope, last run), global pause, optional per-student opt-out  |
| 8. Learning Outcome Analytics | None                                    | Full gap                                       | Outcome analytics page + API (aggregates/trend); optional export                              |
| 9. System Monitoring          | Metrics, alerts, workers, queue, Redis  | Health dashboard, alerting, retention          | Health/status page with status indicators, alert visibility, runbook link, optional retention |

---

_End of gap analysis. No code or architecture changes proposed; only minimum required admin tools to reach production-ready console in each area._
