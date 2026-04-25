# Spinzy Admin Console UX — Learning Control Tower

**Role:** Senior EdTech Product Designer  
**Scope:** Missing and incomplete Admin UX layers for a production-ready platform.  
**Principle:** Do not redesign existing working systems; add new surfaces that plug into current APIs and sidebar.

**Context:** The audit and gap analysis show existing systems (Curriculum, Content Generation, AI Moderation, Recommendation Trace, System Health, Audit Logs). This document designs the **new or extended** UX for the Learning Control Tower: overview dashboard, curriculum hub, generation readiness, moderation queue, student learning analytics, weak topic monitoring, recommendation debugging, parent reporting, learning outcome analytics, and unified system health.

---

## SECTION 1 — Dashboard Layout (Platform Overview)

**Purpose:** Single landing view after admin login: high-level operational health and action triggers.

**Placement:** Default admin home (`/admin` or `/admin/dashboard`). Existing admin home can become this dashboard or a dedicated route; sidebar “Home” or “Dashboard” opens it.

**Layout: one full-width page, two tiers.**

### Tier 1 — Hero metrics row (top)

Single row of **metric cards**, equal width, 6 cards. Each card: large number, short label, optional mini sparkline or “vs yesterday” (where data exists). Cards are clickable where they link to a detail section.

| #   | Metric                       | Source (existing or new)                                                                      | Link / action                                               |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | **Daily Active Students**    | Count of distinct students with at least one session today (StructuredSession or equivalent). | Link to Student Learning Analytics filtered “active today.” |
| 2   | **Sessions Completed Today** | Count of sessions in COMPLETE state with completedAt today.                                   | Link to session or analytics detail if available.           |
| 3   | **Questions Solved Today**   | Sum of practice/test answers submitted today (from progress or attempt tables).               | Optional link to activity or exports.                       |
| 4   | **Topics Generated**         | Count of content-engine jobs completed today (or topics approved today).                      | Link to Content Generation / Execution Jobs filtered today. |
| 5   | **Pending Moderation Items** | Count from content-approval API (pending syllabus, chapter, topic, note, test).               | Link to Moderation Queue.                                   |
| 6   | **Weak Topic Alerts**        | Count of students with at least one weak topic (from weak-topic API or aggregate).            | Link to Weak Topic Monitoring.                              |

**Card design:**

- White/dark card, border, padding.
- Top: label (e.g. “Daily Active Students”) in small uppercase or muted.
- Center: primary number (e.g. “1,247”) in large, bold type.
- Bottom (optional): “vs yesterday” delta in green/red or neutral; or 7-day mini bar.
- Hover: slight lift or border highlight; cursor pointer when card links.

### Tier 2 — Quick actions and recent activity

**Left (≈60% width):**

- **Quick actions** — 4–6 buttons or short links: “Content Review,” “Generation status,” “Failed jobs,” “System alerts,” “Audit logs,” “Recommendation traces.”
- Reuse existing routes; this is a shortcut strip so admins don’t rely only on the sidebar.

**Right (≈40% width):**

- **Recent activity** — Compact list (e.g. last 10 items): “Job X failed,” “Topic Y approved,” “Alert Z raised.”
- Data from AuditLog or content-engine audit logs, filtered to “admin-relevant” actions.
- Each row: icon, short text, relative time; click opens relevant detail (job, content, alert).

**Responsive:**

- Desktop: 6 cards in one row; quick actions + recent activity side by side.
- Tablet: 3+3 cards; quick actions and recent activity stack.
- Mobile: cards in 2 columns or stacked; quick actions as a grid; recent activity full width.

**Empty / loading:**

- Skeleton for each card; “No data” when a metric has no source yet.
- No redesign of existing admin home content (e.g. job summary, recent failures); either replace that area with this dashboard or place this above it and keep “Recent failed jobs” as a third block below.

---

## SECTION 2 — Curriculum Hub UX

**Purpose:** Single entry point to manage Board → Grade → Subject → Chapter → Topic with tree view, status, and quick actions.

**Placement:** New sidebar item “Curriculum hub” (or “Curriculum”) under Content Management; route e.g. `/admin/curriculum` or `/admin/curriculum-hub`. Existing boards/classes/subjects/syllabus/courses/chapters/topics pages remain; the hub is the **entry** and map, not a replacement.

**Layout: hub page with tree + detail panel.**

### Main area — Curriculum tree / map

**Option A — Collapsible tree (recommended for first release)**

- One column: hierarchical list.
- Level 0: **Boards** (e.g. CBSE, ICSE). Expand to show Grades (e.g. 6, 7, 8).
- Level 1: **Grade**. Expand to show **Subjects**.
- Level 2: **Subject**. Expand to show **Chapters** (with order).
- Level 3: **Chapter**. Expand to show **Topics** (with order).
- Each row: icon (board/grade/subject/chapter/topic), name, **status indicator** (dot or badge: draft / pending / approved / published — from existing lifecycle if available), optional count (e.g. “12 topics”).
- Row actions (icon or kebab): “View,” “Approve” (if pending), “Generate” (for topic), “Edit” (if supported).
- Breadcrumb at top: “Board > Grade > Subject > Chapter > Topic” for current selection.

**Option B — Curriculum map (future)**

- Visual map: nodes for subject/chapter/topic; edges for “contains” or “prerequisite.”
- Click node to select and open detail panel.
- Same status and quick actions as tree.

### Detail panel (right or bottom sheet)

- When a **node** is selected (board/grade/subject/chapter/topic):
  - **Summary:** name, id, status, created/updated, optional metadata.
  - **Quick actions:** Approve / Reject (if pending), Generate (topic), Pause / Resume (topic), “View in Content Review” (if type has pending content).
  - **Children:** if parent (e.g. chapter), list of children (topics) with same status + actions.
- Reuse existing APIs (syllabi, approve, topics generate, etc.); no new backend for v1 beyond optional “tree” or “list by parent” endpoint if needed.

### Status indicators

- **Draft** — not yet approved (muted or yellow).
- **Pending** — in moderation queue (amber).
- **Approved** — approved, not necessarily published (green).
- **Published** — live for students (blue or check).
- **Error / Failed** — generation failed (red).
- Indicator on each row and in detail panel; legend at top or in sidebar.

### Navigation from hub

- “Manage boards” → existing boards page.
- “Manage classes” → existing classes page.
- Same for subjects, syllabus, courses, chapters, topics.
- Hub is the **map**; deep management stays on existing pages.

---

## SECTION 3 — Generation Control UX

**Purpose:** Generation readiness by topic, pending/failed jobs, and retry/regenerate control without replacing existing Execution Jobs or Hydrate All UIs.

**Placement:** New “Content readiness” or “Generation status” in sidebar under Content Generation; route e.g. `/admin/content-readiness` or `/admin/generation-status`. Existing Control Panel, Hydrate All, Execution Jobs, Regeneration Jobs stay as-is; this view **aggregates** and links out.

**Layout: readiness view + control strip.**

### Content readiness view (primary)

- **Table or card grid** of curriculum units (e.g. by Subject > Chapter > Topic, or flat list of topics).
- Columns: **Topic** (name + id), **Subject / Chapter**, **Status** (Not started / Pending / Running / Completed / Failed), **Last job** (date or “—” ), **Actions**.
- **Status** from existing job APIs or a thin “readiness” API that maps topic/chapter to latest job state.
- **Filters:** Board, Grade, Subject, Status (multi-select).
- **Sort:** By status (e.g. Failed first), by last job date, by name.
- **Actions per row:** “Generate” (trigger topic generate), “Retry” (if failed), “View job” (link to Execution Jobs or Hydrate All job detail).
- Optional: **Bulk actions** — “Retry all failed in this chapter,” “Generate all missing in this subject” (if backend supports).

### Generation control panel (strip or card)

- **Summary counts:** Pending jobs (e.g. queued), Running, Failed (today or last 7 days).
- **Global control:** “Pause new generation” toggle (when backend supports); label “Resume generation” when paused.
- **Short links:** “Open Execution Jobs,” “Open Hydrate All,” “Open Regeneration jobs.”
- Placed above or beside the readiness table so admins see counts and pause without leaving the page.

### Retry / Regenerate

- **Per row:** “Retry” only when status is Failed; opens confirm or triggers retry API then refreshes row.
- **Bulk:** “Retry all failed” button (e.g. for current filter); confirm modal “Retry N failed jobs?” then trigger and show toast.
- No redesign of retry logic inside Execution Jobs or Hydrate All; this view **calls** the same retry APIs and links to existing job detail for logs.

---

## SECTION 4 — Moderation Queue UX

**Purpose:** Queue of pending items with age, approve/reject, rejection reasons, and moderation history. Extends existing Content Review rather than replacing it.

**Placement:** “Moderation queue” in sidebar (can be the existing “Content Review” relabeled or a dedicated queue view). Route e.g. `/admin/moderation-queue` or keep `/admin/content-approval` and enhance it.

**Layout: queue table + detail + history.**

### Queue list (main table)

- **Columns:** Type (syllabus / chapter / topic / note / test), **Title / name**, **Context** (e.g. board, grade, subject), **Submitted / Created** (date), **Age** (e.g. “2h,” “1d,” “3d” — highlight >24h in amber), **Actions** (Approve, Reject).
- **Filters:** Type, Age (e.g. “Older than 24h”), Board/Subject if available.
- **Sort:** Default “Oldest first” so stale items surface; optional sort by type or date.
- **Bulk:** Checkbox per row; “Approve selected,” “Reject selected” (reject opens reason modal for each or one reason for all).

### Approve / Reject actions

- **Approve:** One click; optional comment (stored in audit). Success toast; row removed from pending or status updated.
- **Reject:** Click opens **reject modal**: required **reason** (dropdown: e.g. Quality, Safety, Wrong topic, Other) and optional **comment**. Submit writes to audit and updates content status; row removed or marked rejected.

### Moderation history

- **Per item:** In Content Review detail modal or a slide-over: “Moderation history” section.
- **List:** Entries (newest first): Action (Approved / Rejected), **By** (user email/id), **When** (date/time), **Reason** (if rejected), **Comment** (if any).
- Data from AuditLog filtered by entity id/type; no new table if audit already stores action, userId, details (reason/comment).

### Pending count in sidebar

- Badge on “Content Review” or “Moderation queue” with count of pending items (from content-approval API).
- Red or amber when count > 0 or when any item is older than 24h (optional).

---

## SECTION 5 — Student Learning Analytics UX

**Purpose:** Total/active/at-risk students, average sessions, and per-student drilldown. New admin surface; uses existing student and session data.

**Placement:** “Student learning” or “Learners” in sidebar (General Admin or new “Learning” section). Route e.g. `/admin/students` or `/admin/learning/students`. Existing Users page stays for role/status; this is **learning-focused**.

**Layout: summary cards + table + drilldown page.**

### Summary cards (top)

- **Total students** — Count of users with role student (or equivalent).
- **Active students** — e.g. at least one session in last 7 days.
- **Students at risk** — e.g. no session in 7+ days (configurable threshold).
- **Average sessions per student** — Total sessions / total students (or over last 30 days).
- Cards link to table with that filter applied (e.g. “At risk” → filter “Last active > 7 days”).

### Students table

- **Columns:** Student (name/email), Board, Grade, **Sessions** (count), **Last active** (date), **Topics completed** (or mastery summary if available), **Status** (Active / At risk / Inactive).
- **Filters:** Board, Grade, “Last active” (e.g. &lt;7d, 7–14d, &gt;14d), “Status.”
- **Sort:** Last active, sessions, name.
- **Row click or “View”** → Per-student drilldown page.

### Per-student drilldown page

- **Route:** e.g. `/admin/students/[id]` or `/admin/learning/students/[id]`.
- **Sections:**
  - **Profile:** Name, email, board, grade, signup (read-only).
  - **Activity:** Sessions count, last session date, questions answered (recent or total).
  - **Progress:** Topics studied (list or bar), weak topics (link to Weak Topic Monitoring filtered by this student).
  - **Recent activity:** Last 5–10 sessions (topic, date, phase or outcome if available).
- **Links:** “View recommendation trace,” “View weak topics,” “View in parent report scope” (if applicable).
- No redesign of student app; data from existing APIs (sessions, progress, weak topics, traces).

---

## SECTION 6 — Weak Topic Monitoring UX

**Purpose:** Topics where many students struggle; views by topic and by student, with severity. Fully new admin surface.

**Placement:** “Weak topic monitoring” in sidebar (Learning or General Admin). Route e.g. `/admin/weak-topics`.

**Layout: two views (tabs or toggles) + optional detail.**

### View 1 — By topic

- **Table:** Topic name, **Subject / Chapter**, **# Students with topic weak** (count), **Severity** (e.g. “High” when count &gt; threshold, “Medium,” “Low”), optional **Avg. mastery** (if available).
- **Sort:** By count descending (default), by severity, by topic name.
- **Filters:** Subject, Board/Grade.
- **Row click:** Expand or navigate to “Students with this topic weak” (list or link to Student Learning with filter).

### View 2 — By student

- **Table:** Student (name/email), **# Weak topics**, **Weak topic names** (truncated list or tooltip), **Severity** (e.g. “High” when weak count &gt; 3).
- **Sort:** By # weak topics descending, by student name.
- **Filters:** Board, Grade, Subject (students who have at least one weak topic in that subject).
- **Row click:** Link to per-student drilldown (Student Learning) or in-page list of weak topics for that student.

### Severity

- **Definition in UI:** e.g. “High = topic weak for &gt;20 students” or “High = student has &gt;3 weak topics.” Single line or tooltip so admins know the rule.
- **Visual:** Badge or color (red / amber / yellow) on severity column; optional filter by severity.

### Optional: export

- “Export by topic” (topic, subject, count) and “Export by student” (student, weak topic list) as CSV.
- Button above table; no change to backend if data is already loaded (client-side export).

---

## SECTION 7 — Recommendation Engine Debugging UX

**Purpose:** Rule distribution, trace viewer, and student-level simulation. Extends existing Recommendation Traces page and API.

**Placement:** “Recommendation debugging” or “Recommendation traces” in sidebar (e.g. under “Learning” or “Debug”). Route e.g. `/admin/recommendations` (existing) or `/admin/recommendation-debug`. Ensure it is **in** the sidebar (gap from audit).

**Layout: rule distribution + trace viewer + simulation.**

### Rule distribution (top or side card)

- **Summary:** Last 24h (or configurable range): count per rule (P0–P6) — e.g. “P0 homework_pending: 12, P1 resume_session: 45, P2 weak_topic_urgent: 8, …”.
- **Display:** Horizontal bar chart or table; highlight highest.
- **Purpose:** Spot drift (e.g. one rule dominating) or validate engine behavior.
- Data from new aggregate API (e.g. from stored traces or sampling) or from existing traces list if available.

### Trace viewer (main)

- **Student selector:** Search by email or id; dropdown or typeahead.
- **Date / time range:** Optional filter for “traces in last N hours.”
- **Result:** Show **latest trace** for selected student (or list of traces, then select one).
- **Trace content:** Same as today — rules evaluated, matched rule, final decision, topic scoring breakdown (if P5).
- **Status banner:** When ENABLE_RECOMMENDATION_TRACE is off: “Tracing is disabled. Enable to see traces.” No redesign of trace schema.

### Student-level simulation (optional)

- **Control:** “Simulate” or “Get current recommendation” button next to student selector.
- **Action:** Calls getNextAction (or read-only API that does so) for that student and displays result (same shape as trace final decision) **without** persisting or changing state.
- **Display:** Same card layout as “Final decision” in trace viewer; label “Simulation (no state change).”
- For support: “What would this student see on the dashboard right now?”

---

## SECTION 8 — Parent Report Monitoring UX

**Purpose:** Students with linked parents, weekly report status, last run, and global enable/disable. New admin surface.

**Placement:** “Parent reporting” in sidebar (e.g. General Admin). Route e.g. `/admin/parent-reporting`.

**Layout: scope list + status + global toggle.**

### Scope and status (main)

- **Summary cards:** (1) **Students with linked parents** — count. (2) **Reports generated this week** — count (from WeeklyStudentSummary or job result). (3) **Last run** — timestamp of last weekly job run (from job log or stored timestamp).
- **Table:** Student (name/email), **Parent linked** (Y/N or parent email), **Last report week** (e.g. “Week of 4 Mar”), **Status** (e.g. “Generated” / “Pending” / “Skipped”).
- **Filters:** Board, Grade; optional “Has report this week” (Y/N).
- **Sort:** By last report week, by student name.
- **Export:** Optional “Export list” (students with linked parents) as CSV.

### Global enable/disable toggle

- **Control:** “Weekly parent reports” — toggle On / Off.
- **When Off:** Label “Reports paused. No reports will be generated until turned on.” Job (weeklyParentSummary) checks this flag and skips generation or exits early.
- **When On:** Normal behavior.
- **Placement:** Top of page or in a “Settings” card; prominent so ops can pause during incident.

### Optional: per-student opt-out

- **Column or action:** “Exclude from reports” per student (if backend supports).
- **UI:** Checkbox or switch per row; “Excluded” badge when set.
- If not in scope for v1, omit; global toggle is minimum.

---

## SECTION 9 — Learning Outcome Analytics UX

**Purpose:** Average accuracy by subject, mastery improvement trends, topics with highest improvement; filters (board, grade, subject, date range). New admin surface.

**Placement:** “Learning outcomes” or “Outcome analytics” in sidebar (Learning). Route e.g. `/admin/learning-outcomes`.

**Layout: filters + summary + tables/charts.**

### Filters (top strip)

- **Board** — Dropdown (optional “All”).
- **Grade** — Dropdown (optional “All”).
- **Subject** — Dropdown (optional “All”).
- **Date range** — From / To (e.g. last 7d, 30d, custom).
- “Apply” or auto-apply on change; all metrics below respect filters.

### Summary cards

- **Average accuracy by subject** — One card per subject (in scope), or a small bar chart: subject vs average accuracy (0–100%).
- **Mastery improvement trend** — Single series: e.g. “Weekly average mastery” or “% students improved” over time (line chart).
- **Topics with highest improvement** — Count or list; “Top 10 topics by improvement (this period).”

### Tables / charts

- **By subject:** Table Subject, **Avg. accuracy**, **Avg. mastery** (if available), **# Students**, **Trend** (e.g. up/down vs previous period).
- **By topic (optional):** Topic, Subject, **Improvement** (e.g. delta or % improved), **Students** — for “topics with highest improvement.”
- **Trend chart:** X = time (week/date), Y = aggregate metric (accuracy or mastery); one line or stacked.
- Data from LearningOutcomeService or equivalent read-only API (aggregates only; no PII in export if needed).

### Export

- Optional “Export summary” (subject, avg accuracy, trend) and “Export top topics” as CSV for reporting.

---

## SECTION 10 — System Health UX

**Purpose:** Unified health dashboard aggregating workers, queues, Redis, and alerts. Complements existing Workers, Queue, Redis, Metrics, Alerts pages.

**Placement:** “System health” or “Status” in sidebar (System Monitoring); can be first item. Route e.g. `/admin/health` or `/admin/system/health`. Existing system/metrics, system/alerts, content-engine/workers, queue, redis remain; this is the **aggregate** view.

**Layout: health grid + alerts + runbook.**

### Health grid (main)

- **Cards, one per subsystem:**
  - **Workers** — Status (e.g. “Running” / “Degraded” / “Down”), count (e.g. “3 active”).
  - **Queue** — Status, depth (e.g. “12 jobs”), oldest job age (e.g. “5m”).
  - **Redis** — Status (e.g. “Connected” / “Disconnected”).
  - **Content engine** — Status (e.g. “Ok” / “Degraded”), optional “Last job completed.”
  - **Orchestrator** — Status (e.g. “Running” / “Stopped”).
- **Visual:** Each card has a **status indicator** (e.g. green / amber / red dot or icon).
- **Thresholds:** Documented in UI (e.g. “Queue depth &gt; 100 = amber, &gt; 500 = red”).
- **Click card** → Link to existing detail page (Workers, Queue, Redis, etc.).

### Alerts strip (below grid)

- **Active alerts** — Last 5–10 alerts (type, severity, message, time); “All alerts” link to System Alerts page.
- **Badge:** Count of active alerts on “System health” in sidebar (red when &gt; 0).
- No redesign of alert schema; consume existing alerts API.

### Runbook / help (footer or side)

- **Short “What to do”** for common cases:
  - “Queue backing up” → Check workers and Redis; consider scaling workers.
  - “High failed jobs” → Open Execution Jobs, filter Failed, retry or inspect logs.
  - “Redis down” → Check Redis connection and restart if needed.
- Link to full runbook doc if it exists; otherwise 3–5 bullets on the page.

### Refresh

- **Auto-refresh:** e.g. every 30s or 1m for health grid and alerts.
- **Manual:** “Refresh” button.
- Reuse existing telemetry and status APIs; no new backend for v1 beyond optional “health” aggregate endpoint that returns status of each subsystem.

---

## Cross-cutting UX

- **Sidebar:** Add or rename items so all 10 areas are reachable: Dashboard, Curriculum hub, Content readiness, Moderation queue, Student learning, Weak topics, Recommendation debugging, Parent reporting, Learning outcomes, System health. Group under “Learning,” “Content,” “System” as in current AdminSidebar pattern.
- **Breadcrumbs:** Every inner page (e.g. student drilldown, topic detail): “Admin > Student learning > [Student name].”
- **Empty states:** “No data” or “Enable X to see data” with short guidance (e.g. ENABLE_RECOMMENDATION_TRACE for traces).
- **Loading:** Skeleton or spinner for tables and cards; no blocking full-page loader where possible.
- **Errors:** Toast or inline message; “Retry” for failed fetches.
- **Accessibility:** Labels, aria-live for counts, keyboard navigation for tables and modals.
- **Mobile:** Summary cards and key actions usable on small screens; complex tables can scroll horizontally or collapse to list.

---

_End of Admin Console UX design. No code generated; existing systems unchanged; new surfaces designed to plug into current APIs and navigation._
