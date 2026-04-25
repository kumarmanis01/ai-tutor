# Spinzy Admin Console — Safe Step-by-Step Implementation Plan

**Rules:** One file per step. No refactor of existing systems. Session engine not modified. No code generated in this document.

**Systems:** Weak Topic Monitoring, Student Learning Analytics, Learning Outcome Analytics, Parent Report Monitoring, Content Readiness Dashboard, Content Quality Monitoring.

---

## Weak Topic Monitoring

**STEP 1**  
**File to create:** `lib/admin/weakTopicMonitoring.ts`  
**Purpose:** Admin read-only service for weak topic aggregation.  
**Description:** Create the file. Implement functions: `getWeakTopicsByTopic(opts)` (aggregate StudentTopicProgress with mastery < 0.4 and practiceCount > 5, group by topicId, join TopicDef/chapter/subject for names; return list with studentCount, severity); `getWeakTopicsByStudent(opts)` (same filter, group by studentId, join User for board/grade/email; return list with weakTopicCount, topicIds/names); `getWeakTopicsSummary()` (total students with ≥1 weak topic, total weak-topic instances). Use same thresholds as `lib/learning/getWeakTopics.ts` (import or duplicate constants). No writes; Prisma read-only.

**STEP 2**  
**File to create:** `app/api/admin/weak-topics/by-topic/route.ts`  
**Purpose:** Admin API for weak topics by topic.  
**Description:** Create GET handler. Enforce admin (session.role === 'admin'). Parse query params: board?, grade?, subjectId?, limit?. Call weakTopicMonitoring.getWeakTopicsByTopic(). Return JSON { topics: [...] }. No changes to existing files.

**STEP 3**  
**File to create:** `app/api/admin/weak-topics/by-student/route.ts`  
**Purpose:** Admin API for weak topics by student.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, subjectId?, limit?. Call weakTopicMonitoring.getWeakTopicsByStudent(). Return JSON { students: [...] }.

**STEP 4**  
**File to create:** `app/api/admin/weak-topics/summary/route.ts`  
**Purpose:** Admin API for weak-topic summary (dashboard card).  
**Description:** Create GET handler. Enforce admin. Call weakTopicMonitoring.getWeakTopicsSummary(). Return JSON { totalStudentsWithWeakTopics, totalWeakTopicInstances }.

**STEP 5**  
**File to create:** `app/admin/weak-topics/page.tsx`  
**Purpose:** Admin UI for weak topic monitoring.  
**Description:** Create client or server page. Two views (tabs or toggles): “By topic” (table from GET /api/admin/weak-topics/by-topic) and “By student” (table from GET /api/admin/weak-topics/by-student). Display summary from GET /api/admin/weak-topics/summary. Add filters (board, grade, subject) and sort. No changes to existing admin pages.

---

## Student Learning Analytics

**STEP 6**  
**File to create:** `lib/admin/studentLearningAnalytics.ts`  
**Purpose:** Admin read-only service for student learning metrics.  
**Description:** Create the file. Implement: `getSummary()` (total students, active in last 7d, at-risk no session in 7d, avg sessions per student from StructuredSession/User); `getStudentsList(opts)` (paginated list with sessionCount, lastActiveAt, topicsStudiedCount, status; filters board, grade, lastActiveWithinDays); `getStudentDrilldown(studentId)` (profile, sessionCount, lastSessionAt, topicsStudied from StudentTopicProgress + TopicDef, weakTopicCount via getWeakTopics(studentId) once). Read-only Prisma + single getWeakTopics call for drilldown only.

**STEP 7**  
**File to create:** `app/api/admin/student-learning/summary/route.ts`  
**Purpose:** Admin API for student-learning summary.  
**Description:** Create GET handler. Enforce admin. Call studentLearningAnalytics.getSummary(). Return JSON { totalStudents, activeStudents, atRiskStudents, averageSessionsPerStudent }.

**STEP 8**  
**File to create:** `app/api/admin/student-learning/students/route.ts`  
**Purpose:** Admin API for paginated student list.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, lastActiveWithinDays?, status?, page?, limit?. Call studentLearningAnalytics.getStudentsList(). Return JSON { students: [...], total, page }.

**STEP 9**  
**File to create:** `app/api/admin/student-learning/students/[studentId]/route.ts`  
**Purpose:** Admin API for per-student drilldown.  
**Description:** Create GET handler. Enforce admin. Read studentId from params. Call studentLearningAnalytics.getStudentDrilldown(studentId). Return JSON { profile, sessionCount, lastSessionAt, topicsStudied, weakTopicCount?, weakTopicIds?, recentSessions? }.

**STEP 10**  
**File to create:** `app/admin/student-learning/page.tsx`  
**Purpose:** Admin UI for student learning list.  
**Description:** Create page. Summary cards (total, active, at-risk, avg sessions) from summary API. Table of students from students API with filters and pagination. Row link to drilldown page. No changes to existing users or dashboard pages.

**STEP 11**  
**File to create:** `app/admin/student-learning/[studentId]/page.tsx`  
**Purpose:** Admin UI for per-student drilldown.  
**Description:** Create dynamic page. Fetch GET /api/admin/student-learning/students/[studentId]. Display profile, activity, progress, weak topics, recent sessions. Links to recommendation trace and weak-topics filtered by student if applicable. No changes to existing files.

---

## Learning Outcome Analytics

**STEP 12**  
**File to create:** `lib/admin/learningOutcomeAnalytics.ts`  
**Purpose:** Admin read-only service for learning outcome aggregates.  
**Description:** Create the file. Implement: `getSummary(opts)` (average accuracy by subject from StudentTopicMastery, optional trend if derivable); `getBySubject(opts)` (subjects with averageAccuracy, studentCount, topicCount; filters board, grade, from, to); `getTopImproving(opts)` (topics with highest improvement or highest current accuracy if no history; filters and limit). Read-only Prisma on StudentTopicMastery, StudentTopicProgress, User, TopicDef, SubjectDef.

**STEP 13**  
**File to create:** `app/api/admin/learning-outcomes/summary/route.ts`  
**Purpose:** Admin API for outcome summary.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, subjectId?, from?, to?. Call learningOutcomeAnalytics.getSummary(). Return JSON { subjects: [...], trend? }.

**STEP 14**  
**File to create:** `app/api/admin/learning-outcomes/by-subject/route.ts`  
**Purpose:** Admin API for outcomes by subject.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, from?, to?. Call learningOutcomeAnalytics.getBySubject(). Return JSON { subjects: [...] }.

**STEP 15**  
**File to create:** `app/api/admin/learning-outcomes/top-improving/route.ts`  
**Purpose:** Admin API for top-improving topics.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, subjectId?, from?, to?, limit?. Call learningOutcomeAnalytics.getTopImproving(). Return JSON { topics: [...] }.

**STEP 16**  
**File to create:** `app/admin/learning-outcomes/page.tsx`  
**Purpose:** Admin UI for learning outcome analytics.  
**Description:** Create page. Filters: board, grade, subject, date range. Summary and by-subject table/chart from summary and by-subject APIs. Top-improving table from top-improving API. No changes to existing analytics pages.

---

## Parent Report Monitoring

**STEP 17**  
**File to modify:** `prisma/schema.prisma`  
**Purpose:** Store admin-controlled flags (e.g. parent reports paused).  
**Description:** Add model AdminConfig (e.g. id, key String @unique, value String, updatedAt DateTime). Used for parent report pause and optionally content-generation pause. No other schema changes.

**STEP 18**  
**File to create:** New migration file (e.g. `prisma/migrations/YYYYMMDDHHMMSS_add_admin_config/migration.sql`)  
**Purpose:** Create AdminConfig table.  
**Description:** Create migration that adds AdminConfig table. Run `prisma migrate dev` to generate if needed. Single migration file only.

**STEP 19**  
**File to create:** `lib/admin/parentReportMonitoring.ts`  
**Purpose:** Admin service for parent report scope and settings.  
**Description:** Create the file. Implement: `getScope()` (count students with linked parents from ParentStudent, count WeeklyStudentSummary for current/last week, optional lastRunAt from job log or stored value); `getStudents(opts)` (list students with linked parents, join latest WeeklyStudentSummary for lastReportWeekStart and status); `getReportsPaused()` and `setReportsPaused(paused)` (read/write AdminConfig key 'parent_reports_paused'). No changes to weekly job or parent dashboard in this file.

**STEP 20**  
**File to create:** `app/api/admin/parent-reporting/scope/route.ts`  
**Purpose:** Admin API for parent report scope.  
**Description:** Create GET handler. Enforce admin. Call parentReportMonitoring.getScope(). Return JSON { studentsWithLinkedParents, reportsGeneratedThisWeek, lastRunAt? }.

**STEP 21**  
**File to create:** `app/api/admin/parent-reporting/students/route.ts`  
**Purpose:** Admin API for list of students in report scope.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, page?, limit?. Call parentReportMonitoring.getStudents(). Return JSON { students: [...], total }.

**STEP 22**  
**File to create:** `app/api/admin/parent-reporting/settings/route.ts`  
**Purpose:** Admin API for report pause toggle.  
**Description:** Create GET and PATCH handlers in same route file. GET: call parentReportMonitoring.getReportsPaused(), return { reportsPaused: boolean }. PATCH: parse body { reportsPaused }, call parentReportMonitoring.setReportsPaused(), return updated settings. Enforce admin on both.

**STEP 23**  
**File to create:** `app/admin/parent-reporting/page.tsx`  
**Purpose:** Admin UI for parent report monitoring.  
**Description:** Create page. Summary cards from scope API. Table of students from students API. Global “Weekly parent reports” toggle from settings API (GET/PATCH). No changes to parent dashboard or weekly job in this file.

**STEP 24**  
**File to modify:** `worker/jobs/weeklyParentSummary.ts`  
**Purpose:** Respect global pause flag for parent reports.  
**Description:** At start of aggregateWeeklySummaries (or at start of each student loop), read AdminConfig key 'parent_reports_paused' (or equivalent). If true, log and return without processing. Use Prisma in worker; no new dependencies. No change to aggregation or AI logic; only early exit when paused.

---

## Content Readiness Dashboard

**STEP 25**  
**File to create:** `lib/admin/contentReadiness.ts`  
**Purpose:** Admin service for content readiness by topic.  
**Description:** Create the file. Implement: `getReadinessList(opts)` (for each topic in scope, determine latest job from HydrationJob or ExecutionJob by topicId/entityId; map to status Not started/Pending/Running/Completed/Failed; join TopicDef, ChapterDef, SubjectDef for names; filters board, grade, subjectId, status; pagination); `getReadinessSummary()` (counts pending, running, failed from jobs). Optional: `getGenerationPaused()` and `setGenerationPaused(paused)` (AdminConfig key 'content_generation_paused'). Read-only for list/summary; write only for pause flag.

**STEP 26**  
**File to create:** `app/api/admin/content-readiness/route.ts`  
**Purpose:** Admin API for content readiness list.  
**Description:** Create GET handler. Enforce admin. Parse query params: board?, grade?, subjectId?, status?, page?, limit?. Call contentReadiness.getReadinessList(). Return JSON { items: [...], total }.

**STEP 27**  
**File to create:** `app/api/admin/content-readiness/summary/route.ts`  
**Purpose:** Admin API for readiness summary.  
**Description:** Create GET handler. Enforce admin. Call contentReadiness.getReadinessSummary(). Return JSON { pending, running, failed, completedToday? }. Optional: include getGenerationPaused() in response if implemented.

**STEP 28**  
**File to create:** `app/admin/content-readiness/page.tsx`  
**Purpose:** Admin UI for content readiness.  
**Description:** Create page. Table from content-readiness API with filters and sort. Summary strip from summary API. Links to existing Execution Jobs and Hydrate All for “View job” and “Retry.” Optional: global “Pause new generation” toggle if contentReadiness exposes pause (calling new PATCH endpoint or same settings pattern). No changes to existing content-engine pages.

**STEP 29**  
**File to modify:** One existing trigger route (e.g. `app/api/admin/content-engine/hydrate-all/route.ts` or `app/api/admin/hydrateAll/route.ts` or `app/api/admin/topics/[id]/generate/route.ts`)  
**Purpose:** Honor content generation pause flag.  
**Description:** At start of POST handler (trigger generation), read AdminConfig key 'content_generation_paused'. If true, return 503 or JSON { error: 'Generation paused', paused: true }. No other logic change. Choose a single file that is the primary entry for “new” generation (e.g. hydrate-all or topic generate); document which key is used so contentReadiness and this route stay in sync.

---

## Content Quality Monitoring

**STEP 30**  
**File to create:** `lib/admin/contentQualityMonitoring.ts`  
**Purpose:** Admin read-only service for content quality aggregates.  
**Description:** Create the file. Implement: `getQualitySummary(opts)` (from AuditLog, count actions containing 'approve'/'reject' in date range; group by type from details; extract rejection reasons from details.reason, aggregate counts); `getPendingSummary()` (reuse query similar to content-approval API for pending counts and optional oldest pending per type); `getHistoryForEntity(entityType, entityId)` (AuditLog rows for that entity, return action, userId, createdAt, reason, comment). Read-only Prisma. No changes to content-approval or moderation logic.

**STEP 31**  
**File to create:** `app/api/admin/content-quality/summary/route.ts`  
**Purpose:** Admin API for quality summary.  
**Description:** Create GET handler. Enforce admin. Parse query params: from?, to?. Call contentQualityMonitoring.getQualitySummary(). Return JSON { approved, rejected, byType: {...}, rejectionReasons: [...] }.

**STEP 32**  
**File to create:** `app/api/admin/content-quality/pending/route.ts`  
**Purpose:** Admin API for pending queue summary.  
**Description:** Create GET handler. Enforce admin. Call contentQualityMonitoring.getPendingSummary(). Return JSON { totalPending, byType: {...}, oldestPendingAt?, items? }. No change to content-approval GET; this can duplicate the pending query or call the same data layer.

**STEP 33**  
**File to create:** `app/api/admin/content-quality/history/route.ts`  
**Purpose:** Admin API for moderation history per item.  
**Description:** Create GET handler. Enforce admin. Parse query params: entityType, entityId. Call contentQualityMonitoring.getHistoryForEntity(). Return JSON { history: [...] }.

**STEP 34**  
**File to create:** `app/admin/content-quality/page.tsx`  
**Purpose:** Admin UI for content quality monitoring.  
**Description:** Create page. Summary (approval/rejection counts, rejection reasons) from summary API. Pending queue summary from pending API. Optional: link to Content Review and per-item history (e.g. modal that calls history API with entityType/entityId). No changes to content-approval page.

---

## Navigation

**STEP 35**  
**File to modify:** `components/Admin/AdminSidebar.tsx`  
**Purpose:** Add sidebar links to new admin pages.  
**Description:** Add navigation items for: Weak topic monitoring (/admin/weak-topics), Student learning (/admin/student-learning), Learning outcomes (/admin/learning-outcomes), Parent reporting (/admin/parent-reporting), Content readiness (/admin/content-readiness), Content quality (/admin/content-quality). Place under an existing section (e.g. “General Admin” or a new “Learning” section) without removing or refactoring existing links. One file only.

---

## Summary

| Steps | System                                                            |
| ----- | ----------------------------------------------------------------- |
| 1–5   | Weak Topic Monitoring                                             |
| 6–11  | Student Learning Analytics                                        |
| 12–16 | Learning Outcome Analytics                                        |
| 17–24 | Parent Report Monitoring (includes schema, migration, job check)  |
| 25–29 | Content Readiness Dashboard (includes pause in one trigger route) |
| 30–34 | Content Quality Monitoring                                        |
| 35    | AdminSidebar navigation                                           |

**Total: 35 steps. One file per step. Session engine and recommendation engine unchanged. No refactor of existing admin systems.**
