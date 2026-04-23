## A0.1 | P0 | Super Admin Creates Admin Accounts
**ID:** A0.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As a Super Admin, I want to create admin accounts with specific roles via a secure interface so that only authorized users can access the admin panel.

### Acceptance Criteria
- [ ] Only Super Admin can access admin creation page
- [ ] Email field required and validated
- [ ] Free email domains are blocked
- [ ] Name must be 2–100 characters
- [ ] Role dropdown available (Content Admin, Support Admin)
- [ ] Admin created with INVITED status
- [ ] Invite token generated (24h expiry)
- [ ] Invite email sent
- [ ] Audit log entry created
- [ ] Admin list table visible
- [ ] Actions available (Resend, Suspend, Reactivate)

### Dev Tasks
- [ ] Build AdminTeamPage
- [ ] Build CreateAdminForm
- [ ] Build AdminListTable
- [ ] Create validation schema
- [ ] Implement POST API
- [ ] Setup email service
- [ ] Implement audit logging

### QA
- [ ] Only Super Admin access enforced
- [ ] Email validation works
- [ ] Duplicate email rejected
- [ ] Invite email delivered
- [ ] Audit logs recorded
- [ ] Table displays correctly

## A0.2 | P0 | Admin Accepts Invite & Sets Up Account
**ID:** A0.2
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As a newly invited admin, I want to receive an invite email, click a setup link, create a strong password, and enroll in MFA, so that I can securely access the admin panel.

### Acceptance Criteria
- [ ] Invite email sent with subject "You've been invited to join Spinzy Academy Admin Panel"
- [ ] Invite email contains admin name, role, setup link, and expiry notice (24 hours)
- [ ] Setup URL: https://admin.spinzy.academy/setup?token={invite_token}
- [ ] Invalid/expired token shows error message
- [ ] Valid token allows multi-step setup
- [ ] Password requirements: Min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
- [ ] Password strength meter (zxcvbn, score ≥ 3/4 required)
- [ ] Confirm password field with match validation
- [ ] QR code displayed for MFA enrollment
- [ ] Secret key provided for manual entry
- [ ] 6-digit code field to verify MFA enrollment
- [ ] 10 backup codes displayed (8-char hex, uppercase)
- [ ] Warning message: "Save these codes. You won't see them again."
- [ ] "Download as TXT" button for backup codes
- [ ] Checkbox: "I have saved my backup codes" enables "Complete Setup" button
- [ ] On complete setup: AdminUser.status = ACTIVE, mfa_enabled = true, invite_token = null
- [ ] Redirect to Admin Login page
- [ ] Audit log: admin.setup_complete

### Dev Tasks
- [ ] Create AdminSetupPage component (multi-step)
- [ ] Create PasswordStrengthMeter component
- [ ] Create MFAEnrollment component (QR + input)
- [ ] Create BackupCodesDisplay component
- [ ] Implement GET /api/v1/admin/setup/validate?token={token}
- [ ] Implement GET /api/v1/admin/setup/mfa-qr?token={token}
- [ ] Implement POST /api/v1/admin/setup/complete
- [ ] Implement bcrypt hashing for password (cost factor 12)
- [ ] Implement speakeasy.totp.verify with window:1

### QA
- [ ] Full setup flow works: token validation → password → MFA → backup codes → complete
- [ ] Weak password rejected with specific feedback
- [ ] MFA code validation: correct code passes, wrong code fails, expired code fails
- [ ] Backup codes shown once, not retrievable later
- [ ] Expired token shows clear error

## A0.3 | P0 | Admin Login with MFA
**ID:** A0.3
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As an admin, I want to log in via a dedicated subdomain with email, password, and TOTP-based MFA, so that the admin panel is protected from credential attacks.

### Acceptance Criteria
- [ ] Two-step login flow on admin.spinzy.academy/login
- [ ] Step 1: Email + Password fields with "Sign In" button
- [ ] Valid credentials return login_session_token (JWT, 5-min TTL, scope: MFA_REQUIRED)
- [ ] Invalid credentials show error message and increment failed attempt count
- [ ] 3 failed attempts → 15-minute lockout message
- [ ] 5 failed attempts → Super Admin email alert
- [ ] Step 2: 6-digit TOTP input (6 separate boxes, auto-advance, paste support)
- [ ] Valid TOTP returns access_token (JWT, 30-min TTL) + refresh_token (7-day TTL)
- [ ] Invalid TOTP shows error without incrementing failed_attempts
- [ ] "Use Backup Code" link toggles to backup code input (8-char)
- [ ] "Remember this device" checkbox returns device_token (JWT, 30-day TTL, bound to IP /24 subnet)
- [ ] Subsequent logins from same device + IP skip MFA
- [ ] Session timeout: 30 minutes inactivity → Auto-logout
- [ ] IP Whitelist: Access from non-whitelisted IP shows "Access Denied: Unauthorized Network"

### Dev Tasks
- [ ] Create AdminLoginPage component (two-step)
- [ ] Create LoginStep1 component (email + password)
- [ ] Create LoginStep2 component (MFA code + backup code toggle)
- [ ] Create OTPInput component (reusable: 6-digit, pasteable)
- [ ] Implement useAdminAuth hook
- [ ] Implement POST /api/v1/admin/auth/login
- [ ] Implement POST /api/v1/admin/auth/mfa
- [ ] Implement POST /api/v1/admin/auth/refresh
- [ ] Implement POST /api/v1/admin/auth/device
- [ ] Implement POST /api/v1/admin/auth/logout
- [ ] Implement lockout logic (3 failed → 15-min lockout)
- [ ] Implement IP whitelist middleware

### QA
- [ ] Full login flow: credentials → MFA → dashboard
- [ ] Invalid password increments counter and shows error
- [ ] 3 failed attempts triggers lockout
- [ ] 5 failed attempts alerts Super Admin
- [ ] MFA code: correct passes, wrong fails, expired fails
- [ ] Backup code works once and is removed from stored set
- [ ] "Remember this device" skips MFA on next login from same device + IP
- [ ] Session timeout works
- [ ] IP whitelist blocks unauthorized IPs

## A0.4 | P1 | Admin Role-Based Access Control (RBAC) Enforcement
**ID:** A0.4
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story
As a Super Admin, I want granular permissions enforced server-side for every admin action, so that Content Admins cannot access billing data, and Support Admins cannot delete content.

### Acceptance Criteria
- [ ] VIEW_ANALYTICS: Super Admin ✅, Content Admin ✅, Support Admin ✅
- [ ] VIEW_MODERATION_QUEUE: Super Admin ✅, Content Admin ✅, Support Admin ❌
- [ ] APPROVE_CONTENT: Super Admin ✅, Content Admin ✅, Support Admin ❌
- [ ] REJECT_CONTENT: Super Admin ✅, Content Admin ✅, Support Admin ❌
- [ ] EDIT_CONTENT: Super Admin ✅, Content Admin ✅, Support Admin ❌
- [ ] DELETE_CONTENT: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] BULK_UPLOAD_CONTENT: Super Admin ✅, Content Admin ✅, Support Admin ❌
- [ ] VIEW_USER_PROFILES: Super Admin ✅, Content Admin ❌ (anonymized), Support Admin ✅
- [ ] VIEW_USER_PII: Super Admin ✅, Content Admin ❌, Support Admin ✅
- [ ] MANUAL_VERIFY_USER: Super Admin ✅, Content Admin ❌, Support Admin ✅
- [ ] HANDLE_CONSENT_DISPUTE: Super Admin ✅, Content Admin ❌, Support Admin ✅
- [ ] CREATE_ADMIN: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] DELETE_ADMIN: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] SUSPEND_ADMIN: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] VIEW_REVENUE: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] VIEW_AUDIT_LOGS: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] GENERATE_COMPLIANCE_REPORT: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] SEND_BROADCAST: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] MANAGE_WHATSAPP_SETTINGS: Super Admin ✅, Content Admin ❌, Support Admin ❌
- [ ] requirePermission middleware reads admin.role from JWT
- [ ] Missing permission returns 403 with error message
- [ ] Frontend gates components behind usePermission(permission) hook

### Dev Tasks
- [ ] Create AdminPermission enum in shared package
- [ ] Create ROLE_PERMISSIONS map
- [ ] Create requirePermission middleware
- [ ] Create usePermission hook for frontend
- [ ] Audit all API routes and apply correct permission to each

### QA
- [ ] Content Admin cannot access /api/v1/admin/revenue (403)
- [ ] Support Admin cannot access /api/v1/admin/content/delete (403)
- [ ] UI hides forbidden buttons (not just disabled)
- [ ] Direct API calls without permission return 403

## A1.1 | P0 | Content Moderation Dashboard
**ID:** A1.1
**Labels:** P0, phase:content-moderation
**Phase:** Content Moderation

### User Story
As a Content Admin, I want a prioritized dashboard of all content requiring review, sorted by student demand, so that I can efficiently approve or reject the most requested topics first.

### Acceptance Criteria
- [ ] Dashboard at admin.spinzy.academy/content/moderation
- [ ] Default sort: "Pending Review" sorted by "Request Count" descending
- [ ] Columns: Topic Name, Subject/Grade/Board, Content Type, Request Count, Flag Count, Status, Date Submitted, Generator, Actions
- [ ] Filters sidebar: Subject (multi-select), Grade (range or multi-select), Board (CBSE/ICSE/State), Content Type, Status, Date Range
- [ ] Search bar: By topic name, keyword
- [ ] Batch actions: Select multiple rows via checkbox, "Approve All Selected", "Reject All Selected"
- [ ] Pagination: 20 rows per page
- [ ] Real-time updates: New AI-generated content appears without page refresh (WebSocket or polling every 30s)

### Dev Tasks
- [ ] Create ContentModerationPage component
- [ ] Create ModerationTable component (with checkbox selection)
- [ ] Create ModerationFilters component
- [ ] Create BatchActionBar component
- [ ] Implement GET /api/v1/admin/content/moderation (paginated, filterable, sortable)
- [ ] Implement POST /api/v1/admin/content/batch-action

### QA
- [ ] Dashboard loads within 2 seconds with 100+ items
- [ ] Default sort by request count works
- [ ] Filters apply correctly and combine with AND logic
- [ ] Batch approve/reject processes all selected items
- [ ] Real-time: New AI content appears within 30 seconds

## A1.2 | P0 | Content Review Interface — Side-by-Side Editor
**Labels:** P0, phase:content-moderation
**Phase:** Content Moderation

### User Story
As a Content Admin, I want to open any pending content in a side-by-side view (rendered preview + Markdown editor) and approve, reject, or request revision, so that I can review quality and make edits efficiently.

### Acceptance Criteria
- [ ] Left Panel (70%): Rendered content preview as student sees on mobile (320px mockup)
- [ ] Supports: Rich text, images, LaTeX equations, tables, videos
- [ ] Right Panel (30%): Markdown editor with syntax highlighting and toolbar
- [ ] Live preview updates on edit (debounced 500ms)
- [ ] AI Content Indicator: Yellow banner for AI-generated content showing model version and confidence score
- [ ] Version History Tab: Collapsible panel with all versions, timestamps, editors, and "Restore This Version" button
- [ ] Sticky Action Bar: Approve (Green), Reject (Red with reason modal), Request Revision (Amber with note field), Save Draft (Grey)
- [ ] Approve: Promotes to public Read DB, removes Beta badge, notifies requesting students
- [ ] Reject options: "Inaccurate Content", "Inappropriate", "Duplicate", "Poor Quality", "Other"
- [ ] Request Revision: Sends back to AI queue with admin notes
- [ ] Keyboard shortcuts: Ctrl+Enter (Approve), Ctrl+Shift+R (Reject), Ctrl+S (Save Draft)

### Dev Tasks
- [ ] Create ContentReviewPage component
- [ ] Create ContentPreview component (mobile frame)
- [ ] Create MarkdownEditor component (use @uiw/react-md-editor or similar)
- [ ] Create VersionHistoryPanel component
- [ ] Create StickyActionBar component
- [ ] Implement GET /api/v1/admin/content/{id}
- [ ] Implement PUT /api/v1/admin/content/{id}
- [ ] Implement POST /api/v1/admin/content/{id}/approve
- [ ] Implement POST /api/v1/admin/content/{id}/reject
- [ ] Implement POST /api/v1/admin/content/{id}/request-revision
- [ ] Implement keyboard shortcut handler

### QA
- [ ] Side-by-side view renders correctly on desktop (1920px+)
- [ ] Markdown edits reflect in preview within 500ms
- [ ] Approve: Content appears in student search within 1 minute
- [ ] Reject: Requester student notified
- [ ] Request Revision: Job appears in AI queue
- [ ] Version history restore creates new version with correct content
- [ ] Keyboard shortcuts work

## A1.3 | P1 | Bulk Pre-Generated Content Upload
**Labels:** P1, phase:content-moderation
**Phase:** Content Moderation

### User Story
As a Content Admin, I want to bulk upload pre-generated content via CSV/JSON with validation, so that I can populate the core curriculum for multiple topics at once.

### Acceptance Criteria
- [ ] Upload interface at admin.spinzy.academy/content/upload
- [ ] Drag-and-drop file upload area, accepted formats: CSV, JSON, ZIP of Markdown files with manifest
- [ ] CSV template download link
- [ ] Preview first 5 rows of uploaded file in table
- [ ] "Validate" button checks: required columns, board enum, grade 1-12, valid markdown, duplicates
- [ ] Validation results show Valid rows (green), Warnings (amber), Errors (red with downloadable error report)
- [ ] "Import Valid Rows" button enabled only if ≥1 valid row
- [ ] On import: Valid rows created with status APPROVED, content_type PRE_GENERATED
- [ ] Progress bar for large uploads (>100 rows)
- [ ] Success message with count and downloadable error report
- [ ] Max file size: 50MB

### Dev Tasks
- [ ] Create BulkUploadPage component
- [ ] Create FileDropzone component
- [ ] Create ValidationReport component
- [ ] Create ImportProgress component
- [ ] Create CSV/JSON parser service
- [ ] Implement POST /api/v1/admin/content/upload/validate
- [ ] Implement POST /api/v1/admin/content/upload/import
- [ ] Implement background job for large imports via BullMQ

### QA
- [ ] CSV with 100 rows validates within 5 seconds
- [ ] Validation catches missing fields, invalid board, invalid grade, broken MD, duplicates
- [ ] Error report downloadable
- [ ] Import creates content with correct metadata
- [ ] Duplicate rows skipped (not overwritten)
- [ ] 50MB file handled without timeout

## A1.4 | P1 | Content Version History & Rollback
**Labels:** P1, phase:content-moderation
**Phase:** Content Moderation

### User Story
As a Content Admin, I want to view version history for any content piece and roll back to a previous version, so that I can recover from accidental edits or revert rejected changes.

### Acceptance Criteria
- [ ] Every edit creates a new ContentVersion record with version_number, content_body, editor_id, change_summary, created_at
- [ ] Version History tab in Content Review Interface shows timeline view (newest first)
- [ ] Each entry shows: Version number, Editor, Timestamp, Change summary
- [ ] Current version highlighted with "Live" badge
- [ ] "Preview" button on each version shows rendered content in modal
- [ ] "Restore This Version" button creates a NEW version with old content (does not delete intermediate versions)
- [ ] New version marked as is_current: true
- [ ] Reason prompt: "Why are you restoring this version?" (optional)
- [ ] Full audit trail preserved

### Dev Tasks
- [ ] Create VersionHistory component (timeline)
- [ ] Create VersionPreview modal
- [ ] Create Prisma ContentVersion model migration
- [ ] Implement GET /api/v1/admin/content/{id}/versions
- [ ] Implement POST /api/v1/admin/content/{id}/restore/{version_id}

### QA
- [ ] Each edit creates a new version
- [ ] Restore creates new version with old content
- [ ] Current version correctly marked
- [ ] Versions never deleted

## A1.5 | P2 | Content Flagging by Students/Parents — Admin Resolution
**Labels:** P2, phase:content-moderation
**Phase:** Content Moderation

### User Story
As a Content Admin, I want to see content flagged by users, review the issue, and resolve it, so that quality issues reported by the community are addressed.

### Acceptance Criteria
- [ ] Flagged content appears in Moderation Dashboard with "Flagged" filter
- [ ] Flag detail view shows: Content preview, Flag reason(s), User comment, Flag count, Reporter ID (anonymized)
- [ ] Admin actions: Dismiss Flag (mark as DISMISSED, notify reporter), Acknowledge & Edit (opens review interface, auto-dismiss on save, notify reporter)
- [ ] Flag statistics on Analytics Dashboard: Flagged content count, resolution rate, average resolution time

### Dev Tasks
- [ ] Create ContentFlag Prisma model
- [ ] Implement GET /api/v1/admin/content/flags (paginated, filterable)
- [ ] Implement POST /api/v1/admin/content/flags/{id}/dismiss
- [ ] Implement POST /api/v1/admin/content/flags/{id}/resolve

### QA
- [ ] Student/Parent can flag content from Lesson View
- [ ] Flag appears in admin dashboard
- [ ] Dismiss and resolve flows work
- [ ] Reporter notified on resolution

## A2.1-R | P1 | Consent Requests Dashboard
**Labels:** P1, phase:consent-management
**Phase:** Consent Management

### User Story
As a Support Admin, I want to view all pending, approved, denied, and expired consent requests, so that I can assist parents who claim they never received a request or need manual intervention.

### Acceptance Criteria
- [ ] Dashboard at admin.spinzy.academy/consent
- [ ] Table columns: Student Name, Grade/Board, Parent Contact (masked), Channel, Status, Created At, Expires At, Reminders Sent, Actions
- [ ] Filters: Status, Channel, Date Range
- [ ] Search: By student name, parent phone (last 4 digits), parent email domain
- [ ] Actions per row: Re-send, Re-send via Alternative, Override Approve, Override Deny, View Timeline
- [ ] Override Approve requires Super Admin co-approval for audit
- [ ] View Timeline shows full lifecycle: requested → sent → delivered → reminder → approved/denied/expired

### Dev Tasks
- [ ] Create ConsentDashboardPage component
- [ ] Create ConsentTable component
- [ ] Create ConsentTimeline component
- [ ] Create OverrideConsentModal component
- [ ] Implement GET /api/v1/admin/consent-requests (paginated, filterable)
- [ ] Implement POST /api/v1/admin/consent-requests/{id}/resend
- [ ] Implement POST /api/v1/admin/consent-requests/{id}/resend-alternative
- [ ] Implement POST /api/v1/admin/consent-requests/{id}/override
- [ ] Implement GET /api/v1/admin/consent-requests/{id}/timeline

### QA
- [ ] All consent requests visible
- [ ] Filters and search work
- [ ] Re-send triggers actual message delivery
- [ ] Override approve requires Super Admin confirmation
- [ ] Timeline shows all events
- [ ] Masked data for Content Admin (no PII)

## A2.2-R | P1 | Admin Handles -Parent Didn't Receive Consent- Support Ticket
**Labels:** P1, phase:consent-management
**Phase:** Consent Management

### User Story
As a Support Admin responding to a parent inquiry, I want to look up the consent request, verify delivery status, and re-send via alternative channel, so that the issue is resolved without engineering intervention.

### Acceptance Criteria
- [ ] Support Admin searches by parent phone or email
- [ ] Consent detail view shows Original Channel (WhatsApp/Email)
- [ ] Delivery Status: SENT/DELIVERED/READ with timestamps
- [ ] Reminder History: When reminders were sent, how many
- [ ] "Re-send via Alternative Channel" button: WhatsApp → Email, Email → WhatsApp
- [ ] If only one method: Re-send via same channel with note "Second attempt"
- [ ] "Mark as Contacted" button for cases where admin calls parent directly with note field
- [ ] All actions logged in ConsentRequest.activity_log

### Dev Tasks
- [ ] Implement GET /api/v1/admin/consent-requests/{id}/delivery-status
- [ ] Implement POST /api/v1/admin/consent-requests/{id}/manual-contact

### QA
- [ ] Delivery status accurately reflects WhatsApp/Email webhook data
- [ ] Alternative channel resend works
- [ ] Manual contact note saves

## A2.3-R | P2 | Expired Consent Token Cleanup (Automated)
**Labels:** P2, phase:consent-management
**Phase:** Consent Management

### User Story
As a system (automated), I want expired consent tokens (>48 hours) automatically marked as EXPIRED and students notified, so that stale tokens don't accumulate and students aren't stuck in limbo.

### Acceptance Criteria
- [ ] Cron job runs every 1 hour (BullMQ repeatable job or node-cron)
- [ ] Query updates status = 'EXPIRED' where status = 'AWAITING' AND token_expires_at < NOW()
- [ ] For each updated row: Push WebSocket event to student (if online) or queue for next app open
- [ ] Log: "Cron: Expired {count} consent tokens"
- [ ] Consent Dashboard widget shows "Expired Today: X"
- [ ] Alert: If >100 tokens expired in a single day → Super Admin email

### Dev Tasks
- [ ] Create cron job for expired token cleanup
- [ ] Implement WebSocket event push for consent_expired
- [ ] Create dashboard widget for expired count
- [ ] Implement alert mechanism for >100 expirations

### QA
- [ ] Cron runs without errors
- [ ] Expired tokens show correct status in DB
- [ ] Student app reflects expired status within 1 hour + next poll cycle
- [ ] Alert triggers if >100 expires in a day

## A3.1 | P1 | User Search & Profile View
**Labels:** P1, phase:user-support
**Phase:** User Support

### User Story
As a Support Admin, I want to search for any user by email, phone, or child name and view their full profile, so that I can diagnose issues and assist with account problems.

### Acceptance Criteria
- [ ] Global search bar (top of admin panel) searches by Email, Phone, Parent Name, Child Name
- [ ] Results dropdown shows Name, Email/Phone (masked), Role, Status
- [ ] Click result → Full profile page
- [ ] User Profile Page shows: Account Info (Email, Phone masked, Join Date, Subscription Status, Plan)
- [ ] Child Profiles (if Parent): Name, Grade, Board, Status, Last Active, Total Time, Accuracy %
- [ ] Student Profile: Name, Grade, Board, Status, Last Active, Total Time, Accuracy %
- [ ] Activity Log: Last 50 actions with timestamps
- [ ] Consent History: Consent timeline (requested, reminders, approved/denied, method)
- [ ] Subscription History: Payments, invoices, renewals, cancellations
- [ ] Role-Based Visibility: Support Admin full view, Content Admin restricted (masked email/phone), Super Admin full view + admin actions

### Dev Tasks
- [ ] Create GlobalSearch component
- [ ] Create UserProfilePage component
- [ ] Create ActivityLogTable component
- [ ] Implement GET /api/v1/admin/users/search?q={query}
- [ ] Implement GET /api/v1/admin/users/{id}

### QA
- [ ] Search by partial name, email, phone works
- [ ] Profile loads within 1 second
- [ ] Role-based masking works

## A3.2 | P1 | Manual Login Verification (OTP Bypass)
**Labels:** P1, phase:user-support
**Phase:** User Support

### User Story
As a Support Admin handling a parent who cannot receive OTP, I want to manually verify their account for 15 minutes, so that they can log in despite temporary email/WhatsApp delivery issues.

### Acceptance Criteria
- [ ] From User Profile → Actions → "Verify Account Manually"
- [ ] Confirmation modal with reason field (required)
- [ ] On confirm: User.manual_verification_expires = now() + 15 minutes
- [ ] Parent can log in without OTP for 15 minutes
- [ ] After 15 minutes: OTP requirement resumes
- [ ] Audit log: user.manual_verify with admin ID, user ID, reason, timestamp
- [ ] Alert: If single admin performs >10 manual verifications in 24 hours → Super Admin notification

### Dev Tasks
- [ ] Add "Verify Account Manually" button to User Profile actions
- [ ] Create confirmation modal with reason field
- [ ] Implement API endpoint for manual verification
- [ ] Implement fraud alert mechanism

### QA
- [ ] Manual verification works, parent logs in without OTP
- [ ] OTP requirement resumes after 15 minutes
- [ ] Fraud alert triggers at >10/day

## A3.3 | P1 | Consent Dispute Resolution
**Labels:** P1, phase:user-support
**Phase:** User Support

### User Story
As a Support Admin, I want to handle consent disputes (parent claims didn't approve, child claims fraudulent approval), so that we resolve issues fairly while maintaining DPDP compliance.

### Acceptance Criteria
- [ ] Resolution Path 1: Re-send Consent Email/WhatsApp for "I didn't receive it" claims
- [ ] Resolution Path 2: Override Denial (reverse denial) requires Admin notes + Parent email confirmation + Super Admin co-approval
- [ ] Resolution Path 3: Revoke Consent for unauthorized account reports (immediate set consent_status = REVOKED, status = INACTIVE, child profile frozen, investigation flag set)
- [ ] All actions logged in immutable audit trail
- [ ] Monthly DPDP compliance report includes consent dispute resolution metrics

### Dev Tasks
- [ ] Implement re-send consent functionality
- [ ] Implement override denial with Super Admin co-approval workflow
- [ ] Implement revoke consent functionality
- [ ] Add dispute resolution metrics to compliance report

### QA
- [ ] Override requires Super Admin approval
- [ ] Revoke immediately blocks child access
- [ ] Audit trail complete

## A3.4 | P2 | Bulk Communication to Users
**Labels:** P2, phase:user-support
**Phase:** User Support

### User Story
As a Support Admin (with Super Admin approval), I want to send targeted communications to user segments, so that we can announce maintenance, policy changes, or exam tips.

### Acceptance Criteria
- [ ] Feature gated by Super Admin approval workflow
- [ ] Target segments: Board, Grade, Subscription (Free/Premium), Activity (Active <7 days, Inactive >30 days)
- [ ] Compose interface: Subject, Body (with variables: {{parent_name}}, {{child_name}}), Preview
- [ ] Send test to admin's own email
- [ ] Schedule: Now or specific date/time
- [ ] Max 1 broadcast per segment per week
- [ ] Unsubscribe link auto-appended

### Dev Tasks
- [ ] Create BulkCommunication component
- [ ] Create Super Admin approval workflow
- [ ] Implement targeting logic
- [ ] Implement scheduling mechanism
- [ ] Implement unsubscribe link handling

### QA
- [ ] Super Admin approval required
- [ ] Targeting works
- [ ] Schedule works

## A4.1 | P0 | Executive Dashboard — Core KPIs
**Labels:** P0, phase:analytics
**Phase:** Analytics

### User Story
As a Super Admin / Content Admin, I want a real-time dashboard with key platform metrics, so that I can monitor growth, engagement, and content quality at a glance.

### Acceptance Criteria
- [ ] Dashboard at admin.spinzy.academy/analytics with time filter (Today/This Week/This Month/Custom Range)
- [ ] Metric cards with trend arrows and sparklines for: Total Accounts, Total Active Students, DAU/WAU, New Registrations, Free→Premium Conversion, Churn Rate, Avg. Session Duration, Content Generated, Approval Rate, Avg. Approval Time, Top 5 Requested Topics, Flagged Content Unresolved, WhatsApp API Usage, Consent Pipeline
- [ ] Click any metric → Drill-down detail page
- [ ] Export dashboard as PDF

### Dev Tasks
- [ ] Create AnalyticsDashboard component
- [ ] Create MetricCard sub-component (with sparkline)
- [ ] Create TimeFilter component
- [ ] Implement GET /api/v1/admin/analytics/dashboard?period={period}
- [ ] Implement Redis caching (5-minute TTL for real-time, 1-hour for historical)
- [ ] Implement PDF export

### QA
- [ ] Dashboard loads within 3 seconds
- [ ] All metrics accurate against raw data
- [ ] Drill-down works
- [ ] PDF export includes all visible metrics

## A4.2 | P1 | Content Performance Analytics
**Labels:** P1, phase:analytics
**Phase:** Analytics

### User Story
As a Content Admin, I want to see which content pieces are most and least effective based on student practice accuracy, so that I can prioritize improvements.

### Acceptance Criteria
- [ ] Table columns: Topic, Views, Avg. Time Spent, Avg. Practice Accuracy, Flag Count, Status
- [ ] Sort by "Lowest Accuracy" to identify confusing content
- [ ] Filter: AI-Generated vs Pre-Generated for quality comparison
- [ ] Action: "Edit" button opens Content Review Interface
- [ ] Export CSV

### Dev Tasks
- [ ] Create ContentPerformanceAnalytics component
- [ ] Implement GET /api/v1/admin/analytics/content-performance
- [ ] Implement CSV export

### QA
- [ ] Accuracy data correlates with student practice results
- [ ] Low-accuracy content identifiable

## A4.3 | P1 | Revenue Dashboard (Super Admin Only)
**Labels:** P1, phase:analytics
**Phase:** Analytics

### User Story
As a Super Admin, I want to view revenue, subscription metrics, and payment failure rates, so that I can forecast growth and identify payment gateway issues.

### Acceptance Criteria
- [ ] MRR, ARR, ARPU, LTV estimate
- [ ] Subscription breakdown: Monthly vs Annual, Active vs Trial vs Expired
- [ ] Payment failure rate: UPI vs Card
- [ ] Refund rate with reasons
- [ ] Strictly Super Admin only (others see 403)

### Dev Tasks
- [ ] Create RevenueDashboard component
- [ ] Implement GET /api/v1/admin/analytics/revenue
- [ ] Add Super Admin permission check

### QA
- [ ] Revenue data matches Razorpay dashboard
- [ ] Strict access control

## A4.4 | P2 | DPDP Compliance Audit Dashboard
**Labels:** P2, phase:analytics
**Phase:** Analytics

### User Story
As a Super Admin, I want a dashboard for DPDP compliance metrics and a one-click compliance report generator, so that I can demonstrate compliance during regulatory audits.

### Acceptance Criteria
- [ ] Metrics: Consent requests (total, approved, denied, expired), avg. time to consent, data deletion requests (count, avg. resolution), data export requests, flagged content
- [ ] "Generate Compliance Report" → PDF with all metrics + audit log summary for selected period
- [ ] Report timestamped, digitally signed (SHA-256 hash stored)

### Dev Tasks
- [ ] Create DPDPComplianceDashboard component
- [ ] Implement GET /api/v1/admin/analytics/compliance
- [ ] Implement compliance report generation with digital signature

### QA
- [ ] Report generated within 30 seconds
- [ ] All metrics accurate

## A5.1 | P1 | AI Generation Queue Monitoring
**Labels:** P1, phase:operational-efficiency
**Phase:** Operational Efficiency

### User Story
As a Content Admin, I want to monitor the AI content generation queue in real-time, so that I can identify bottlenecks, failed jobs, or cost overruns.

### Acceptance Criteria
- [ ] Queue Dashboard at admin.spinzy.academy/queue
- [ ] Metrics: Pending Jobs, Processing Jobs, Completed Today, Failed Today, Avg. Generation Time (seconds)
- [ ] Failed Jobs Table: Topic, Error Message, Retry Count, Actions (Retry/Cancel)
- [ ] Cost Estimator: Estimated API cost based on token usage
- [ ] Alert: Queue depth >50 notifies Content Admin

### Dev Tasks
- [ ] Create QueueDashboard component
- [ ] Implement real-time metrics (WebSocket or polling every 10s)
- [ ] Implement retry/cancel functionality
- [ ] Implement cost estimator
- [ ] Implement alert mechanism

### QA
- [ ] Queue metrics real-time (WebSocket or polling every 10s)
- [ ] Retry works
- [ ] Cost estimator accurate within 10%

## A5.2 | P2 | Automated Content Expiry & Archival
**Labels:** P2, phase:operational-efficiency
**Phase:** Operational Efficiency

### User Story
As a Content Admin, I want to set expiry dates for time-sensitive content, so that outdated content doesn't clutter the platform.

### Acceptance Criteria
- [ ] Content upload includes optional "Expiry Date" field
- [ ] On expiry: Auto-archived (hidden from students, visible to admins)
- [ ] 7 days before expiry: Admin email alert
- [ ] Expired content can be reactivated

### Dev Tasks
- [ ] Add expiry date field to content upload
- [ ] Create cron job for auto-archival
- [ ] Create email alert system
- [ ] Implement reactivation functionality

### QA
- [ ] Auto-archival works
- [ ] Alert email sends

## A5.3 | P2 | Automated Content Tagging Suggestions
**Labels:** P2, phase:operational-efficiency
**Phase:** Operational Efficiency

### User Story
As a Content Admin, I want AI to suggest tags, difficulty level, and related topics for uploaded content, so that I don't manually tag every piece.

### Acceptance Criteria
- [ ] On generation/upload: AI suggests subject, chapter, difficulty (Easy/Medium/Hard), related topics
- [ ] Admin accepts with one click or overrides
- [ ] Duplicate title detection: Warns if similar topic exists

### Dev Tasks
- [ ] Implement AI suggestion service
- [ ] Create suggestion UI with accept/override buttons
- [ ] Implement duplicate title detection

### QA
- [ ] Suggestions accurate >80% of the time
- [ ] Duplicate detection works

## A6.1 | P1 | WhatsApp API Usage Dashboard
**Labels:** P1, phase:whatsapp-monitoring
**Phase:** WhatsApp API Monitoring

### User Story
As a Super Admin, I want to monitor WhatsApp Cloud API message volume and free tier utilization, so that we don't exceed the free tier unexpectedly and incur costs.

### Acceptance Criteria- [ ] Dashboard Widget on Analytics Dashboard shows: "WhatsApp API Usage"
- [ ] Messages Sent Today: X / 1,000 (free tier daily limit)
- [ ] Messages Sent This Month: Y (actual tracked count)
- [ ] Projected Monthly: Z (based on daily average)
- [ ] Alert thresholds: Warning at 80%, Critical at 95%
- [ ] 80% threshold: Email to Super Admin
- [ ] 95% threshold: Email + urgent push
- [ ] Settings page at admin.spinzy.academy/settings/whatsapp for Super Admin to configure auto_upgrade, monthly_budget_limit, notification_thresholds

### Dev Tasks
- [ ] Create WhatsAppUsageWidget component
- [ ] Create WhatsAppSettings page
- [ ] Implement GET /api/v1/admin/whatsapp-usage
- [ ] Implement PUT /api/v1/admin/whatsapp-settings
- [ ] Implement Redis counter increment on each message send
- [ ] Implement alerting mechanism

### QA
- [ ] Usage count matches actual WhatsApp API calls
- [ ] Alerts fire at correct thresholds
- [ ] Auto-upgrade setting works

## A6.2 | P2 | WhatsApp Delivery Failure Monitoring
**Labels:** P2, phase:whatsapp-monitoring
**Phase:** WhatsApp API Monitoring

### User Story
As a Super Admin, I want to monitor WhatsApp message delivery failures and retry patterns, so that I can identify systemic issues with the WhatsApp integration.

### Acceptance Criteria
- [ ] Dashboard Widget shows Delivery Success Rate (%) over last 24 hours, 7 days, 30 days
- [ ] Failure Reasons Breakdown: Invalid Number, Blocked by User, Rate Limited, Other
- [ ] Alert: Delivery success rate drops below 90% → Super Admin alert

### Dev Tasks
- [ ] Create WhatsAppMessageLog Prisma model
- [ ] Implement webhook tracking for delivery status
- [ ] Create DeliveryMonitoringWidget component
- [ ] Implement alert mechanism

### QA
- [ ] Delivery tracking accurate
- [ ] Alert fires on rate drop

## A7.1 | P1 | Platform Status Page Management
**Labels:** P1, phase:incident-response
**Phase:** Incident Response & Security

### User Story
As a Super Admin, I want to update a public status page during outages, so that users are informed and support ticket volume decreases.

### Acceptance Criteria
- [ ] Status page at status.spinzy.academy (separate subdomain)
- [ ] Admin can: Create incident, update status (Investigating/Identified/Monitoring/Resolved), schedule maintenance
- [ ] Major incidents: Auto-email to all users (Super Admin approval)

### Dev Tasks
- [ ] Set up status page subdomain
- [ ] Create incident management interface
- [ ] Implement email notification for major incidents

### QA
- [ ] Incident creation and updates work
- [ ] Status page reflects changes immediately

## A7.2 | P1 | Immutable Admin Audit Log
**Labels:** P1, phase:incident-response
**Phase:** Incident Response & Security

### User Story
As a Super Admin, I want an immutable, searchable audit log of all admin actions, so that I can investigate anomalies and maintain security compliance.

### Acceptance Criteria
- [ ] Audit log table shows: Timestamp, Admin ID, Admin Name, Action, Target Type, Target ID, Details (JSON), IP Address
- [ ] Searchable by: Admin, Action, Target, Date Range
- [ ] Append-only. No edits. No deletes
- [ ] Export as CSV/PDF
- [ ] Auto-archived after 2 years to cold storage (still accessible)

### Dev Tasks
- [ ] Create AdminAuditLog Prisma model (if not exists)
- [ ] Implement audit logging middleware
- [ ] Create AuditLogViewer component
- [ ] Implement GET /api/v1/admin/audit-logs (searchable, filterable, paginated)
- [ ] Implement export functionality
- [ ] Implement archival job

### QA
- [ ] All admin actions logged
- [ ] Cannot modify or delete logs
- [ ] Search works