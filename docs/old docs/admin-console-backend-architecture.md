# Spinzy Admin Console — Backend Architecture

**Role:** Senior Software Architect  
**Scope:** Backend services and APIs for the six missing or incomplete Admin systems.  
**Constraints:** Do not modify the student session engine or the recommendation engine. Admin systems are read/control layers above existing services.

**Existing data sources (read-only or control-only):**  
StudentTopicProgress, StudentTopicMastery, StructuredSession, AnalyticsDailyAggregate, AnalyticsSignal, recommendation traces (Redis), content generation jobs (ExecutionJob, HydrationJob, RegenerationJob), WeeklyStudentSummary, ParentStudent, AuditLog, TopicDef, ChapterDef, content-approval APIs.

---

## SECTION 1 — Weak Topic Monitoring Architecture

**Purpose**  
Provide admin with a read-only view of “weak topics” across the platform: which topics have the most struggling students, and which students have weak topics. Supports curriculum and content decisions and at-risk student follow-up. No change to the definition of “weak” (mastery < threshold and practiceCount > minimum) or to the recommendation engine.

**Data sources**  
- **StudentTopicProgress** — Primary source. Same criteria as product: `mastery < 0.4`, `practiceCount > 5` (reuse constants from `lib/learning/getWeakTopics.ts`). Fields: studentId, topicId, mastery, practiceCount, lastStudiedAt.  
- **TopicDef** — Resolve topicId to name, chapterId; join via chapter → subject for filters.  
- **ChapterDef / SubjectDef / Class / Board** — For hierarchy (subject, grade, board) when filtering “by topic” or “by student.”  
- **User** — Board, grade (and optionally subject list) for student-level view and filters.

**Admin service design**  
- **Name:** `AdminWeakTopicService` (or `WeakTopicMonitoringService`).  
- **Location:** e.g. `lib/admin/weakTopicMonitoring.ts` or `services/admin/weakTopicMonitoring.ts`.  
- **Responsibilities (read-only):**  
  - **By topic:** Query StudentTopicProgress with weak criteria; group by topicId; join TopicDef (and chapter/subject) for names and hierarchy; return list of { topicId, topicName, subjectId, subjectName, chapterId, chapterName, studentCount, severity? }. Severity is derived (e.g. high when studentCount > 20). Sort by studentCount descending. Support filters: board, grade, subjectId.  
  - **By student:** For each student with at least one weak topic (same StudentTopicProgress filter), aggregate topicIds and optionally topic names; return list of { studentId, studentEmail?, weakTopicCount, topicIds, topicNames?, severity? }. Join User for board, grade, name/email. Sort by weakTopicCount descending. Support filters: board, grade, subjectId (students who have at least one weak topic in that subject).  
- **Implementation note:** Use a single Prisma query with groupBy (e.g. groupBy topicId, _count studentId) for “by topic”; for “by student” either groupBy studentId or iterate in batches. Reuse MASTERY_THRESHOLD and PRACTICE_MIN from getWeakTopics so the definition stays consistent. Do not call getWeakTopics in a loop for all students (scale); use one or few DB queries.  
- **No writes;** no new tables. Optional: cache aggregated “by topic” for 5–15 minutes to avoid heavy repeated queries if admin refreshes often.

**Admin API endpoints**  
- **GET /api/admin/weak-topics/by-topic** — Query params: board?, grade?, subjectId?, limit?. Response: { topics: Array<{ topicId, topicName, subjectId, subjectName, chapterId, chapterName, studentCount, severity }> }. Admin-only (session.role === 'admin').  
- **GET /api/admin/weak-topics/by-student** — Query params: board?, grade?, subjectId?, limit?. Response: { students: Array<{ studentId, studentEmail?, studentName?, board?, grade?, weakTopicCount, topicIds, topicNames?, severity }> }. Admin-only.  
- **GET /api/admin/weak-topics/summary** — Response: { totalStudentsWithWeakTopics: number, totalWeakTopicInstances: number } for dashboard card. Admin-only.

**Data flow**  
1. Admin UI requests by-topic or by-student (with optional filters).  
2. API validates session (admin), parses query params.  
3. AdminWeakTopicService runs read-only aggregation on StudentTopicProgress (+ TopicDef, User, hierarchy).  
4. Service returns DTOs; API returns JSON.  
5. No event emission or side effects; recommendation engine and getNextAction are not invoked.

**Integration with existing services**  
- **getWeakTopics / getWeakTopicsWithNames:** Same logical definition (mastery and practiceCount thresholds). Admin service does not call these per student; it performs its own aggregation to avoid N+1. Constants (MASTERY_THRESHOLD, PRACTICE_MIN) should be shared (import from getWeakTopics or a shared constants module).  
- **Recommendation engine (P2 weak_topic_urgent):** Unchanged. Admin only reads the same underlying data.  
- **Student dashboard WeakTopicsSection:** Unchanged; continues to use getWeakTopicsWithNames per student.

---

## SECTION 2 — Student Learning Analytics Architecture

**Purpose**  
Provide admin with aggregate learning metrics (total students, active, at-risk, average sessions) and a per-student drilldown (sessions, last active, topics studied, weak topics link) for operational and support use. Read-only; no change to session or recommendation logic.

**Data sources**  
- **User** — All users with role student (or equivalent). Fields: id, email, name, board, grade, createdAt.  
- **StructuredSession** — Sessions per student. Fields: studentId, state, startedAt, completedAt (or updatedAt), topicId. Use for: session count, last session date, “completed today” (state COMPLETE and completedAt today).  
- **StudentTopicProgress** — Topics with at least some progress (e.g. practiceCount > 0 or mastery > 0) for “topics completed” or “topics studied” per student.  
- **StudentTopicMastery** — Optional: accuracy or mastery level for per-student summary if needed.  
- **TopicDef / ChapterDef / SubjectDef** — Resolve topicId to topic name and subject for display in drilldown.

**Admin service design**  
- **Name:** `AdminStudentLearningService` (or `StudentLearningAnalyticsService`).  
- **Location:** e.g. `lib/admin/studentLearningAnalytics.ts` or `services/admin/studentLearningAnalytics.ts`.  
- **Responsibilities (read-only):**  
  - **Summary:** Total student count (User where role = student). Active count: students with at least one StructuredSession in last 7 days. At-risk count: students with no StructuredSession in last 7 days (and optionally have been active before). Average sessions per student: total sessions (StructuredSession count) / total students, over configurable window (e.g. last 30 days). Return { totalStudents, activeStudents, atRiskStudents, averageSessionsPerStudent }.  
  - **List:** Paginated list of students with columns: studentId, email, name, board, grade, sessionCount (last 30d or all time), lastActiveAt (max session startedAt or completedAt), topicsStudiedCount (count of StudentTopicProgress rows for that student), status (active / at_risk / inactive). Filters: board, grade, lastActiveWithinDays (e.g. 7, 14, 30, or “none”). Sort: lastActiveAt desc, or sessionCount desc.  
  - **Drilldown:** For a given studentId: profile (User fields), sessionCount, lastSessionAt, topicsStudied (list of topicId + topicName + subject from StudentTopicProgress + TopicDef), weakTopicCount or weak topic ids (from same weak-topic logic or call getWeakTopics once for this student). Optional: last N sessions (session id, topicId, topicName, startedAt, state). No writes.  
- **Implementation:** Use Prisma aggregations (count, groupBy) and minimal joins. At-risk: e.g. “students who have no StructuredSession in last 7 days” = subquery or left join with filter. Avoid loading full session lists for all students; aggregate in DB.

**Admin API endpoints**  
- **GET /api/admin/student-learning/summary** — Response: { totalStudents, activeStudents, atRiskStudents, averageSessionsPerStudent }. Admin-only.  
- **GET /api/admin/student-learning/students** — Query params: board?, grade?, lastActiveWithinDays?, status?, page?, limit?. Response: { students: Array<{ studentId, email, name, board, grade, sessionCount, lastActiveAt, topicsStudiedCount, status }>, total, page }. Admin-only.  
- **GET /api/admin/student-learning/students/[studentId]** — Response: { profile: {...}, sessionCount, lastSessionAt, topicsStudied: [...], weakTopicIds?, weakTopicCount?, recentSessions?: [...] }. Admin-only.

**Data flow**  
1. Dashboard requests summary; list page requests students with filters and pagination; drilldown requests one student.  
2. API validates admin session, parses params.  
3. AdminStudentLearningService runs read-only queries (User, StructuredSession, StudentTopicProgress, TopicDef).  
4. API returns JSON.  
5. Session engine and recommendation engine are not called; data is read from persistence only.

**Integration with existing services**  
- **Session engine:** Not modified. Admin only reads StructuredSession.  
- **getWeakTopics:** For drilldown, service may call getWeakTopics(studentId) once per request to get weak topic list for that student; acceptable for single-student drilldown.  
- **Student app:** No change; student dashboard and APIs unchanged.

---

## SECTION 2A — Learning Funnel Analytics Architecture (Drop-off through session stages)

**Purpose**  
Measure where students drop off during learning sessions using a funnel view across structured session stages:
Recommendation shown → Session started → Practice completed → Test completed → Homework completed. This supports product iteration (UX friction points), operations (at-risk detection), and curriculum/content prioritization.

**Data sources**  
- **StructuredSession** — startedAt, state, completedAt, topicId, meta (contains practiceResult/testResult written by submit endpoints).  
- **SessionEvent** (linked to StructuredSession) — eventType signals: SESSION_STARTED, SESSION_OVERVIEW_VIEWED (resume), QUESTION_ANSWERED (source=practice|test), HOMEWORK_SUBMITTED, SESSION_COMPLETED.  
- **StudentTopicProgress** — practiceCount/mastery/lastStudiedAt for segment/context and “learning impact proxy” (note: no historical deltas available without a history table).

**Key metrics**  
- Stage counts: sessionsStarted, practiceCompletedSessions, testCompletedSessions, homeworkCompletedSessions.  
- Conversion rates: practiceCompletionRate, testCompletionRate, homeworkCompletionRate, endToEndCompletionRate.  
- Latency percentiles: time from startedAt to practice/test/homework completion (median, p95).  
- Resumption: % sessions with SESSION_OVERVIEW_VIEWED before completion (new vs resumed).  
- Data quality: % sessions missing meta.practiceResult/meta.testResult; event coverage for HOMEWORK_SUBMITTED.

**Important limitation (Recommendation shown)**  
The platform cannot reliably measure “Recommendation shown” from StructuredSession + StudentTopicProgress alone. To include this as the funnel top stage, add explicit impression instrumentation (e.g. a RecommendationImpression event/table or a new SessionEvent type with metadata). Until then, the funnel starts at “Session started.”

**Admin service design**  
- **Name:** `AdminLearningFunnelAnalyticsService`.  
- **Location:** `lib/admin/learningFunnelAnalytics.ts` (recommended).  
- **Responsibilities:**  
  - `getFunnelSummary({from,to, board?, grade?, subjectId?})` → stages + rates + latency + dataQuality.  
  - `getFunnelTimeseries({from,to, granularity:'day', ...})` → daily series.  
  - `getDropoffBreakdown({from,to, stage, limit, ...})` → top topics/chapters/segments driving drop-off.  
- **Read-only** by default. For performance, optionally add a daily rollup table + nightly job.

**Admin API endpoints**  
- **GET /api/admin/learning-funnel/summary** — stage counts, conversion rates, latency, data quality.  
- **GET /api/admin/learning-funnel/timeseries** — daily trend.  
- **GET /api/admin/learning-funnel/dropoff** — breakdown for a chosen stage (practice/test/homework).

**Admin dashboard UX**  
- New page `/admin/learning-funnel` with date range + board/grade/subject filters.  
- Funnel visualization + trend chart + latency panel + “top drop-off topics/segments” tables.  
- Banner indicating whether “Recommendation shown” impressions are instrumented; if not, funnel begins at “Session started.”

**Detailed design doc**  
See `Docs/admin-learning-funnel-analytics.md`.

## SECTION 3 — Learning Outcome Analytics Architecture

**Purpose**  
Provide admin with aggregate learning-outcome metrics: average accuracy by subject (and optionally grade/board), mastery improvement trends where derivable, and topics with highest improvement. Supports product and curriculum decisions. Read-only; no change to how mastery or accuracy are computed or written.

**Data sources**  
- **StudentTopicMastery** — accuracy, masteryLevel, topicId, subject, studentId. Primary source for “average accuracy by subject” and for improvement if historical values are available.  
- **StudentTopicProgress** — mastery, topicId, studentId, lastStudiedAt. Alternative or complement for “mastery” when product uses this as the main progress store.  
- **TopicDef / ChapterDef / SubjectDef** — For subject and topic names when reporting “by topic.”  
- **User** — board, grade for filtering by segment.  
- Optional: **AnalyticsDailyAggregate** or other pre-aggregated tables if they already store outcome-like metrics (e.g. daily accuracy by course/subject).

**Admin service design**  
- **Name:** `AdminLearningOutcomeService` (or `LearningOutcomeAnalyticsService`).  
- **Location:** e.g. `lib/admin/learningOutcomeAnalytics.ts` or `services/admin/learningOutcomeAnalytics.ts`.  
- **Responsibilities (read-only):**  
  - **Average accuracy by subject:** Group StudentTopicMastery by subject (and optionally by board/grade via User join). Compute average accuracy per subject. Filters: board, grade, date range (e.g. lastAttemptedAt within range). Return { subjects: Array<{ subjectId?, subjectName, studentCount, topicCount, averageAccuracy }> }.  
  - **Mastery improvement trend:** If historical accuracy or mastery is stored (e.g. in AuditLog or a history table), compute week-over-week or period-over-period change. If not stored, return “not available” or a simple “current snapshot” trend (e.g. compare last 7d avg to previous 7d avg from current data). Return { series: Array<{ period, averageMasteryOrAccuracy }>, trend: 'up'|'down'|'stable' }.  
  - **Topics with highest improvement:** Where “improvement” can be computed (e.g. topic-level delta from a baseline or two periods), list topics sorted by improvement descending. If no history, skip or return “current top by average accuracy.” Return { topics: Array<{ topicId, topicName, subjectName, improvement?, averageAccuracy }> }.  
- **Implementation:** Prefer aggregation in DB (groupBy, avg). If product has a LearningOutcomeService that exposes aggregates, admin service can call it (read-only) instead of duplicating logic. No new tables unless product adds a dedicated outcome history table later.

**Admin API endpoints**  
- **GET /api/admin/learning-outcomes/summary** — Query params: board?, grade?, subjectId?, from?, to?. Response: { subjects: [...], trend?: {...} }. Admin-only.  
- **GET /api/admin/learning-outcomes/by-subject** — Query params: board?, grade?, from?, to?. Response: { subjects: Array<{ subjectId, subjectName, averageAccuracy, studentCount, topicCount, trend? }> }. Admin-only.  
- **GET /api/admin/learning-outcomes/top-improving** — Query params: board?, grade?, subjectId?, from?, to?, limit?. Response: { topics: Array<{ topicId, topicName, subjectName, improvement?, averageAccuracy }> }. Admin-only.

**Data flow**  
1. Admin UI requests summary, by-subject, or top-improving with filters and date range.  
2. API validates admin, parses params.  
3. AdminLearningOutcomeService runs read-only aggregations on StudentTopicMastery (and optionally StudentTopicProgress, User).  
4. API returns JSON.  
5. No writes; session engine and recommendation engine unchanged.

**Integration with existing services**  
- **LearningOutcomeService (product):** If it exists and exposes getOutcomesForStudent or aggregates, admin service may call it for consistency; otherwise admin implements its own aggregates from StudentTopicMastery/StudentTopicProgress.  
- **updateStudentTopicProgress / session engine:** Not modified; admin only reads.  
- **AnalyticsDailyAggregate / AnalyticsSignal:** Use if they already contain outcome-like metrics; otherwise primary source is StudentTopicMastery/StudentTopicProgress.

---

## SECTION 4 — Parent Report Monitoring Architecture

**Purpose**  
Give admin visibility into which students are in scope for parent reports, last report run time, and optional per-student report status. Provide a control to enable/disable weekly parent report generation globally (and optionally per-student opt-out). No change to report content or AI; only visibility and on/off control.

**Data sources**  
- **ParentStudent** — status = active. Gives list of studentIds that have at least one linked parent.  
- **WeeklyStudentSummary** — studentId, weekStart, topicsCovered, testsTaken, etc. (and optional reportText if column exists). Used for “last report week” per student and “reports generated this week” count.  
- **User** — student name, email, board, grade for table display.  
- **Job / scheduler metadata** — If available: last run timestamp of weeklyParentSummary job (e.g. from job log or a simple key in Redis/DB). Otherwise “last run” can be derived from max(WeeklyStudentSummary.updatedAt or createdAt) per student or globally.

**Admin service design**  
- **Name:** `AdminParentReportService` (or `ParentReportMonitoringService`).  
- **Location:** e.g. `lib/admin/parentReportMonitoring.ts` or `services/admin/parentReportMonitoring.ts`.  
- **Responsibilities:**  
  - **Read:** (1) List students with linked parents: join ParentStudent (status active) with User; optionally join latest WeeklyStudentSummary per student (weekStart desc) to show “last report week” and status. (2) Count of students with linked parents. (3) Count of WeeklyStudentSummary rows for current week (or last week) = “reports generated this week.” (4) Last run of weekly job: from job table or a stored “lastRunAt” (e.g. in a small config table or Redis). Return DTOs for dashboard and table.  
  - **Control (optional):** (1) Global “pause reports” flag: stored in env var (e.g. PAUSE_PARENT_WEEKLY_REPORTS) or in a small AdminConfig/FeatureFlag table (e.g. key = 'parent_reports_paused', value = 'true'|'false'). Admin API GET returns current value; PATCH or POST toggles it. Weekly job (weeklyParentSummary) reads this at start and exits early if paused. (2) Per-student opt-out: if required, add optional field on User or ParentStudent (e.g. excludeFromParentReport boolean); admin API PATCH to set; job skips that student when generating.  
- **Implementation:** Read path is read-only. Control path: only toggle flags or update one row; no change to report generation logic itself.

**Admin API endpoints**  
- **GET /api/admin/parent-reporting/scope** — Response: { studentsWithLinkedParents: number, reportsGeneratedThisWeek: number, lastRunAt?: string }. Admin-only.  
- **GET /api/admin/parent-reporting/students** — Query params: board?, grade?, page?, limit?. Response: { students: Array<{ studentId, studentName, studentEmail, parentLinked, lastReportWeekStart?, reportStatus? }>, total }. Admin-only.  
- **GET /api/admin/parent-reporting/settings** — Response: { reportsPaused: boolean }. Admin-only.  
- **PATCH /api/admin/parent-reporting/settings** — Body: { reportsPaused: boolean }. Updates global flag; returns updated settings. Admin-only.  
- **PATCH /api/admin/parent-reporting/students/[studentId]/opt-out** — Body: { exclude: boolean }. Optional; only if per-student opt-out is implemented. Admin-only.

**Data flow**  
1. Admin UI loads scope and students; displays toggle.  
2. On toggle: PATCH settings; weekly job (next run) reads flag and skips generation if paused.  
3. No change to generateParentReportAI or to parent dashboard API; they keep reading WeeklyStudentSummary and returning report text.  
4. If per-student exclude exists, weeklyParentSummary filters out excluded students when building the list to process.

**Integration with existing services**  
- **worker/jobs/weeklyParentSummary.ts:** At start of run, read global “reports paused” flag; if true, log and return without processing. When building student list (students with linked parents), exclude students with excludeFromParentReport if that field exists. No other change to aggregation or AI call.  
- **app/api/parent/dashboard/route.ts:** Unchanged; continues to read WeeklyStudentSummary and return data to parent UI.  
- **generateParentReportAI:** Unchanged; still invoked by weekly job when not paused and student not excluded.

---

## SECTION 5 — Content Readiness Architecture

**Purpose**  
Provide admin with a single view of “content readiness” by topic (or chapter): which topics have no generation, pending, running, completed, or failed jobs. Support links to existing job detail and retry, and optional global “pause new generation” control. Does not replace Execution Jobs or Hydrate All UIs; it aggregates and links.

**Data sources**  
- **HydrationJob** — topicId, chapterId, subjectId, status (pending, running, completed, failed), rootJobId, parentJobId, updatedAt, createdAt. Primary source for “readiness” when content is produced by the hydration pipeline.  
- **ExecutionJob** — entityType, entityId (topicId or other), status, updatedAt, createdAt. Alternative or complement when topics are generated via ExecutionJob.  
- **TopicDef** — id, name, chapterId, status, lifecycle. To list all topics and join with latest job state.  
- **ChapterDef / SubjectDef / Class / Board** — For hierarchy (subject, grade, board) and filters.  
- **RegenerationJob** — Optional: if some content is driven by RegenerationJob, include in “latest job” resolution or a separate section. Prefer HydrationJob and ExecutionJob as primary.

**Admin service design**  
- **Name:** `AdminContentReadinessService` (or `ContentReadinessService`).  
- **Location:** e.g. `lib/admin/contentReadiness.ts` or `services/admin/contentReadiness.ts`.  
- **Responsibilities (read-only for view; control delegates to existing APIs):**  
  - **Readiness list:** For each topic (or each topic in a given board/grade/subject filter), determine “status”: Not started (no job ever), Pending (latest job pending), Running (latest job running), Completed (latest job completed), Failed (latest job failed). “Latest job” = latest HydrationJob by topicId (or by chapterId and then expand to topics if needed) or latest ExecutionJob where entityType = topic and entityId = topicId. Return list of { topicId, topicName, chapterId, chapterName, subjectId, subjectName, status, lastJobId?, lastJobAt?, lastError? }. Sort by status (e.g. Failed first), then by lastJobAt. Support filters: board, grade, subjectId, status.  
  - **Summary counts:** Count of topics (or jobs) in Pending, Running, Failed (e.g. last 7 days). Return for dashboard strip.  
  - **Control:** No direct retry or trigger in this service. Admin UI calls existing APIs: POST to content-engine/jobs retry, or Hydrate All trigger, or topics/[id]/generate. Optional: “Pause new generation” is a flag (env or AdminConfig); job submission endpoints (e.g. hydrate-all, topic generate) check the flag and return 503 or “paused” when set. That logic lives in existing routes; this service only exposes “is generation paused” (GET) if needed for UI.

**Admin API endpoints**  
- **GET /api/admin/content-readiness** — Query params: board?, grade?, subjectId?, status?, page?, limit?. Response: { items: Array<{ topicId, topicName, chapterId, chapterName, subjectId, subjectName, status, lastJobId, lastJobAt, lastError? }>, total }. Admin-only.  
- **GET /api/admin/content-readiness/summary** — Response: { pending: number, running: number, failed: number, completedToday?: number }. Admin-only.  
- **GET /api/admin/content-readiness/pause** — Response: { paused: boolean }. Optional; for global pause toggle. Admin-only.  
- **PATCH /api/admin/content-readiness/pause** — Body: { paused: boolean }. Optional; updates flag. Existing job trigger routes (e.g. hydrate-all, topic generate) must check this flag and refuse new jobs when paused. Admin-only.

**Data flow**  
1. Admin UI requests content-readiness list and summary; optionally requests pause status.  
2. AdminContentReadinessService queries HydrationJob (and optionally ExecutionJob, TopicDef, hierarchy); computes latest job per topic and status; returns DTOs.  
3. For “Retry” or “Generate,” UI calls existing endpoints: e.g. POST /api/admin/content-engine/jobs/[id]/[action] (retry), or POST /api/admin/topics/[id]/generate, or Hydrate All trigger.  
4. No new job types or worker logic; only aggregation and optional pause flag read/write.

**Integration with existing services**  
- **app/api/admin/content-engine/jobs/route.ts:** Unchanged; still used for list and filters. Content-readiness service may use the same Prisma models (HydrationJob, ExecutionJob) to build the readiness view without duplicating job state machine.  
- **app/api/admin/content-engine/jobs/[id]/[action]/route.ts:** Unchanged; admin UI calls it for retry/requeue.  
- **app/api/admin/hydrateAll/route.ts / hydrate-all/route.ts:** Unchanged; if pause is implemented, these routes check the pause flag at entry and return 503 or { paused: true } when set.  
- **app/api/admin/topics/[id]/generate/route.ts:** Unchanged; same pause check if implemented.  
- **Session engine / recommendation engine:** Not involved.

---

## SECTION 6 — Content Quality Monitoring Architecture

**Purpose**  
Provide admin with a read-only view of content quality signals: approval/rejection rates, rejection reasons, and optional moderation history aggregates. Supports content and moderation process improvement. No change to moderation workflow or content-approval APIs; only aggregation and exposure.

**Data sources**  
- **AuditLog** — action (e.g. contains 'approve', 'reject'), details (JSON: entityType, entityId, reason?, comment?), userId, createdAt. Primary source for “who approved/rejected what and why.”  
- **Content-approval API (existing):** Pending counts by type (syllabus, chapter, topic, note, test). Use for “pending queue depth” and “age” if createdAt is returned.  
- **TopicDef / TopicNote / GeneratedTest / ChapterDef / Syllabus** — status or lifecycle for “draft” vs “approved”; optional for “content with rejections” or “last rejected at.”

**Admin service design**  
- **Name:** `AdminContentQualityService` (or `ContentQualityMonitoringService`).  
- **Location:** e.g. `lib/admin/contentQualityMonitoring.ts` or `services/admin/contentQualityMonitoring.ts`.  
- **Responsibilities (read-only):**  
  - **Approval/rejection counts:** Query AuditLog for actions containing 'approve' or 'reject' in a date range. Group by type (from details.entityType or parsed from action). Return { approved: number, rejected: number, byType: { syllabus: { approved, rejected }, chapter: {...}, topic: {...}, note: {...}, test: {...} } }.  
  - **Rejection reasons:** From AuditLog where action contains 'reject', extract details.reason (or similar). Aggregate: { reason: string, count: number }[]. Return for “why content was rejected” chart or table.  
  - **Pending queue summary:** Call existing content-approval list or replicate its pending query to return counts and optionally oldest pending item per type (for “age”). Return { totalPending, byType: { syllabus, chapter, topic, note, test }, oldestPendingAt? }.  
  - **Moderation history for an item:** Given entityType and entityId, return list of AuditLog rows (action, userId, createdAt, details.reason, details.comment). Used by moderation queue UX “history” panel; can be served by existing audit API with filter or by this service.  
- **Implementation:** Read-only Prisma queries on AuditLog; optional call to content-approval GET for pending counts if not duplicating the query. No new tables; ensure rejection reason is stored in details when reject API is used (from gap analysis: “require reason on reject”).

**Admin API endpoints**  
- **GET /api/admin/content-quality/summary** — Query params: from?, to?. Response: { approved, rejected, byType: {...}, rejectionReasons: Array<{ reason, count }> }. Admin-only.  
- **GET /api/admin/content-quality/pending** — Response: { totalPending, byType: {...}, oldestPendingAt?, items?: [...] }. Can delegate to existing content-approval GET and reshape, or implement with same query. Admin-only.  
- **GET /api/admin/content-quality/history** — Query params: entityType, entityId. Response: { history: Array<{ action, userId, userEmail?, createdAt, reason?, comment? }> }. Admin-only.  
- Optional: **GET /api/admin/content-quality/export** — Query params: from?, to?. Response: CSV or JSON of approval/rejection events for reporting. Admin-only.

**Data flow**  
1. Admin UI requests summary (and optionally pending, history for one item).  
2. API validates admin; AdminContentQualityService queries AuditLog (and optionally content-approval).  
3. API returns JSON.  
4. Moderation actions (approve/reject) continue to be performed by existing content-approval and content-engine moderation endpoints; they write to AuditLog. This service only reads.

**Integration with existing services**  
- **app/api/admin/content-approval/route.ts:** Unchanged; still used for list pending and for approve/reject. Content-quality “pending” can reuse the same query or call this API and reshape.  
- **app/api/admin/content-approval/[type]/[id]/route.ts:** Unchanged; reject flow should store reason in request body and in AuditLog.details (gap fix: “require rejection reason”).  
- **app/api/admin/content-engine/audit-logs/route.ts:** Existing engine audit logs; content-quality focuses on approval/reject actions (may overlap with engine audit filter). Either share the same AuditLog table with different filters or have content-quality use a dedicated “content approval” action prefix for clarity.  
- **Session engine / recommendation engine:** Not involved.

---

## Cross-cutting

- **Auth:** Every admin API must enforce admin (or admin/moderator where appropriate) via session.role. Use existing requireAdmin or requireAdminOrModerator.  
- **Rate and size:** Admin APIs can be heavier (aggregations); use reasonable limits (e.g. limit 500 for list endpoints, pagination) to avoid timeouts.  
- **Caching:** Optional short TTL (5–15 min) for summary endpoints (e.g. weak-topic summary, content-readiness summary) if needed for performance; invalidate on demand or accept staleness.  
- **Errors:** Return 4xx/5xx with clear messages; do not expose internal DB or stack traces.  
- **No code generated:** This document describes architecture only; implementation follows these contracts and integrates with existing code as stated.

---

*End of Admin Console backend architecture. Session engine and recommendation engine are not modified; all admin systems are read or control layers above existing services and data.*
