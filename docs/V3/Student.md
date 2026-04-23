<!--
FILE OBJECTIVE:
- Jira tasks for the Student Journey: implementable, testable, and trackable work items with acceptance criteria.

LINKED UNIT TEST:
- tests/unit/docs/V3/Student.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-23T12:00:00Z | copilot | add standard file header
-->

# Jira Tasks: Student Journey (Implementable & Trackable)

Here are your Jira tasks broken down by **epic**, ready to import. Each task follows the format:

- **Summary** (Title for Jira)
- **Description** (Acceptance criteria)
- **Story Points** (Effort estimate)
- **Dependencies** (Blocks or blocked by)

---

## Epic 1: Parental Consent & Account Creation (DPDP Compliance)

**Epic Goal:** Legally compliant account activation for under-18 users.

---

### TASK-001: Student Initiate Account Request

| Field | Value |
|-------|-------|
| **Summary** | As a student, I can enter my details and parent email to request account creation |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Student selects "I'm a Student" on landing screen
- [ ] Age gate confirms user is under 18 (DOB picker)
- [ ] Form collects: Full name, Grade (1-12 dropdown), Board (CBSE/ICSE/State), Parent email
- [ ] Parent email format validation (basic regex)
- [ ] Submit button stores record in `pending_consents` table with status `pending`
- [ ] No account created yet - only pending record
- [ ] Success screen shows: "We've sent an email to your parent. Ask them to check their inbox."

**Technical notes:**
- Table: `pending_consents` (id, child_name, grade, board, parent_email, status, created_at, token)
- Generate unique consent token (UUID) for email link

---

### TASK-002: Parent Consent Email Delivery

| Field | Value |
|-------|-------|
| **Summary** | Parent receives consent email with approval link |
| **Story Points** | 3 |
| **Priority** | P0 |
| **Dependencies** | TASK-001 |

**Acceptance Criteria:**
- [ ] Email triggered immediately after student submits request
- [ ] Template T2 (from PRD) - includes child's name, grade, board
- [ ] Large CTA button: "Approve & Create Account"
- [ ] URL contains unique consent token: `/consent?token=...`
- [ ] Email includes denial link/option
- [ ] Email footer: "This link expires in 7 days"
- [ ] Log email send attempt (success/failure) in `email_logs` table

**Technical notes:**
- Use your existing email service (SendGrid/Postmark/AWS SES)
- Token expiry: 7 days (604800 seconds)

---

### TASK-003: Parent Approval via Google OAuth

| Field | Value |
|-------|-------|
| **Summary** | Parent approves child account using Google OAuth one-tap |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-002 |

**Acceptance Criteria:**
- [ ] Landing page at `/consent?token=xxx` shows child details for verification
- [ ] "Approve with Google" button initiates OAuth flow
- [ ] After Google login, check if parent email matches `pending_consents.parent_email`
- [ ] If match: Create `users` record (parent account)
- [ ] Create `profiles` record (parent profile + child profile)
- [ ] Child profile status set to `active`
- [ ] Parent receives confirmation email (Template T2 confirmation variant)
- [ ] Student receives notification (if device token exists - defer to post-MVP)
- [ ] Invalid/expired token shows: "This link has expired. Please ask your child to send a new request."

**Technical notes:**
- Schema: `users(id, email, auth_provider, created_at)`
- Schema: `profiles(id, user_id, name, role, grade, board, is_active, consent_granted_at)`
- Role values: `parent`, `student`, `admin`

---

### TASK-004: Parent Denial Flow

| Field | Value |
|-------|-------|
| **Summary** | Parent can deny consent with optional reason |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-002 |

**Acceptance Criteria:**
- [ ] Denial link in email leads to `/consent/deny?token=xxx`
- [ ] Optional dropdown: "Reason for denial" (Too young / Already using another app / Other)
- [ ] Free-text field for "Other" reason
- [ ] Submit updates `pending_consents.status = 'denied'`
- [ ] Child does NOT get an account created
- [ ] Denial logged for analytics
- [ ] No further emails sent to parent for this request

---

### TASK-005: Admin Consent Dashboard

| Field | Value |
|-------|-------|
| **Summary** | Admin can view and audit all consent requests |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-001, TASK-003 |

**Acceptance Criteria:**
- [ ] Admin panel page: `/admin/consents`
- [ ] Table columns: Child name, Grade, Board, Parent email, Status (pending/approved/denied/expired), Request date, Approval date
- [ ] Filter by status, date range
- [ ] Search by child name or parent email
- [ ] Export to CSV button
- [ ] View individual consent details (audit log)
- [ ] Admin cannot manually approve/deny (only view)
- [ ] Pagination (50 per page)

**Security:**
- [ ] Route protected by admin auth middleware
- [ ] IP whitelist optional (configurable)

---

## Epic 2: Student Onboarding

**Epic Goal:** Right-size difficulty and create engagement in under 2 minutes.

---

### TASK-006: Board & Grade Confirmation Carousel

| Field | Value |
|-------|-------|
| **Summary** | Student confirms board and grade via swipe carousel |
| **Story Points** | 3 |
| **Priority** | P0 |
| **Dependencies** | TASK-003 |

**Acceptance Criteria:**
- [ ] After first login, student sees board selection carousel
- [ ] Options: CBSE, ICSE, State Board (select state after)
- [ ] Grade selection: 1-12 with vertical scroll or numbered buttons
- [ ] Swipe left/right to browse (touch-friendly)
- [ ] No typing required - all tap/swipe
- [ ] "Confirm" button saves to student profile
- [ ] Confirmation screen with summary: "Grade 5, CBSE - Ready to learn!"

**Technical notes:**
- Update `profiles` table with grade and board
- State board: additional `state` field required

---

### TASK-007: Avatar Selection (Study Buddy)

| Field | Value |
|-------|-------|
| **Summary** | Student selects a Study Buddy avatar |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-006 |

**Acceptance Criteria:**
- [ ] 5 illustrated avatars: Owl, Fox, Elephant, Dolphin, Tiger
- [ ] Each avatar has name (Prof. Hoot, Swift Fox, Ellie, Dolphin, Tigo)
- [ ] Tap to select - visual highlight on selection
- [ ] "Confirm" button saves to profile
- [ ] Avatar appears on Learning Map (corner or mascot position)
- [ ] Can change later from Settings (P2)

---

### TASK-008: Diagnostic Quiz

| Field | Value |
|-------|-------|
| **Summary** | 5-question diagnostic quiz to place student at correct level |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-006 |

**Acceptance Criteria:**
- [ ] Quiz presented immediately after board/grade selection
- [ ] 5 questions: 2 below grade, 2 at grade, 1 above grade
- [ ] Question bank seeded by grade level (admin pre-seeds)
- [ ] One question per screen
- [ ] Progress indicator: "Question 1 of 5"
- [ ] No time limit
- [ ] Score calculated at end: 4-5 correct = "Advanced Start", 0-3 correct = "Standard Start"
- [ ] Placement saved to student profile
- [ ] Advanced Start: Chapter 1 marked complete, starts at Chapter 2
- [ ] Standard Start: Starts at Chapter 1, Topic 1
- [ ] Student can retake diagnostic from Settings (P2)

**Technical notes:**
- Table: `diagnostic_questions` (id, grade, difficulty_level, question_text, options, correct_answer)
- Table: `diagnostic_results` (profile_id, score, placement_result, taken_at)

---

## Epic 3: Core Learning Loop

**Epic Goal:** Student can learn, practice, and hit the freemium wall.

---

### TASK-009: Learning Map (Game Board)

| Field | Value |
|-------|-------|
| **Summary** | Student sees game-board style Learning Map with chapter nodes |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-008 |

**Acceptance Criteria:**
- [ ] Home screen shows learning path as horizontal scroll of chapter nodes
- [ ] Each node shows: Chapter number + title
- [ ] Completed chapters: Green checkmark, trophy icon
- [ ] Current chapter: Glowing border, larger node
- [ ] Locked chapters: Gray, padlock icon
- [ ] Tap node to expand and see topics
- [ ] Progress bar at top: "X/12 chapters complete"
- [ ] XP counter visible in corner
- [ ] Streak counter visible (flame icon)
- [ ] Responsive: Works on mobile (vertical scroll) and tablet

**Technical notes:**
- Fetch progress from `learning_progress` table
- Cache chapter structure for 1 hour

---

### TASK-010: Lesson Content Viewer

| Field | Value |
|-------|-------|
| **Summary** | Student can open and read structured lesson content |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-009 |

**Acceptance Criteria:**
- [ ] Tap topic from Learning Map opens lesson viewer
- [ ] Content renders: Headers, paragraphs, bullet points, images
- [ ] Images lazy-loaded with placeholder
- [ ] Math formulas render via KaTeX or MathJax
- [ ] "Mark Complete" button at bottom of lesson
- [ ] Marking complete updates progress and grants XP
- [ ] Progress persists across devices via API
- [ ] Read-aloud TTS button (P2 - optional for MVP)

**Technical notes:**
- Content fetched from `lesson_content` table (HTML/Markdown)
- API endpoint: `GET /api/lessons/{lesson_id}`

---

### TASK-011: Practice Questions with Daily Limit

| Field | Value |
|-------|-------|
| **Summary** | Free tier student can answer up to 5 practice questions per topic per day |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-010 |

**Acceptance Criteria:**
- [ ] "Practice" button appears after lesson completion
- [ ] Each question: Multiple choice (4 options)
- [ ] Immediate feedback: Correct (green) or Incorrect (red with explanation)
- [ ] Counter visible: "X/5 questions used today"
- [ ] Daily limit resets at midnight UTC
- [ ] After 5th question, "Upgrade" CTA appears (no more questions)
- [ ] Correct answer: +10 XP, update streak
- [ ] Incorrect answer: No XP, shows correct answer and explanation
- [ ] Student cannot repeat same question in same day
- [ ] Question pool per topic: minimum 10 questions for variety

**Technical notes:**
- Table: `practice_attempts` (profile_id, topic_id, question_id, is_correct, attempted_at)
- Daily count query: `COUNT(*) WHERE attempted_at > TODAY`

---

### TASK-012: Freemium Upgrade Modal

| Field | Value |
|-------|-------|
| **Summary** | When free student hits limit, show friendly upsell modal |
| **Story Points** | 3 |
| **Priority** | P0 |
| **Dependencies** | TASK-011 |

**Acceptance Criteria:**
- [ ] Modal appears when student attempts 6th question
- [ ] Never grey out buttons - modal on click
- [ ] Title: "Want more practice?"
- [ ] Body: "Ask a parent to unlock unlimited questions, quizzes, and mock exams."
- [ ] Button 1: "Send request to parent" → triggers push/email
- [ ] Button 2: "Continue learning" (dismiss, returns to topic)
- [ ] Button 3: "Parent has already upgraded" → checks subscription status
- [ ] Modal dismissible with X button
- [ ] Does not appear again in same session if dismissed

**Technical notes:**
- Track `last_upsell_shown_at` in local storage or profile
- Debounce: Show max 3 times per day

---

### TASK-013: XP and Streak Animations

| Field | Value |
|-------|-------|
| **Summary** | Student receives XP coins and streak animations for correct answers |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-011 |

**Acceptance Criteria:**
- [ ] Correct answer triggers +10 XP popup (coin animation)
- [ ] Sound effect (optional, disabled by default)
- [ ] XP counter in header updates in real-time
- [ ] Streak counter increments on correct answer
- [ ] Streak resets on incorrect answer or missed day
- [ ] Streak milestone animation: 3 days, 5 days, 7 days
- [ ] Confetti animation for 7-day streak
- [ ] Streak stored in `streaks` table (current_streak, longest_streak, last_activity_date)

**Technical notes:**
- Use Framer Motion or CSS animations for coins/confetti
- Daily streak check at login: compare `last_activity_date` to today

---

## Epic 4: On-Demand AI Content

**Epic Goal:** Never show "no content found" - generate on-demand instead.

---

### TASK-014: Search with Zero-Result Trigger

| Field | Value |
|-------|-------|
| **Summary** | When student searches a topic with zero results, show "Request Topic" card |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-009 |

**Acceptance Criteria:**
- [ ] Search bar on Learning Map header
- [ ] Search debounced (300ms)
- [ ] Results show: Existing lessons (title + snippet)
- [ ] If zero results: Show "Request this Topic" card instead of empty state
- [ ] Card shows: Topic name entered, "Generate Notes for Me" button
- [ ] No automatic generation - requires explicit click
- [ ] Search terms logged for analytics

**Technical notes:**
- Search uses PostgreSQL full-text search on `lessons.title`, `lessons.keywords`
- Future: pgvector for semantic search (post-MVP)

---

### TASK-015: On-Demand Generation Trigger

| Field | Value |
|-------|-------|
| **Summary** | Clicking "Generate" creates async job to generate content |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-014 |

**Acceptance Criteria:**
- [ ] Click "Generate Notes for Me" creates job in `content_generation_jobs` table
- [ ] Status: `queued` → `processing` → `completed` / `failed`
- [ ] Duplicate check: If same topic queued in last 15 min, merge requests (don't regenerate)
- [ ] Show loading screen with Study Buddy animation while generating
- [ ] Poll status every 2 seconds via API
- [ ] First 2 paragraphs returned within 15 seconds
- [ ] Remaining content streams as student scrolls (server-sent events or chunked response)
- [ ] If generation fails: Show "Something went wrong. Try again." and log error

**Technical notes:**
- Use Bull/Redis queue for async processing
- API endpoint: `POST /api/content/generate`
- Polling endpoint: `GET /api/content/status/{job_id}`

---

### TASK-016: AI Content Storage with Beta Badge

| Field | Value |
|-------|-------|
| **Summary** | Generated content saved to lessons table with "AI Draft - Beta" badge |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-015 |

**Acceptance Criteria:**
- [ ] Generated content saved to `lessons` table
- [ ] Fields: title, content (HTML), topic_keywords, source = 'ai_generated', status = 'draft'
- [ ] Student sees badge: "🔬 AI Draft - Beta" on lesson card and header
- [ ] Badge tooltip: "This topic was generated by AI. Our team will review it soon."
- [ ] Content accessible immediately (no admin approval required for read access)
- [ ] Admin moderation interface can promote 'draft' → 'published'
- [ ] Student can report issue with AI content (flag button)

**Technical notes:**
- Keep pre-generated (admin) lessons with `source = 'admin'`, `status = 'published'`
- Search only returns `status IN ('published', 'draft')` for non-admin users

---

### TASK-017: Admin Content Moderation Queue

| Field | Value |
|-------|-------|
| **Summary** | Admin can approve/reject AI-generated content sorted by demand |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-016 |

**Acceptance Criteria:**
- [ ] Admin panel: `/admin/content/review`
- [ ] Queue shows AI-generated lessons with `status = 'draft'`
- [ ] Sort by: Most requested (view count), Oldest first, Grade level
- [ ] Each item shows: Topic, grade, date generated, number of times accessed, student feedback count
- [ ] Approve: Changes status to 'published', removes "Beta" badge for all students
- [ ] Reject: Changes status to 'rejected', hides from student view (shows "Topic unavailable" message)
- [ ] Edit: Inline editor to fix content before approving
- [ ] Bulk approve by grade/topic filter

---

## Epic 5: Parent Oversight

**Epic Goal:** Keep parents informed and drive premium conversion.

---

### TASK-018: Weekly Parent Email Report

| Field | Value |
|-------|-------|
| **Summary** | Automated weekly progress email to parent every Sunday at 6 PM IST |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-013 |

**Acceptance Criteria:**
- [ ] Cron job runs Sunday 6 PM IST (12:30 UTC during standard time)
- [ ] Email Template T4: Progress summary for past week
- [ ] Data included: Hours spent, topics covered, XP earned, correct/incorrect ratio
- [ ] Weak topics identified: Subject areas with <60% accuracy
- [ ] Premium upsell section: Show locked features with benefits
- [ ] If child requested premium (via TASK-012): Include pending request callout
- [ ] Unsubscribe link at bottom (parent can opt-out)
- [ ] Email design mobile-responsive, max width 480px

**Technical notes:**
- Use cron-job.org or AWS EventBridge or node-cron
- Query aggregate data from `practice_attempts`, `lesson_completions` for past 7 days

---

### TASK-019: Premium Parent Dashboard (Real-time)

| Field | Value |
|-------|-------|
| **Summary** | Premium parent sees real-time dashboard with weak topic alerts |
| **Story Points** | 8 |
| **Priority** | P1 |
| **Dependencies** | TASK-018 |

**Acceptance Criteria:**
- [ ] Accessible only to subscription.active = true
- [ ] Dashboard shows: All children under account (profile switcher)
- [ ] Subject-wise accuracy chart (bar/line graph)
- [ ] Weak topic alert list: Topics where accuracy <60% with >5 attempts
- [ ] Time spent: Today / This week / This month
- [ ] Recent activity feed: "Aarav completed Grade 5, Chapter 3 yesterday"
- [ ] Upgrade recommendations: "Master weak topics with AI Tutor (Premium feature)"
- [ ] Real-time updates (WebSocket or polling every 30 seconds)

**Technical notes:**
- Table: `subscriptions` (profile_id, status, plan, start_date, end_date)
- Use Chart.js or Recharts for visualizations

---

### TASK-020: Parent Push Notification for Premium Request

| Field | Value |
|-------|-------|
| **Summary** | Parent receives push notification when student requests premium unlock |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-012 |

**Acceptance Criteria:**
- [ ] When student clicks "Send request to parent", record added to `parent_notifications` table
- [ ] Push notification sent to parent's device (if token exists)
- [ ] Notification text: "Your child [Student name] wants unlimited practice. Tap to upgrade."
- [ ] Fallback to email if push fails or no token
- [ ] Parent can set "quiet hours" (e.g., no notifications after 9 PM)
- [ ] In-app notification center shows all requests

**Technical notes:**
- Use web push (VAPID) or Firebase Cloud Messaging
- Store push tokens in `device_tokens` table

---

## Epic 6: Gamification & Retention

**Epic Goal:** Build daily habits and long-term engagement.

---

### TASK-021: Daily Streak Rewards System

| Field | Value |
|-------|-------|
| **Summary** | Escalating streak rewards for daily logins and practice |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-013 |

**Acceptance Criteria:**
- [ ] Streak increments when student answers at least 1 question per day
- [ ] Milestone rewards:
  - Day 3: 50 bonus XP
  - Day 5: Unlock exclusive avatar accessory (hat/glasses)
  - Day 7: 1 free day of Premium (grants temporary unlimited access)
  - Day 14: 50 XP + Special badge
  - Day 30: Rare avatar skin + Certificate
- [ ] Streak freeze: 1 free missed day per month (can purchase more with XP)
- [ ] Streak calendar view (last 30 days, colored squares)
- [ ] Modal congratulates student on each milestone

---

### TASK-022: Weekend Practice Arena (Free Premium Windows)

| Field | Value |
|-------|-------|
| **Summary** | Free students get unlimited practice on mastered topics every Saturday |
| **Story Points** | 3 |
| **Priority** | P2 |
| **Dependencies** | TASK-011 |

**Acceptance Criteria:**
- [ ] Every Saturday 00:00 UTC to Sunday 00:00 UTC
- [ ] Free tier students see banner: "🎉 Weekend Arena! Unlimited practice on mastered topics."
- [ ] Practice questions on topics where student has >80% accuracy become unlimited (no daily cap)
- [ ] New/unmastered topics still respect daily limit
- [ ] Countdown timer shows remaining weekend time
- [ ] After weekend, limits reset to normal (5/day)

**Technical notes:**
- Server checks `is_weekend_arena_active()` before enforcing limits
- Weekend arena logic: `if (topic_mastery >= 0.8 AND is_saturday) { unlimited = true }`

---

### TASK-023: Exam Warrior Mode

| Field | Value |
|-------|-------|
| **Summary** | Dark theme, countdown timer, mock test format during exam season |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Activated manually by admin or automatically Feb-Mar, Sep-Oct
- [ ] Theme toggle: Dark mode with neon accents
- [ ] Mock exams: Full syllabus test, timed (60 min), auto-graded
- [ ] Countdown timer visible during mock exam
- [ ] Exam leaderboard (within grade, anonymized)
- [ ] "Exam Warrior" badge awarded for completing 3+ mock exams
- [ ] Performance report: Weak areas highlighted with suggested lessons
- [ ] Parent dashboard shows mock exam scores trend line

---

### TASK-024: Summer Brain Gain (30-Day Challenge)

| Field | Value |
|-------|-------|
| **Summary** | 30-day holiday challenge with puzzles and certificates |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-021 |

**Acceptance Criteria:**
- [ ] Activated Apr 15 - Jun 15
- [ ] 30 daily puzzles (mix of math, logical reasoning, riddles)
- [ ] Each puzzle unlocks next day
- [ ] Leaderboard (optional, anonymized)
- [ ] Completion certificate generated as PDF after day 30
- [ ] Certificate includes: Student name, grade, "Brain Gain Champion"
- [ ] Share certificate to WhatsApp/Download as image
- [ ] XP multiplier: 2x XP earned during challenge period

---

## Epic 7: Production Hardening (Cross-Cutting)

**Epic Goal:** Ensure security, monitoring, and deployment safety.

---

### TASK-025: Environment-Based Auth Configuration

| Field | Value |
|-------|-------|
| **Summary** | Implement environment-aware auth with dev bypass and production safeguards |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] `NODE_ENV=development` shows email/password login field on login page
- [ ] Dev login endpoint `/api/auth/dev-login` auto-creates user with any email/password
- [ ] Dev login endpoint returns 404 in staging/production
- [ ] Red banner visible when `MOCK_AUTH_ENABLED` in dev
- [ ] Test internal endpoints (`/internal/testing/*`) blocked in production (404)
- [ ] Pre-deployment check script runs to ensure no test routes in production build
- [ ] Staging uses static OTP code `111111` (not real delivery)

---

### TASK-026: Admin Panel Security

| Field | Value |
|-------|-------|
| **Summary** | Secure admin panel with IP whitelist and MFA |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Admin panel on separate subdomain: `admin.spinzy.com`
- [ ] IP whitelist configurable via env `ADMIN_ALLOWED_IPS`
- [ ] MFA required: TOTP (Google Authenticator) for all admin accounts
- [ ] Admin login logs: IP, timestamp, success/failure
- [ ] Session timeout: 30 minutes of inactivity
- [ ] Audit log for all admin actions (approve/reject content, user management)

---

### TASK-027: Monitoring & Alerting

| Field | Value |
|-------|-------|
| **Summary** | Set up monitoring for critical path and error alerting |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Uptime monitoring for: Login API, Lesson content API, Practice API
- [ ] Alert if >5% error rate in 5 minutes (PagerDuty/Slack/Email)
- [ ] Dashboard: Daily active students, practice attempts, AI generation success rate
- [ ] Log aggregation (console → logging service)
- [ ] Alert for AI generation failures (>10 in 1 hour)
- [ ] Alert for email delivery failures (>20% bounce rate)

---

## Summary: Task Count & Points

| Epic | Tasks | Total Points | Priority Focus |
|------|-------|--------------|----------------|
| Epic 1: Parental Consent | 5 | 24 | P0 (MVP) |
| Epic 2: Onboarding | 3 | 14 | P0 (MVP) |
| Epic 3: Core Learning Loop | 5 | 29 | P0 (MVP) |
| Epic 4: On-Demand AI | 4 | 21 | P0/P1 |
| Epic 5: Parent Oversight | 3 | 16 | P1 |
| Epic 6: Gamification | 4 | 18 | P2 |
| Epic 7: Production Hardening | 3 | 13 | P0 |
| **Total** | **27** | **135** | |

---

## Jira Import Format (CSV)

Save this as `jira_import.csv` for bulk import:

```csv
Summary,Description,Story Points,Priority,Epic Link,Labels
TASK-001: Student Initiate Account Request,"Student enters name, grade, board, parent email. Creates pending_consent record.",5,Highest,Epic 1: Parental Consent,mvp
TASK-002: Parent Consent Email Delivery,"Send Template T2 email with approval link and consent token.",3,Highest,Epic 1: Parental Consent,mvp
TASK-003: Parent Approval via Google OAuth,"Parent approves via Google, creates user+profiles, activates child.",8,Highest,Epic 1: Parental Consent,mvp
TASK-004: Parent Denial Flow,"Parent can deny consent with optional reason logging.",3,High,Epic 1: Parental Consent,post-mvp
TASK-005: Admin Consent Dashboard,"View, filter, export all consent requests for audit.",5,High,Epic 1: Parental Consent,post-mvp
TASK-006: Board & Grade Confirmation Carousel,"Swipe carousel for board and grade selection. No typing.",3,Highest,Epic 2: Onboarding,mvp
TASK-007: Avatar Selection,"Select from 5 illustrated Study Buddy avatars.",3,High,Epic 2: Onboarding,post-mvp
TASK-008: Diagnostic Quiz,"5-question quiz (2 below,2 at,1 above grade) determines placement.",8,Highest,Epic 2: Onboarding,mvp
TASK-009: Learning Map,"Game-board style horizontal scroll of chapter nodes with progress.",8,Highest,Epic 3: Core Learning Loop,mvp
TASK-010: Lesson Content Viewer,"Render structured content (HTML, images, math formulas). Mark complete.",5,Highest,Epic 3: Core Learning Loop,mvp
TASK-011: Practice Questions with Daily Limit,"5 questions/day limit. Immediate feedback. XP on correct.",8,Highest,Epic 3: Core Learning Loop,mvp
TASK-012: Freemium Upgrade Modal,"Show upsell modal when limit hit. Request parent or dismiss.",3,Highest,Epic 3: Core Learning Loop,mvp
TASK-013: XP and Streak Animations,"Coin popup animations, confetti for milestones.",5,High,Epic 3: Core Learning Loop,post-mvp
TASK-014: Search with Zero-Result Trigger,"Search bar. Zero results shows 'Request Topic' card.",5,Highest,Epic 4: On-Demand AI,mvp
TASK-015: On-Demand Generation Trigger,"Async job with duplicate detection (15 min window). Loading animation.",8,Highest,Epic 4: On-Demand AI,mvp
TASK-016: AI Content Storage with Beta Badge,"Save to lessons with source='ai_generated', status='draft'. Show Beta badge.",3,High,Epic 4: On-Demand AI,post-mvp
TASK-017: Admin Content Moderation Queue,"Approve/reject/edit AI content. Sort by demand.",5,Medium,Epic 4: On-Demand AI,polish
TASK-018: Weekly Parent Email Report,"Sunday 6 PM IST email with progress summary and weak topics.",5,High,Epic 5: Parent Oversight,post-mvp
TASK-019: Premium Parent Dashboard,"Real-time dashboard with charts, weak topic alerts for subscribers.",8,High,Epic 5: Parent Oversight,post-mvp
TASK-020: Parent Push Notification,"Push when child requests premium. Fallback to email.",3,High,Epic 5: Parent Oversight,post-mvp
TASK-021: Daily Streak Rewards System,"Escalating rewards at days 3,5,7,14,30. Streak freeze option.",5,Medium,Epic 6: Gamification,polish
TASK-022: Weekend Practice Arena,"Unlimited practice on mastered topics every Saturday.",3,Medium,Epic 6: Gamification,polish
TASK-023: Exam Warrior Mode,"Dark theme, mock exams, countdown timer. Activated exam seasons.",5,Medium,Epic 6: Gamification,polish
TASK-024: Summer Brain Gain Challenge,"30-day puzzle challenge with completion certificate.",5,Low,Epic 6: Gamification,polish
TASK-025: Environment-Based Auth,"Dev email/password login. Test routes blocked in production.",5,Highest,Epic 7: Production Hardening,mvp
TASK-026: Admin Panel Security,"IP whitelist, MFA (TOTP), audit logs, separate subdomain.",5,Highest,Epic 7: Production Hardening,mvp
TASK-027: Monitoring & Alerting,"Uptime, error rate alerts. Dashboard for key metrics.",3,High,Epic 7: Production Hardening,post-mvp
```

---

## How to Use This

1. **Import CSV** into Jira (Project Settings → Import Issues → CSV)
2. **Create 7 Epics** with names: Epic 1: Parental Consent, Epic 2: Onboarding, etc.
3. **Assign points** (already included)
4. **MVP Filter:** `Priority = Highest` → 13 tasks, ~70 points
5. **First Sprint:** Pick 5-7 tasks from MVP list

**Need a Sprint 1 breakdown?** Reply and I'll slice the first 2-week sprint with exact task sequencing and daily deliverables.

