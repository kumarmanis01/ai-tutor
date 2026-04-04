# Admin Console Implementation — Detailed Changeset

This document summarizes what was implemented for the missing Spinzy Admin systems per the 35-step plan in `admin-console-implementation-plan.md`.

**Implementation date:** March 8, 2026  
**Scope:** Weak Topic Monitoring, Student Learning Analytics, Learning Outcome Analytics, Parent Report Monitoring, Content Readiness Dashboard, Content Quality Monitoring, Admin navigation, and Learning Intelligence dashboards (Recommendation Performance, Learning Funnel, Curriculum Difficulty, Student Risk).

---

## 1. Weak Topic Monitoring

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Admin weak-topic service | **New** | `lib/admin/weakTopicMonitoring.ts` | Read-only service. Uses same weak-topic definition as `lib/learning/getWeakTopics` (mastery < 0.4, practiceCount > 5). Exposes: `getWeakTopicsByTopic(opts)` (aggregate by topic with subject/chapter names, severity, filters board/grade/subjectId), `getWeakTopicsByStudent(opts)` (aggregate by student with topic names, severity), `getWeakTopicsSummary()` (total students with weak topics, total instances). |
| API: weak topics by topic | **New** | `app/api/admin/weak-topics/by-topic/route.ts` | GET; admin-only. Query: board, grade, subjectId, limit. Returns `{ topics }`. |
| API: weak topics by student | **New** | `app/api/admin/weak-topics/by-student/route.ts` | GET; admin-only. Query: board, grade, subjectId, limit. Returns `{ students }`. |
| API: weak topics summary | **New** | `app/api/admin/weak-topics/summary/route.ts` | GET; admin-only. Returns `{ totalStudentsWithWeakTopics, totalWeakTopicInstances }`. |
| Admin UI: weak topics | **New** | `app/admin/weak-topics/page.tsx` | Client page. Summary cards, filters (board, grade, subjectId), view toggle “By topic” / “By student”, tables with severity badges. |

---

## 2. Student Learning Analytics

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Admin student-learning service | **New** | `lib/admin/studentLearningAnalytics.ts` | Read-only. `getStudentLearningSummary()`: total students (role=user), active in last 7d, sessions completed in 7d, homework pending count. `getStudentLearningList(opts)`: paginated students with sessionsCompleted7d, lastActiveAt, homeworkPending, weakTopicCount; filters board, grade. `getStudentDrilldown(studentId)`: profile, activity, recent sessions, weak topics list. |
| API: student-learning summary | **New** | `app/api/admin/student-learning/summary/route.ts` | GET; admin-only. Returns summary counts. |
| API: student-learning list | **New** | `app/api/admin/student-learning/students/route.ts` | GET; admin-only. Query: limit, offset, board, grade. Returns `{ students }`. |
| API: student drilldown | **New** | `app/api/admin/student-learning/students/[studentId]/route.ts` | GET; admin-only. Returns full drilldown or 404. |
| Admin UI: student learning list | **New** | `app/admin/student-learning/page.tsx` | Summary cards, filters, paginated table, link to drilldown per student. |
| Admin UI: student drilldown | **New** | `app/admin/student-learning/[studentId]/page.tsx` | Single-student view: metrics, recent sessions table, weak topics table, back link. |

---

## 3. Learning Outcome Analytics

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Admin learning-outcome service | **New** | `lib/admin/learningOutcomeAnalytics.ts` | Read-only on StudentTopicMastery (and TopicDef for names). `getLearningOutcomeSummary(opts)`: total records, overall avg accuracy, per-subject breakdown with mastery distribution. `getLearningOutcomesBySubject(opts)`: subject rows with studentCount, topicCount, avgAccuracy, beginner/intermediate/advanced/expert counts. `getTopImprovingTopics(opts)`: topics by avg accuracy, with topic names from TopicDef; filters board, grade, subject. |
| API: learning-outcomes summary | **New** | `app/api/admin/learning-outcomes/summary/route.ts` | GET; admin-only. Query: board, grade, subject. Returns summary object. |
| API: learning-outcomes by subject | **New** | `app/api/admin/learning-outcomes/by-subject/route.ts` | GET; admin-only. Query: board, grade, limit. Returns `{ subjects }`. |
| API: top-improving topics | **New** | `app/api/admin/learning-outcomes/top-improving/route.ts` | GET; admin-only. Query: board, grade, subject, limit. Returns `{ topics }`. |
| Admin UI: learning outcomes | **New** | `app/admin/learning-outcomes/page.tsx` | Filters, summary cards, “By subject” table (with mastery counts), “Top topics by accuracy” table. |

---

## 4. Parent Report Monitoring

| Change | Type | Path | Description |
|--------|------|------|-------------|
| AdminConfig model | **New** | `prisma/schema.prisma` | New model `AdminConfig`: id, key (unique), value, updatedAt. Used for `parent_reports_paused` and `content_generation_paused`. |
| Migration: AdminConfig | **New** | `prisma/migrations/20260308120000_add_admin_config/migration.sql` | Creates `AdminConfig` table and unique index on `key`. |
| Parent report monitoring service | **New** | `lib/admin/parentReportMonitoring.ts` | `getParentReportScope()`: students with linked parents (ParentStudent active), reports generated this week (WeeklyStudentSummary). `getParentReportStudents(opts)`: paginated list with lastReportWeekStart, hasReport (this week). `getReportsPaused()` / `setReportsPaused(paused)`: read/write AdminConfig `parent_reports_paused`. |
| API: parent-reporting scope | **New** | `app/api/admin/parent-reporting/scope/route.ts` | GET; admin-only. Returns scope counts. |
| API: parent-reporting students | **New** | `app/api/admin/parent-reporting/students/route.ts` | GET; admin-only. Query: board, grade, limit, offset. Returns `{ students, total }`. |
| API: parent-reporting settings | **New** | `app/api/admin/parent-reporting/settings/route.ts` | GET: returns `{ reportsPaused }`. PATCH: body `{ reportsPaused: boolean }`; updates AdminConfig. Admin-only. |
| Admin UI: parent reporting | **New** | `app/admin/parent-reporting/page.tsx` | Scope cards, “Weekly parent reports” pause/resume button, filters, paginated students table (last report week, report this week). |
| Weekly job: respect pause | **Modified** | `worker/jobs/weeklyParentSummary.ts` | At start of `aggregateWeeklySummaries()`, reads AdminConfig `parent_reports_paused`. If true, logs and returns 0 without processing. |

---

## 5. Content Readiness Dashboard

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Content readiness service | **New** | `lib/admin/contentReadiness.ts` | `getReadinessSummary()`: counts of HydrationJob by status (pending, running, failed, completed). `getReadinessList(opts)`: HydrationJobs with filters (board, grade, subjectId, status), pagination; joins TopicDef for topic/chapter/subject names. `getGenerationPaused()` / `setGenerationPaused(paused)`: AdminConfig `content_generation_paused`. |
| API: content-readiness list | **New** | `app/api/admin/content-readiness/route.ts` | GET; admin-only. Query: board, grade, subjectId, status, limit, offset. Returns `{ items, total }`. |
| API: content-readiness summary | **New** | `app/api/admin/content-readiness/summary/route.ts` | GET; admin-only. Returns summary counts plus `generationPaused`. |
| Admin UI: content readiness | **New** | `app/admin/content-readiness/page.tsx` | Summary cards (pending, running, failed, completed, generation paused), filters, paginated jobs table (topic, subject/chapter, status, contentReady, lastError, updatedAt). |
| Hydrate-all: respect pause | **Modified** | `app/api/admin/content-engine/hydrate-all/route.ts` | At start of POST, reads AdminConfig `content_generation_paused`. If true, returns 503 with `{ error: 'Content generation is paused', paused: true }`. |

---

## 6. Content Quality Monitoring

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Content quality service | **New** | `lib/admin/contentQualityMonitoring.ts` | Read-only on ApprovalAudit and draft counts. `getQualitySummary(opts)`: from ApprovalAudit (optional from/to), approved/rejected counts, byType (approved/rejected per entity type), top rejection reasons. `getPendingSummary()`: total pending and byType (syllabus, chapter, topic, note) from draft counts; oldestPendingAt. `getHistoryForEntity(entityType, entityId)`: ApprovalAudit rows for that entity. |
| API: content-quality summary | **New** | `app/api/admin/content-quality/summary/route.ts` | GET; admin-only. Query: from, to (dates). Returns quality summary. |
| API: content-quality pending | **New** | `app/api/admin/content-quality/pending/route.ts` | GET; admin-only. Returns pending summary. |
| API: content-quality history | **New** | `app/api/admin/content-quality/history/route.ts` | GET; admin-only. Query: entityType, entityId. Returns `{ history }`. |
| Admin UI: content quality | **New** | `app/admin/content-quality/page.tsx` | Summary cards (approved, rejected, total pending, oldest pending), date range filter, “By type” table, pending-by-type strip, top rejection reasons, “Moderation history for entity” form and table. |

---

## 7. Navigation

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Sidebar: Learning & Quality | **Modified** | `components/Admin/AdminSidebar.tsx` | New section “Learning & Quality” with links: Weak Topic Monitoring (`/admin/weak-topics`), Student Learning (`/admin/student-learning`), Learning Outcomes (`/admin/learning-outcomes`), Parent Reporting (`/admin/parent-reporting`), Content Readiness (`/admin/content-readiness`), Content Quality (`/admin/content-quality`). Placed between Content Management and Jobs & Retries. |

---

## 8. Learning Intelligence Dashboards

| Change | Type | Path | Description |
|--------|------|------|-------------|
| Persist home-engine decisions | **Modified** | `lib/homeEngine/recommendationTrace.ts` | When `ENABLE_REC_TRACE=1`, the existing Redis trace write now also appends an analytics fact row to `HomeRecommendationDecision` (fire-and-forget semantics preserved). |
| Prisma model: HomeRecommendationDecision | **New** | `prisma/schema.prisma` | New model for aggregated analytics (ruleId, evaluatedAt, topicId/sessionId, etc). |
| Migration: HomeRecommendationDecision | **New** | `prisma/migrations/20260309120000_add_home_recommendation_decision/migration.sql` | Creates table + indexes + FK to User. |
| Admin service: recommendation performance | **New** | `lib/admin/recommendationPerformanceAnalytics.ts` | Aggregates rule frequency, attribution %, session start/completion rates, and accuracy improvement proxy (testScore - practiceScore) per rule. |
| Admin API: recommendation performance summary | **New** | `app/api/admin/recommendation-performance/summary/route.ts` | GET aggregated performance by date range and attribution window. |
| Admin UI: recommendation performance | **New** | `app/admin/recommendation-performance/page.tsx` | Table view of per-rule metrics with date range + attribution window controls. |
| Admin service: learning funnel | **New** | `lib/admin/learningFunnelAnalytics.ts` | Computes session-stage funnel counts and conversion rates using `StructuredSession.meta` + `SessionEvent` and optional “recommendation computed” proxy. |
| Admin API: learning funnel summary | **New** | `app/api/admin/learning-funnel/summary/route.ts` | GET funnel summary by date range. |
| Admin UI: learning funnel | **New** | `app/admin/learning-funnel/page.tsx` | Funnel table + conversion cards; banner when recommendation top-stage isn’t available. |
| Admin service: curriculum difficulty | **New** | `lib/admin/curriculumDifficultyIntelligence.ts` | Computes difficulty index per topic using avg accuracy, median attempts, weak rate, speed proxy (Postgres percentiles). |
| Admin API: curriculum difficulty topics | **New** | `app/api/admin/curriculum-difficulty/topics/route.ts` | GET topic difficulty list by date range + optional subjectId. |
| Admin UI: curriculum difficulty | **New** | `app/admin/curriculum-difficulty/page.tsx` | Hardest topics table with components and LOW_DATA flag. |
| Admin service: student risk | **New** | `lib/admin/studentRiskDetection.ts` | Computes risk score from inactivity, weak-topic breadth, accuracy trend proxy, and completion rate. |
| Admin API: student risk list | **New** | `app/api/admin/student-risk/students/route.ts` | GET paginated risk list with filters. |
| Admin API: student risk summary | **New** | `app/api/admin/student-risk/summary/route.ts` | GET counts of low/medium/high. |
| Admin UI: student risk | **New** | `app/admin/student-risk/page.tsx` | Risk list table with summary cards and filters. |
| Sidebar: intelligence links | **Modified** | `components/Admin/AdminSidebar.tsx` | Added links for Student Risk, Learning Funnel, Recommendation Performance, Curriculum Difficulty under “Learning & Quality”. |

---

## Summary Table

| System | New Files | Modified Files |
|--------|-----------|----------------|
| Weak Topic Monitoring | 5 (1 lib, 3 API, 1 page) | 0 |
| Student Learning Analytics | 6 (1 lib, 4 API, 2 pages) | 0 |
| Learning Outcome Analytics | 5 (1 lib, 3 API, 1 page) | 0 |
| Parent Report Monitoring | 8 (1 schema, 1 migration, 1 lib, 3 API, 1 page) | 1 (weekly job) |
| Content Readiness | 4 (1 lib, 2 API, 1 page) | 1 (hydrate-all) |
| Content Quality Monitoring | 5 (1 lib, 3 API, 1 page) | 0 |
| Navigation | 0 | 1 (AdminSidebar) |

**Total:** 33 new files, 3 modified files.

---

## Data Sources (unchanged)

- **Weak topics:** `StudentTopicProgress`, `TopicDef`, `ChapterDef`, `SubjectDef`, `User` (board/grade).
- **Student learning:** `User` (role=user), `StructuredSession`, `HomeworkAssignment`, `StudentTopicProgress`, `TopicDef`.
- **Learning outcomes:** `StudentTopicMastery`, `TopicDef`, `User` (board/grade).
- **Parent reporting:** `ParentStudent`, `WeeklyStudentSummary`, `User`, `AdminConfig`.
- **Content readiness:** `HydrationJob`, `TopicDef`, `AdminConfig`.
- **Content quality:** `ApprovalAudit`, `Syllabus`, `ChapterDef`, `TopicDef`, `TopicNote`.

---

## Applying the Migration

Run:

```bash
npx prisma migrate deploy
```

(or `prisma migrate dev` in development) so that the `AdminConfig` table exists. No other schema changes were made.

---

## Session Engine & Recommendation Engine

Per plan: **no changes** to session engine or recommendation rules. All new code is either read-only aggregations or optional gates (pause flags) that do not alter core flows.
