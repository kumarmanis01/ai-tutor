<!--
FILE OBJECTIVE:
- Jira tasks for the Admin Journey: implementable, testable, and trackable work items with acceptance criteria.

LINKED UNIT TEST:
- tests/unit/docs/V3/Admin.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-23T12:00:00Z | copilot | add standard file header
-->

# Jira Tasks: Admin Journey (Implementable & Trackable)

Here are your Jira tasks broken down by epic, ready for import. Each task includes acceptance criteria, story points, dependencies, and technical notes.

---

## Epic: Admin Access Control & Security

**Epic Goal:** Secure, role-based admin access with MFA and audit trails.

---

### TASK-ADMIN-001: Super Admin Creates Admin Accounts

| Field | Value |
|-------|-------|
| **Summary** | Super Admin can create admin accounts with specific roles via secure interface |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Admin panel at `admin.spinzy.academy/team` accessible only to Super Admin
- [ ] "Add Admin" button opens modal with fields: Email (work domain only, block Gmail/Yahoo), Name, Role dropdown (Content Admin / Support Admin)
- [ ] Email validation: No existing admin account with same email; No parent account with same email (block with message)
- [ ] On submit: Create admin record with `status='invited'`, generate unique invite token (expires 24 hours)
- [ ] Send invite email with setup link: `admin.spinzy.academy/setup?token=xxx`
- [ ] Invite email includes: Admin name, role, expiry warning, company logo
- [ ] Log action in `admin_audit_log` with `action='admin.create'`

**Technical notes:**
- Table: `admins` (id, email, name, role, status, password_hash, mfa_secret, created_by, created_at, last_login_at)
- Table: `admin_invites` (id, email, token, expires_at, used_at)
- Email template: Admin Invite (with 24-hour expiry)

---

### TASK-ADMIN-002: Admin Account Setup & MFA Enrollment

| Field | Value |
|-------|-------|
| **Summary** | Invited admin sets up password and MFA via time-limited link |
| **Story Points** | 3 |
| **Priority** | P0 |
| **Dependencies** | TASK-ADMIN-001 |

**Acceptance Criteria:**
- [ ] Setup link loads page with token validation (404 if expired/invalid)
- [ ] Step 1: Set password (min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)
- [ ] Step 2: Show QR code for TOTP (Google Authenticator / Microsoft Authenticator)
- [ ] Step 3: Verify TOTP code (6 digits, 30-second window)
- [ ] On success: Update admin `status='active'`, store `mfa_secret` (encrypted), set `password_changed_at`
- [ ] Redirect to admin login page with success message
- [ ] Backup codes generated (8 codes, single-use, store hashed)
- [ ] Require backup codes download before completing setup

**Technical notes:**
- Use `speakeasy` or `otplib` for TOTP
- Backup codes: Generate 8 random 8-character codes, hash before storing

---

### TASK-ADMIN-003: Admin Login with MFA

| Field | Value |
|-------|-------|
| **Summary** | Admin logs in via dedicated subdomain with email, password, and TOTP |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-ADMIN-002 |

**Acceptance Criteria:**
- [ ] Login page ONLY at `admin.spinzy.academy` (separate subdomain)
- [ ] Fields: Email, Password, TOTP code (6 digits)
- [ ] "Remember this device" checkbox (skips MFA for 30 days on same browser/IP)
- [ ] Failed attempts: 3 failures → 15-minute lockout; 5 failures → alert Super Admin via email
- [ ] On success: Create session with 30-minute timeout, update `last_login_at`, `last_login_ip`
- [ ] On any failure: Generic error "Invalid credentials" (no user enumeration)
- [ ] Session stored in `admin_sessions` table with `session_token` (HTTP-only cookie, Secure flag)
- [ ] Log `action='admin.login'` in audit log (success and failure attempts)

**Technical notes:**
- Rate limiting: 5 attempts per 15 minutes per IP + per email
- Session refresh on activity (extend expiry)
- IP whitelist check: Optional env `ADMIN_ALLOWED_IPS` (comma-separated)

---

### TASK-ADMIN-004: Role-Based Access Control (RBAC)

| Field | Value |
|-------|-------|
| **Summary** | Granular permissions enforced per admin role across all endpoints and UI |
| **Story Points** | 8 |
| **Priority** | P1 |
| **Dependencies** | TASK-ADMIN-003 |

**Acceptance Criteria:**
- [ ] Permission matrix implemented in middleware:

| Permission | Content Admin | Support Admin | Super Admin |
|------------|---------------|---------------|-------------|
| View analytics dashboard | ✅ | ✅ | ✅ |
| Approve/reject content | ✅ | ❌ | ✅ |
| Edit pre-generated content | ✅ | ❌ | ✅ |
| Delete content | ❌ | ❌ | ✅ |
| View user profiles (full) | ❌ (anonymized) | ✅ | ✅ |
| Manual user verification | ❌ | ✅ | ✅ |
| Consent dispute resolution | ❌ | ✅ | ✅ |
| View billing/revenue | ❌ | ❌ | ✅ |
| Create/delete admin accounts | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |

- [ ] API endpoints return `403 Forbidden` with `{"error": "Insufficient permissions"}`
- [ ] UI elements (buttons, tabs, menu items) hidden based on role (not just disabled)
- [ ] Super Admin can override any permission temporarily (logged in audit)
- [ ] Role change triggers email notification to affected admin

**Technical notes:**
- Middleware: `requirePermission(permission: string)`
- Cache permissions in Redis for 5 minutes

---

### TASK-ADMIN-005: Admin Action Audit Log

| Field | Value |
|-------|-------|
| **Summary** | Immutable, searchable audit log of all admin actions |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-ADMIN-003 |

**Acceptance Criteria:**
- [ ] Audit log table: `admin_audit_log` with fields: id, admin_id, admin_email, action, target_type, target_id, details (JSON), ip_address, user_agent, created_at
- [ ] Action types logged: `admin.login`, `admin.logout`, `admin.create`, `admin.delete`, `admin.role_change`, `user.manual_verify`, `consent.override`, `content.approve`, `content.reject`, `content.edit`, `content.delete`, `broadcast.send`
- [ ] Audit log view at `admin.spinzy.academy/audit` (Super Admin only)
- [ ] Search/filter by: Admin, Action Type, Target, Date Range
- [ ] Export as CSV or PDF
- [ ] Log is append-only (no DELETE/UPDATE on audit table)
- [ ] Retention: 7 years (DPDP compliance)

**Technical notes:**
- Use database trigger to prevent updates/deletes on audit table
- Separate database user for audit writes with limited permissions

---

## Epic: Content Moderation

**Epic Goal:** Efficient review and management of pre-generated and AI-generated content.

---

### TASK-ADMIN-006: Content Moderation Dashboard

| Field | Value |
|-------|-------|
| **Summary** | Prioritized dashboard of content requiring review |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | Student Journey TASK-016 |

**Acceptance Criteria:**
- [ ] Dashboard URL: `admin.spinzy.academy/content/moderation`
- [ ] Default sort: "Pending Review" by "Student Request Count" descending
- [ ] Table columns: Topic Name, Subject, Grade, Board, Content Type, Request Count, Status, Date Generated, Generator Type
- [ ] Filters: Subject, Grade, Board, Content Type (AI/Pre-gen), Status (Pending/Approved/Rejected)
- [ ] Search: By topic name or keyword (full-text)
- [ ] Batch actions: Checkbox select → "Approve Selected" / "Reject Selected" modal with reason
- [ ] Pagination: 25/50/100 per page
- [ ] Auto-refresh every 60 seconds (optional toggle)

**Technical notes:**
- API: `GET /api/admin/content/pending?sort=request_count&order=desc`
- Request count from `content_requests` table (students requesting topic)

---

### TASK-ADMIN-007: Content Review Interface (Side-by-Side)

| Field | Value |
|-------|-------|
| **Summary** | Rich preview with edit capabilities for content review |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-ADMIN-006 |

**Acceptance Criteria:**
- [ ] Split-panel layout:
  - Left panel: Rendered content preview (exactly as student sees)
  - Right panel: Markdown/HTML editor with source
- [ ] Editor toolbar: Bold, Italic, Headings (H2/H3), Lists (UL/OL), Tables, Image upload, LaTeX ($$...$$)
- [ ] AI-generated content shows badge: "🤖 AI-Generated - Beta" at top of preview
- [ ] Three sticky action buttons at bottom:
  - **Approve** (Green) → Moves to `status='published'`, removes Beta badge, sends notification to requesting students
  - **Reject** (Red) → Opens reason modal (Inaccurate/Inappropriate/Duplicate/Other), hides from students, notifies requester
  - **Request Revision** (Amber) → Opens notes field, sends back to AI queue with admin notes
- [ ] "Save Draft" button for partial edits (status unchanged)
- [ ] Changes logged in content version history

**Technical notes:**
- Use TipTap or Toast UI Editor for Markdown editing
- LaTeX rendering: KaTeX or MathJax

---

### TASK-ADMIN-008: Bulk Content Upload (CSV/JSON)

| Field | Value |
|-------|-------|
| **Summary** | Bulk upload pre-generated content via CSV/JSON with validation |
| **Story Points** | 8 |
| **Priority** | P1 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Upload interface: `admin.spinzy.academy/content/upload`
- [ ] Accepted formats: CSV, JSON, ZIP of Markdown files
- [ ] CSV template downloadable from interface
- [ ] CSV columns: board, grade, subject, chapter, topic, content_markdown, tags (pipe-separated)
- [ ] Validation before import:
  - Required fields check (board, grade, subject, topic, content)
  - Duplicate check: Same board/grade/subject/topic → flag with warning
  - Markdown validity check (no unclosed tags, valid LaTeX)
  - Grade validation (1-12 integer)
- [ ] Valid rows: Import with `status='published'`, `source='admin_upload'`
- [ ] Invalid rows: Show error report with row number + reason, downloadable as CSV
- [ ] Progress bar for large files (max 50MB, max 5,000 rows)
- [ ] Email notification on upload completion (success/failure)

**Technical notes:**
- Use `multer` for file upload (Node.js) or `paper_trail` (Rails)
- Process in background queue (Bull/Redis)

---

### TASK-ADMIN-009: Content Version History & Rollback

| Field | Value |
|-------|-------|
| **Summary** | View version history and roll back to any previous version |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-ADMIN-007 |

**Acceptance Criteria:**
- [ ] "Version History" tab in content review interface
- [ ] Each version shows: Version number, Editor (Admin email or "AI-v1.2"), Timestamp, Change summary (first 100 chars)
- [ ] Current version highlighted with green badge
- [ ] "Restore This Version" button for any past version
- [ ] Restoring creates NEW version (preserves full history)
- [ ] Live version always marked `is_current=true`
- [ ] Diff view between versions (optional, P2)

**Technical notes:**
- Table: `content_versions` (id, content_id, version_number, content_markdown, created_by, created_at, change_summary, is_current)
- Use JSON diff library for change detection

---

### TASK-ADMIN-010: Content Flagging by Users

| Field | Value |
|-------|-------|
| **Summary** | Students/Parents can flag content; Admin reviews and resolves |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-ADMIN-007 |

**Acceptance Criteria:**
- [ ] Student/Parent sees flag icon on every content piece: "Report an issue"
- [ ] Options: Factual Error / Typo/Grammar / Too Difficult / Too Easy / Inappropriate / Other
- [ ] Optional text field: "Describe the issue"
- [ ] Flagged content appears in moderation dashboard under filter "Flagged by Users"
- [ ] Flag count badge on content card (e.g., "Flagged 3 times")
- [ ] Resolution actions:
  - **Dismiss Flag** (if inaccurate report) → Flag status='resolved', resolution='dismissed'
  - **Acknowledge & Edit** → Opens editor, after save flag status='resolved', resolution='fixed'
- [ ] Reporter receives email notification when flag resolved (optional opt-out)
- [ ] Table: `content_flags` (id, content_id, user_id, flag_reason, description, status, resolved_by, resolved_at)

---

## Epic: User Support & Escalations

**Epic Goal:** Efficient user issue resolution without engineering intervention.

---

### TASK-ADMIN-011: User Search & Profile View

| Field | Value |
|-------|-------|
| **Summary** | Search users by email/phone/child name with role-based visibility |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-ADMIN-004 |

**Acceptance Criteria:**
- [ ] Search bar at top of admin panel (Support Admin + Super Admin)
- [ ] Search by: Email, Phone (partial), Parent name, Child name
- [ ] Results table: Account status, Parent name, Child name(s), Created date, Last active
- [ ] Click user → Detailed profile view:

| Section | Content Admin (anonymized) | Support Admin (full) |
|---------|---------------------------|---------------------|
| Account Info | Email masked (a***@domain.com) | Full email + phone |
| Child Profiles | Name, Grade, Board, Consent Status | + Last active, Total time, Accuracy % |
| Activity Log | ❌ Not visible | Last 20 actions |
| Subscription | Active/Expired only | + Plan type, payment history |

- [ ] "Export User Data" button (GDPR/DPDP compliance)
- [ ] "Suspend Account" button (Support Admin+)

**Technical notes:**
- API: `GET /api/admin/users/search?q=...`
- Full-text search on `users.email`, `profiles.name`
- Masking: `email.replace(/(.{2}).*(@.*)/, '$1***$2')`

---

### TASK-ADMIN-012: Manual Login Verification (OTP Bypass)

| Field | Value |
|-------|-------|
| **Summary** | Support Admin can manually verify account for 15 minutes |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-ADMIN-011 |

**Acceptance Criteria:**
- [ ] User profile → "Actions" dropdown → "Verify Account Manually"
- [ ] Confirmation modal: "This will bypass email OTP for 15 minutes. Confirm?" + Reason text field (required)
- [ ] On confirm: Set `users.manual_verification_expires_at = NOW() + 15 minutes`
- [ ] User can now log in without OTP for 15 minutes
- [ ] Action logged in `admin_audit_log` with: admin_id, user_id, reason, timestamp
- [ ] Super Admin alert if any admin performs >10 manual verifications in 24 hours (fraud detection)
- [ ] After expiry, OTP requirement resumes automatically

**Technical notes:**
- Login middleware checks: `manual_verification_expires_at > NOW()` before requiring OTP

---

### TASK-ADMIN-013: Consent Dispute Resolution

| Field | Value |
|-------|-------|
| **Summary** | Handle consent disputes with audit-compliant overrides |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-ADMIN-011 |

**Acceptance Criteria:**
- [ ] User profile → "Consent" section → "Resolve Dispute" button (Support Admin+)
- [ ] Three resolution paths:
  1. **Re-send Consent Email** → Trigger new consent email to parent (logged)
  2. **Override Denial** → Set `consent_status='granted'`. Requires: Admin notes, Parent confirmation via email reply, Super Admin approval
  3. **Revoke Consent** → Set `consent_status='revoked'`, freeze child profile immediately
- [ ] All actions require reason text and logged in `consent_audit_log` with admin_id
- [ ] Monthly DPDP audit report includes all consent overrides
- [ ] Parent receives email notification of any consent status change

**Technical notes:**
- Table: `consent_audit_log` (id, profile_id, previous_status, new_status, reason, admin_id, created_at, parent_confirmation_flag)

---

### TASK-ADMIN-014: Bulk User Notification (Email/Push)

| Field | Value |
|-------|-------|
| **Summary** | Send targeted communications to user segments (requires Super Admin approval) |
| **Story Points** | 8 |
| **Priority** | P2 |
| **Dependencies** | TASK-ADMIN-004 |

**Acceptance Criteria:**
- [ ] Feature at `admin.spinzy.academy/communications`
- [ ] Requires Super Admin approval workflow: Draft → Submit for Approval → Approve/Reject
- [ ] Target segments:
  - By Board: CBSE / ICSE / State Board
  - By Grade: 1-12 (multi-select)
  - By Subscription: Free / Premium / Trial / Expired
  - By Activity: Active last 7 days / Inactive >30 days
- [ ] Compose: Subject, Body (HTML supported), Preview with template variables: `{{parent_name}}`, `{{child_name}}`
- [ ] "Send Test" to admin's own email before broadcast
- [ ] Scheduling: Send now or schedule date/time (IST timezone)
- [ ] Rate limiting: Max 1 broadcast per segment per week
- [ ] Unsubscribe link auto-appended to all emails
- [ ] Delivery tracking: Sent count, open rate, click rate (optional, P3)

**Technical notes:**
- Use existing email service + push notification service
- Queue broadcast jobs to avoid rate limits

---

## Epic: Analytics & Platform Health

**Epic Goal:** Data-driven decision making for growth and quality.

---

### TASK-ADMIN-015: Executive Dashboard (Core KPIs)

| Field | Value |
|-------|-------|
| **Summary** | Real-time dashboard with key platform metrics |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | Student Journey, Parent Journey completion |

**Acceptance Criteria:**
- [ ] Dashboard URL: `admin.spinzy.academy/analytics`
- [ ] Time filter: Today / This Week / This Month / Custom Range
- [ ] Metric cards (refresh every 30 seconds, manual refresh button):

| Metric | Definition |
|--------|------------|
| Total Accounts | Unique parent accounts |
| Total Active Students | Child profiles with ≥1 session in period |
| DAU | Students active today |
| WAU | Students active this week |
| Free → Premium Conversion % | Free parents who upgraded |
| Churn Rate | Premium parents who cancelled |
| Avg. Session Duration | Average time per student session |
| Content Pieces Generated | AI content generated in period |
| Content Approval Rate | % of AI content approved vs rejected |
| Top 5 Most Requested Topics | Highest on-demand request count |
| Flagged Content Count | Unresolved flags |

- [ ] Each metric card clickable → drill-down to detailed view
- [ ] Export dashboard as PDF (Schedule: weekly email to Super Admin)

**Technical notes:**
- Pre-aggregate daily metrics into `daily_platform_metrics` table
- Use Chart.js or Recharts for visualizations

---

### TASK-ADMIN-016: Content Performance Analytics

| Field | Value |
|-------|-------|
| **Summary** | Analyze which content pieces are most/least effective |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-ADMIN-015 |

**Acceptance Criteria:**
- [ ] Table: Topic Name, Views, Avg. Time Spent, Avg. Practice Accuracy, Flag Count, Status
- [ ] Sort by: "Lowest Avg. Accuracy" (identify confusing content)
- [ ] Filters: AI-Generated vs Pre-Generated, Subject, Grade
- [ ] "Edit" button directly from table for underperforming content
- [ ] Export as CSV
- [ ] Content Health Score: Weighted formula (Accuracy * 0.5 + Views * 0.3 + Flag inverse * 0.2)

**Technical notes:**
- Aggregate from `lesson_views`, `practice_attempts`, `content_flags`

---

### TASK-ADMIN-017: Revenue Dashboard (Super Admin Only)

| Field | Value |
|-------|-------|
| **Summary** | View revenue, subscription metrics, payment failures |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-ADMIN-015, Parent Journey TASK-015 |

**Acceptance Criteria:**
- [ ] Strictly Super Admin only (403 for other roles)
- [ ] Metrics:
  - MRR (Monthly Recurring Revenue)
  - ARR (Annual Run Rate)
  - ARPU (Avg Revenue Per User)
  - LTV estimate (Avg subscription duration × ARPU)
  - Plan distribution: Monthly vs Annual (pie chart)
  - Active vs Expired vs Trial subscriptions
- [ ] Payment failure rate: % of failed payments, broken down by UPI / Card
- [ ] Refund rate: % of payments refunded, with reason categorization
- [ ] Chart: Revenue trend (last 12 months)
- [ ] Export as CSV for finance team

**Technical notes:**
- Data from `subscriptions`, `payments`, `refunds` tables

---

### TASK-ADMIN-018: DPDP Compliance Audit Dashboard

| Field | Value |
|-------|-------|
| **Summary** | Compliance metrics and report generation for DPDP Act |
| **Story Points** | 8 |
| **Priority** | P2 |
| **Dependencies** | Parent Journey TASK-005, TASK-006 |

**Acceptance Criteria:**
- [ ] Dashboard at `admin.spinzy.academy/compliance`
- [ ] Metrics displayed:
  - Total consent requests sent
  - Consent approval rate %
  - Consent denial rate %
  - Avg time to consent (request → approval)
  - Data deletion requests received and fulfilled
  - User data export requests received and fulfilled
  - Flagged content by reason category (bar chart)
  - Consent overrides by admins (count, with audit drill-down)
- [ ] "Generate Compliance Report" button → PDF with:
  - All metrics for selected date range
  - Full audit log summary
  - Digital signature (hash of report stored in DB)
- [ ] Report retention: Minimum 7 years
- [ ] Schedule: Auto-generate monthly report, email to Super Admin

**Technical notes:**
- Use Puppeteer or PDFKit for PDF generation
- Store report hash in `compliance_reports` table for tamper-proof audit

---

## Epic: Operational Efficiency

**Epic Goal:** Automate queue management and content lifecycle.

---

### TASK-ADMIN-019: AI Generation Queue Monitoring

| Field | Value |
|-------|-------|
| **Summary** | Real-time monitoring of AI content generation queue |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | Student Journey TASK-015 |

**Acceptance Criteria:**
- [ ] Queue Dashboard: `admin.spinzy.academy/queue`
- [ ] Metrics:
  - Jobs in Queue (Pending)
  - Jobs Processing (In Progress)
  - Jobs Completed (Today)
  - Jobs Failed (Today)
  - Avg. Generation Time (seconds)
- [ ] Failed jobs table: Topic, Error Message, Retry Count, Date
- [ ] Actions per failed job: "Retry" / "Cancel" / "View Details"
- [ ] Cost Estimator: Estimated AI API cost for today (token count × cost per token)
- [ ] Alert: Email Content Admin if queue depth > 50 pending jobs
- [ ] Auto-retry failed jobs: 3 retries with exponential backoff (1min, 5min, 15min)

**Technical notes:**
- Use Bull/Redis dashboard or custom UI
- Track token usage from AI provider response headers

---

### TASK-ADMIN-020: Automated Content Expiry & Archival

| Field | Value |
|-------|-------|
| **Summary** | Set expiry dates for time-sensitive content; auto-archive |
| **Story Points** | 3 |
| **Priority** | P2 |
| **Dependencies** | TASK-ADMIN-007 |

**Acceptance Criteria:**
- [ ] Content upload/creation includes optional "Expiry Date" field (date picker)
- [ ] On expiry date: Content status changes to `archived` (hidden from students, visible to admins)
- [ ] 7 days before expiry: Admin email alert "3 topics expiring soon: [Topic Names]"
- [ ] Expired content can be "Reactivated" with new expiry date (or set to permanent)
- [ ] Archived content not deleted (preserves analytics and student history)
- [ ] Bulk archive: Select multiple → "Archive Selected"

---

### TASK-ADMIN-021: Automated Content Tagging & Taxonomy

| Field | Value |
|-------|-------|
| **Summary** | AI auto-suggests tags and taxonomy for uploaded content |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-ADMIN-007 |

**Acceptance Criteria:**
- [ ] On content upload/generation, system auto-suggests:
  - Subject (based on keyword analysis)
  - Chapter (match against existing taxonomy)
  - Topic name normalization (remove duplicates, fix plurals)
  - Difficulty Level (Easy/Medium/Hard based on vocabulary complexity)
  - Related Topics (max 3, for "You might also like")
- [ ] Admin can accept suggestions with one click (checkbox) or override manually
- [ ] Taxonomy consistency check: Warn if new topic name >80% similar to existing topic (Levenshtein distance)
- [ ] Auto-suggestions use lightweight ML (e.g., sentence-transformers) or keyword matching

**Technical notes:**
- Use pgvector for similarity search against existing topics
- Difficulty heuristic: average word length + sentence complexity

---

## Epic: Incident Response

**Epic Goal:** Communicate platform issues and maintain transparency.

---

### TASK-ADMIN-022: Platform Status Page Management

| Field | Value |
|-------|-------|
| **Summary** | Update public status page during outages/maintenance |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Status page at `status.spinzy.academy` (separate subdomain, cached/CDN)
- [ ] Admin can (from main admin panel):
  - Create incident: Title, Description, Affected Services (Login / Practice / Content / Payments)
  - Update status: Investigating → Identified → Monitoring → Resolved
  - Schedule maintenance: Date, Time, Duration, Affected Services, Impact (e.g., "Read-only mode")
- [ ] Major incidents: "Notify All Users" checkbox → sends email to all active users (requires Super Admin approval)
- [ ] Status page auto-refreshes every 30 seconds
- [ ] Uptime history: Last 90 days (green/yellow/red per day)

**Technical notes:**
- Use separate lightweight service (e.g., GitHub Pages + JSON API) to avoid dependency on main platform
- Status updates stored in `incidents` table

---

### TASK-ADMIN-023: System Health Monitoring & Alerts

| Field | Value |
|-------|-------|
| **Summary** | Monitor critical paths and alert admins on failures |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Health checks running every minute:
  - Login API (`/api/health/auth`) → 200 expected
  - Content API (`/api/health/content`) → 200 expected
  - Practice API (`/api/health/practice`) → 200 expected
  - Database connectivity (PostgreSQL)
  - Redis connectivity
  - AI provider API (mock endpoint)
- [ ] Alert channels: Email (Content Admin + Super Admin) + Slack webhook (optional)
- [ ] Alert thresholds:
  - Error rate >5% over 5 minutes
  - P99 latency >3 seconds over 5 minutes
  - Health check failure for >2 consecutive checks
  - AI generation failure rate >20% over 1 hour
- [ ] Dashboard: Service status cards (green/yellow/red) with last check timestamp
- [ ] Incident auto-creation: On health check failure, create draft incident in status page

**Technical notes:**
- Use existing monitoring tool (e.g., UptimeRobot, Better Stack) OR build lightweight cron + alert system

---

## Summary: Admin Tasks by Priority

| Priority | Task IDs | Total Points |
|----------|----------|--------------|
| **P0 (MVP)** | ADMIN-001, 002, 003, 006, 007, 011, 015 | 42 |
| **P1 (Sprint 4-6)** | ADMIN-004, 008, 009, 012, 013, 016, 017, 019, 022, 023 | 57 |
| **P2 (Post-Launch)** | ADMIN-005, 010, 014, 018, 020, 021 | 33 |

**Total: 132 points**

---

## Jira Import CSV

```csv
Summary,Description,Story Points,Priority,Epic Link,Labels
TASK-ADMIN-001: Super Admin Creates Admin Accounts,Super Admin can create admin accounts with specific roles via secure interface,5,Highest,Epic: Admin Access Control,mvp
TASK-ADMIN-002: Admin Account Setup & MFA Enrollment,Invited admin sets up password and MFA via time-limited link,3,Highest,Epic: Admin Access Control,mvp
TASK-ADMIN-003: Admin Login with MFA,Admin logs in via dedicated subdomain with email password and TOTP,5,Highest,Epic: Admin Access Control,mvp
TASK-ADMIN-004: Role-Based Access Control,Granular permissions enforced per admin role across all endpoints and UI,8,High,Epic: Admin Access Control,post-mvp
TASK-ADMIN-005: Admin Action Audit Log,Immutable searchable audit log of all admin actions,5,Medium,Epic: Admin Access Control,polish
TASK-ADMIN-006: Content Moderation Dashboard,Prioritized dashboard of content requiring review,8,Highest,Epic: Content Moderation,mvp
TASK-ADMIN-007: Content Review Interface,Rich preview with edit capabilities for content review,8,Highest,Epic: Content Moderation,mvp
TASK-ADMIN-008: Bulk Content Upload,Bulk upload pre-generated content via CSV/JSON with validation,8,High,Epic: Content Moderation,post-mvp
TASK-ADMIN-009: Content Version History & Rollback,View version history and roll back to any previous version,5,High,Epic: Content Moderation,post-mvp
TASK-ADMIN-010: Content Flagging by Users,Students/Parents can flag content; Admin reviews and resolves,5,Medium,Epic: Content Moderation,polish
TASK-ADMIN-011: User Search & Profile View,Search users by email/phone/child name with role-based visibility,8,Highest,Epic: User Support,mvp
TASK-ADMIN-012: Manual Login Verification,Support Admin can manually verify account for 15 minutes,3,High,Epic: User Support,post-mvp
TASK-ADMIN-013: Consent Dispute Resolution,Handle consent disputes with audit-compliant overrides,5,High,Epic: User Support,post-mvp
TASK-ADMIN-014: Bulk User Notification,Send targeted communications to user segments with approval workflow,8,Medium,Epic: User Support,polish
TASK-ADMIN-015: Executive Dashboard,Real-time dashboard with key platform metrics,8,Highest,Epic: Analytics,mvp
TASK-ADMIN-016: Content Performance Analytics,Analyze which content pieces are most and least effective,5,High,Epic: Analytics,post-mvp
TASK-ADMIN-017: Revenue Dashboard,View revenue subscription metrics payment failures (Super Admin only),5,High,Epic: Analytics,post-mvp
TASK-ADMIN-018: DPDP Compliance Audit Dashboard,Compliance metrics and report generation for DPDP Act,8,Medium,Epic: Analytics,polish
TASK-ADMIN-019: AI Generation Queue Monitoring,Real-time monitoring of AI content generation queue,5,High,Epic: Operations,post-mvp
TASK-ADMIN-020: Automated Content Expiry & Archival,Set expiry dates for time-sensitive content; auto-archive,3,Medium,Epic: Operations,polish
TASK-ADMIN-021: Automated Content Tagging,AI auto-suggests tags and taxonomy for uploaded content,5,Medium,Epic: Operations,polish
TASK-ADMIN-022: Platform Status Page Management,Update public status page during outages and maintenance,5,High,Epic: Incident Response,post-mvp
TASK-ADMIN-023: System Health Monitoring & Alerts,Monitor critical paths and alert admins on failures,5,High,Epic: Incident Response,post-mvp
```

---

## MVP Scope (Admin Journey)

For MVP (Sprint 1-3 with Student + Parent journeys):

| Task ID | Summary | Points |
|---------|---------|--------|
| ADMIN-001 | Super Admin creates admin accounts | 5 |
| ADMIN-002 | Admin account setup & MFA | 3 |
| ADMIN-003 | Admin login with MFA | 5 |
| ADMIN-006 | Content moderation dashboard | 8 |
| ADMIN-007 | Content review interface | 8 |
| ADMIN-011 | User search & profile view | 8 |
| ADMIN-015 | Executive dashboard (core KPIs) | 8 |

**MVP Total: 45 points** (Admin only)

---

## Admin Panel URL Structure

| Page | URL | Access |
|------|-----|--------|
| Login | `admin.spinzy.academy/login` | Public |
| Dashboard | `admin.spinzy.academy/` | All admins |
| Content Moderation | `admin.spinzy.academy/content/moderation` | Content Admin + Super |
| Content Upload | `admin.spinzy.academy/content/upload` | Content Admin + Super |
| User Search | `admin.spinzy.academy/users` | Support + Super |
| Analytics | `admin.spinzy.academy/analytics` | All admins |
| Revenue | `admin.spinzy.academy/revenue` | Super only |
| Compliance | `admin.spinzy.academy/compliance` | Super only |
| Queue Monitor | `admin.spinzy.academy/queue` | Content Admin + Super |
| Team Management | `admin.spinzy.academy/team` | Super only |
| Audit Log | `admin.spinzy.academy/audit` | Super only |
| Status Page Admin | `admin.spinzy.academy/status`

