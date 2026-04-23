<!--
FILE OBJECTIVE:
- Jira tasks for the Parent Journey: implementable, testable, and trackable work items with acceptance criteria.

LINKED UNIT TEST:
- tests/unit/docs/V3/Parent.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-23T12:00:00Z | copilot | add standard file header
-->

# Jira Tasks: Parent Journey (Complete)

Here are **all Parent Journey tasks** formatted for direct Jira import, organized by epic with acceptance criteria, story points, dependencies, and technical specifications.

---

## Epic: Parent Onboarding & Discovery

**Epic Goal:** Convert parents from landing page to account creation with child setup.

---

### TASK-PARENT-001: Landing Page with Google Sign-In

| Field | Value |
|-------|-------|
| **Summary** | Build mobile-optimized landing page with one-tap Google Sign-In |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Page loads in <3 seconds on 4G (Lighthouse performance score ≥80)
- [ ] Headline visible above fold: "Unlimited Learning. Zero Pressure. Complete Control."
- [ ] Three value prop icons with labels: "All Boards" / "Parental Control" / "Free to Start"
- [ ] Primary CTA: "Start Free — Sign in with Google" (#FF6B35, 48px min height, full width on mobile)
- [ ] Secondary link: "Learn more" (scrolls to feature section)
- [ ] No pricing or credit card fields visible
- [ ] Google OAuth popup on CTA click → redirect to `/add-child` on success
- [ ] On OAuth failure: "Unable to sign in. Please try again."

**Technical Notes:**
- Use existing Google OAuth configuration
- Store `auth_provider = 'google'` in users table
- Set session expiry: 30 days

**QA Checklist:**
- [ ] Lighthouse mobile score ≥80
- [ ] CTA triggers Google OAuth
- [ ] New user → redirects to `/add-child`
- [ ] Existing user with child → redirects to `/dashboard`

---

### TASK-PARENT-002: Referral Landing Page Variant

| Field | Value |
|-------|-------|
| **Summary** | Create referral-aware landing page variant with friend's name |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-001 |

**Acceptance Criteria:**
- [ ] URL param `?ref={parent_id}` triggers variant
- [ ] Header: "Your friend [Friend Name] invited you to Spinzy Academy!"
- [ ] Friend name from `profiles.name` where `user_id = parent_id` and `role = 'parent'`
- [ ] Reward callout: "You both get 1 month of Premium free when you subscribe"
- [ ] Fallback to standard landing page if invalid ref ID
- [ ] Store `referral_code` in session storage
- [ ] Apply referral credit at first premium purchase

**Technical Notes:**
- Referral credit expires in 30 days
- No avatar photos displayed for privacy

**QA Checklist:**
- [ ] Valid ref param shows friend's name
- [ ] Invalid ref param falls back to standard page
- [ ] Referral credit applied on upgrade

---

### TASK-PARENT-003: School Partnership Landing Page Variant

| Field | Value |
|-------|-------|
| **Summary** | Create co-branded landing page for school referrals |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-001 |

**Acceptance Criteria:**
- [ ] URL param `?school={school_id}` or QR code triggers variant
- [ ] Displays school name and logo (from `schools` table)
- [ ] Text: "Your school recommends Spinzy Academy for supplementary learning."
- [ ] 14-day free trial for partner school parents (vs default 7-day)
- [ ] Default board pre-selected based on school's curriculum
- [ ] School ID logged in `users.school_partner` field

**Technical Notes:**
- Table: `schools` (id, name, logo_url, board, is_active)
- Admin panel to manage partner schools (TASK-ADMIN-xxx)

**QA Checklist:**
- [ ] Valid school_id shows school logo and name
- [ ] Free trial shows 14 days instead of 7
- [ ] Board pre-selected correctly

---

## Epic: Parental Consent & Child Setup (DPDP Compliance)

**Epic Goal:** Legally compliant child account creation under 5 minutes.

---

### TASK-PARENT-004: Add Child Profile Form

| Field | Value |
|-------|-------|
| **Summary** | Parent adds child's name, grade, board to create profile |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-PARENT-001 |

**Acceptance Criteria:**
- [ ] Screen title: "Who will be learning with Spinzy?"
- [ ] Fields:
  - First Name (text, required, max 50 chars)
  - Grade (dropdown: 1-12, required)
  - Board (dropdown: CBSE/ICSE/State Board/Other, required)
- [ ] "Add Another Child" link (text link, not primary button)
- [ ] No photo upload, no last name (data minimization)
- [ ] Submit button: "Continue to Consent"
- [ ] On submit: Insert into `profiles` with `role='student'`, `status='pending_consent'`
- [ ] Redirect to DPDP consent screen

**Technical Notes:**
- Schema: `profiles(id, user_id, name, grade, board, role, status, created_at)`
- Prevent duplicate active child profiles with same name (warning only, not block)

**QA Checklist:**
- [ ] All fields required — validation works
- [ ] Submit creates pending consent record
- [ ] Redirects to consent screen

---

### TASK-PARENT-005: DPDP Consent Screen (Plain Language)

| Field | Value |
|-------|-------|
| **Summary** | Parent reads plain-language consent disclosure and grants/denies |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-PARENT-004 |

**Acceptance Criteria:**
- [ ] Screen title: "Before [Child Name] can start, we need your consent."
- [ ] Checklist with icons:
  - ✅ Child can access unlimited study notes and videos
  - ✅ Child's learning activity visible only to you
  - ✅ You can set screen time limits and block subjects
  - ❌ No ads or targeted recommendations
  - ❌ No data shared with third parties
  - ❌ No social features (chat, friends)
- [ ] Primary button: "I Consent — Activate [Child Name]'s Account"
- [ ] Secondary link: "I Need More Information" (opens FAQ modal)
- [ ] FAQ modal links to full Privacy Policy
- [ ] On consent: Update `profiles.status = 'active'`, set `consent_granted_at = NOW()`
- [ ] Insert into `consent_audit_log` (immutable record)
- [ ] Redirect to freemium config screen

**Technical Notes:**
- Table: `consent_audit_log` (id, profile_id, action, timestamp, ip_address)
- DPDP compliance: Keep audit trail for 7 years

**QA Checklist:**
- [ ] Child name appears correctly in title
- [ ] Consent creates audit log entry
- [ ] Redirects to freemium config

---

### TASK-PARENT-006: DPDP Consent Denial Flow

| Field | Value |
|-------|-------|
| **Summary** | Parent can deny consent with anonymization of child data |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-005 |

**Acceptance Criteria:**
- [ ] Parent taps "I Need More Information" → Reads FAQ → Taps "Decline"
- [ ] On decline: Update `profiles.status = 'denied'`
- [ ] Anonymize child profile: `name = NULL`, keep only grade/board for aggregate analytics
- [ ] Display: "You've declined consent. [Child Name]'s profile will not be activated."
- [ ] Log event in `consent_audit_log` with `action='denied'`
- [ ] No further emails about this child
- [ ] Parent can reverse decision in Settings (P2)

**QA Checklist:**
- [ ] Denial anonymizes child name
- [ ] Audit log records denial
- [ ] No further emails sent

---

### TASK-PARENT-007: Freemium Configuration Screen

| Field | Value |
|-------|-------|
| **Summary** | Parent sees free tier limits and premium upsell before child starts |
| **Story Points** | 3 |
| **Priority** | P0 |
| **Dependencies** | TASK-PARENT-005 |

**Acceptance Criteria:**
- [ ] Screen title: "Set [Child Name]'s daily learning limits."
- [ ] Three feature cards:
  - Practice Questions: "5 per topic per day (Free)" / "Unlimited (Premium)" — visually locked
  - AI Tutor Prompts: "3 per day (Free)" / "Unlimited (Premium)" — visually locked
  - Lesson Content: "Unlimited (Free)" — always unlocked
- [ ] Premium preview card at bottom:
  - Text: "Unlock unlimited practice, mock tests, and your real-time parent dashboard."
  - Primary button: "Start 7-Day Free Premium Trial"
  - Secondary link: "Continue with Free" (grey, smaller)
- [ ] "Continue with Free" → redirect to setup complete
- [ ] "Start Trial" → redirect to payment flow

**QA Checklist:**
- [ ] Free tier limits displayed correctly
- [ ] Premium features visually locked
- [ ] Both CTAs work

---

### TASK-PARENT-008: Setup Complete & WhatsApp Share

| Field | Value |
|-------|-------|
| **Summary** | Parent shares app deep link to child's device via WhatsApp |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-007 |

**Acceptance Criteria:**
- [ ] Screen title: "[Child Name]'s account is ready! 🎉"
- [ ] Instruction: "Hand the device to [Child Name] now, or install Spinzy on their device."
- [ ] Primary CTA: "Send app link via WhatsApp"
  - Opens WhatsApp with pre-filled message: "[Child Name], your Spinzy Academy learning app is ready! Download here: [Deep Link]. Your profile is already set up."
- [ ] Secondary CTA: "I'll set it up later" → returns to Parent Dashboard
- [ ] Deep link auto-authenticates child (no login required)
- [ ] Track share event in analytics

**Technical Notes:**
- Deep link format: `spinzy://app/child/{profile_id}/{consent_token}`
- Consent token expires in 7 days

**QA Checklist:**
- [ ] WhatsApp share opens with correct message
- [ ] Deep link auto-authenticates child
- [ ] Share event tracked

---

### TASK-PARENT-009: Add Sibling with Discount

| Field | Value |
|-------|-------|
| **Summary** | Parent adds second child with sibling discount prompt |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-004 |

**Acceptance Criteria:**
- [ ] Dashboard card: "+ Add Another Learner" (visible to parents with ≥1 active child)
- [ ] Reuse Add Child flow but pre-fill parent email
- [ ] After consent for second child: Show pricing card "Sibling Discount: 25% off for [Second Child Name]"
- [ ] Discount applied at next billing cycle (not retroactive)
- [ ] All children under same parent share one premium subscription
- [ ] Dashboard child toggle supports multiple children

**QA Checklist:**
- [ ] Add Another Learner visible
- [ ] Sibling discount appears
- [ ] Discount applied correctly on next billing

---

## Epic: Passive Observation (First Week Trust Building)

**Epic Goal:** Keep parents informed without requiring app opens.

---

### TASK-PARENT-010: First Session Push Notification

| Field | Value |
|-------|-------|
| **Summary** | Parent receives push when child completes first lesson |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | Student Journey TASK-010 |

**Acceptance Criteria:**
- [ ] Trigger: Child completes first lesson (100% viewed OR ≥1 practice question)
- [ ] Notification text: "[Child Name] just completed their first lesson: '[Lesson Title]'. They got [Score]/5 practice questions right! 🎉"
- [ ] Tapping notification opens Parent Dashboard (premium) or session summary (free)
- [ ] Sent only once per child (not per lesson)
- [ ] Parent can disable in Settings (opt-out, not opt-in)

**Technical Notes:**
- Use web push (VAPID) or Firebase Cloud Messaging
- Store `first_lesson_notification_sent` flag in `profiles`

**QA Checklist:**
- [ ] Notification triggers on first lesson completion
- [ ] Not sent again for same child
- [ ] Disable setting works

---

### TASK-PARENT-011: Weekly Progress Email

| Field | Value |
|-------|-------|
| **Summary** | Automated weekly email with child's learning summary |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | Student Journey TASK-011, TASK-013 |

**Acceptance Criteria:**
- [ ] Cron job runs Sunday 18:00 IST
- [ ] Email fields for each child:
  - Child name
  - Total time spent (hours/minutes)
  - Topics covered (list, max 5)
  - Average accuracy %
  - XP earned this week
  - Current streak (days)
- [ ] Premium teaser section (if free parent):
  - "Want to see which topics [Child] is struggling with? Upgrade to Premium for weak topic alerts."
  - CTA: "Upgrade Now" → links to pricing
- [ ] Zero activity variant: "[Child] didn't log in this week. Here's a fun topic they might enjoy: [Suggested Topic]"
- [ ] Unsubscribe link at bottom
- [ ] Template T4 from PRD

**Technical Notes:**
- Use node-cron / AWS EventBridge
- Query `practice_attempts`, `lesson_completions` for past 7 days
- Rate limit: Max 1 email per parent per week

**QA Checklist:**
- [ ] Email sends at correct time
- [ ] Data matches child's actual activity
- [ ] Upgrade CTA links correctly
- [ ] Unsubscribe works

---

### TASK-PARENT-012: Monthly Progress Summary (Premium)

| Field | Value |
|-------|-------|
| **Summary** | Premium parents receive detailed monthly trend email |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-011 |

**Acceptance Criteria:**
- [ ] Sent on 1st of every month
- [ ] Includes:
  - Month-over-month accuracy change (↑ or ↓ %)
  - Topics mastered count (accuracy ≥80% with ≥10 attempts)
  - Total hours this month
  - Average streak length
  - Weak topic trends: "[Topic] has been weak for 3 weeks"
- [ ] Celebratory element if improvement ≥10%: Share to WhatsApp button
- [ ] Only sent to parents with `subscription.status = 'active'`

**QA Checklist:**
- [ ] Only premium parents receive
- [ ] Trend data calculated correctly
- [ ] Share button works

---

## Epic: Upgrade Flow (Child-Initiated Conversion)

**Epic Goal:** Convert free parents to premium when child hits paywall.

---

### TASK-PARENT-013: Child-Initiated Premium Request

| Field | Value |
|-------|-------|
| **Summary** | Parent receives push notification when child requests premium feature |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | Student Journey TASK-012 |

**Acceptance Criteria:**
- [ ] Trigger: Child taps "Ask a Parent to Unlock" on freemium wall
- [ ] Insert into `parent_requests` table (profile_id, feature_requested, status='pending', created_at)
- [ ] Push notification text: "[Child Name] wants to take the '[Feature Name]'. Tap to unlock unlimited practice."
- [ ] Deeplink: `spinzy://upgrade?child_id={id}&feature={feature}`
- [ ] If push disabled: Show in-app badge on next login: "1 pending request from [Child Name]"
- [ ] Follow-up notification after 48 hours if no response (once only)

**Technical Notes:**
- Table: `parent_requests` (id, profile_id, feature, status, created_at, responded_at)
- Max 3 pending requests per child (oldest auto-expires)

**QA Checklist:**
- [ ] Push notification received
- [ ] Deeplink opens upgrade flow
- [ ] In-app badge appears if push disabled

---

### TASK-PARENT-014: Plan Selection Screen

| Field | Value |
|-------|-------|
| **Summary** | Parent sees simple pricing screen with comparison |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-013 |

**Acceptance Criteria:**
- [ ] Screen title: "Upgrade [Child Name]'s Learning."
- [ ] Max 2 plans:
  - Monthly: ₹299/month. Includes: Unlimited practice, tests, AI tutor, parent dashboard.
  - Annual: ₹1,999/year (Save 44%). Includes: All monthly + offline access + priority content generation.
- [ ] Annual plan highlighted as "Best Value" (subtle badge)
- [ ] 7-day free trial banner on both: "7 days free. Cancel anytime."
- [ ] Trust signals: "Secured by [Gateway]. No auto-renewal without reminder."
- [ ] FAQ accordion: "Can I cancel? When do I get charged? Sibling discount?"
- [ ] Tapping plan proceeds to payment

**QA Checklist:**
- [ ] Plans display correctly
- [ ] Annual shows savings calculation
- [ ] FAQ accordion works

---

### TASK-PARENT-015: Payment Integration (UPI + Card)

| Field | Value |
|-------|-------|
| **Summary** | Parent pays via UPI or credit/debit card |
| **Story Points** | 8 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-014 |

**Acceptance Criteria:**
- [ ] UPI as default first option
- [ ] UPI flow: Parent enters UPI ID OR selects app (Google Pay/PhonePe intent)
- [ ] Card option: Card number, expiry, CVV. Save card checkbox.
- [ ] Processing indicator: "Confirming payment..." (max 10 seconds)
- [ ] On success: Confetti animation + "[Child Name] now has unlimited practice! 🎉"
- [ ] Update `subscriptions` table: status='active', plan, start_date, end_date
- [ ] Generate invoice PDF
- [ ] Email invoice to parent within 5 minutes
- [ ] On failure: Clear error message with retry button (no generic "Error 500")

**Technical Notes:**
- Integration with: Razorpay / Cashfree / PhonePe
- Webhook for payment confirmation
- Table: `subscriptions` (id, profile_id, plan, status, start_date, end_date, payment_gateway_id)

**QA Checklist:**
- [ ] UPI flow works
- [ ] Card flow works
- [ ] Subscription record created
- [ ] Invoice emailed
- [ ] Failure shows actionable error

---

### TASK-PARENT-016: Post-Payment Child Session Update

| Field | Value |
|-------|-------|
| **Summary** | Child's active session reflects premium status immediately |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-015 |

**Acceptance Criteria:**
- [ ] On payment success: Server emits WebSocket event to child's session
- [ ] Child sees toast: "Your parent unlocked Premium! 🎉 Redirecting to your quiz..."
- [ ] Freemium wall auto-dismisses
- [ ] Child lands on requested feature
- [ ] If child offline: Premium status updates on next app open (token refresh)

**QA Checklist:**
- [ ] WebSocket event triggers
- [ ] Child sees toast notification
- [ ] Offline sync works on next open

---

### TASK-PARENT-017: Payment Failure Recovery

| Field | Value |
|-------|-------|
| **Summary** | Graceful recovery with retry and email reminders |
| **Story Points** | 3 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-015 |

**Acceptance Criteria:**
- [ ] Failure screen shows specific reason: "Insufficient balance" / "Bank timeout" / "Invalid UPI PIN"
- [ ] Retry button prominent. "Change payment method" link visible.
- [ ] If parent closes: Send reminder email after 24 hours:
  - "[Child Name]'s premium access is waiting! Complete your payment to unlock unlimited practice."
  - Direct payment link (no re-selecting plan)
- [ ] Max 2 reminders. Stop after 7 days.
- [ ] Abandoned cart logged for analytics

**QA Checklist:**
- [ ] Error message specific to failure type
- [ ] Reminder emails sent with correct cadence
- [ ] Abandoned cart logged

---

## Epic: Premium Parent Dashboard

**Epic Goal:** Real-time visibility and active coaching tools.

---

### TASK-PARENT-018: Parent Profile Switcher with PIN

| Field | Value |
|-------|-------|
| **Summary** | Parent accesses dashboard via profile picker + 4-digit PIN |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-009 |

**Acceptance Criteria:**
- [ ] Profile picker shows: Parent name + "Parent" badge, each child name + avatar
- [ ] Selecting parent profile prompts 4-digit PIN
- [ ] PIN stored as hash in `users.parent_pin_hash`
- [ ] 3 incorrect attempts → lockout for 5 minutes
- [ ] "Forgot PIN" → resets via email OTP
- [ ] Child profiles have NO PIN (direct access)

**Technical Notes:**
- Hash PIN with bcrypt before storing
- Lockout stored in Redis with TTL

**QA Checklist:**
- [ ] PIN prompt appears
- [ ] Wrong PIN shows error, counts attempts
- [ ] Lockout after 3 failures
- [ ] Forgot PIN resets via email

---

### TASK-PARENT-019: Dashboard Core Metrics

| Field | Value |
|-------|-------|
| **Summary** | Premium parent sees real-time learning metrics for selected child |
| **Story Points** | 8 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-018 |

**Acceptance Criteria:**
- [ ] Dashboard displays for currently selected child (toggle if multiple)
- [ ] Core metrics cards:
  - Overall Accuracy % (trend arrow vs last week)
  - Total Time Spent This Week (hours/minutes)
  - Topics Mastered This Week (count)
  - XP Earned This Week
- [ ] Pull-to-refresh updates data
- [ ] Data refreshes every 30 seconds (polling) or via WebSocket
- [ ] Responsive: Mobile and tablet

**Technical Notes:**
- API endpoint: `GET /api/parent/dashboard/{child_profile_id}`
- Cache for 15 seconds (Redis)

**QA Checklist:**
- [ ] All metrics display correctly
- [ ] Trend arrows show correct direction
- [ ] Refresh works
- [ ] Responsive on all devices

---

### TASK-PARENT-020: Weak Topics Identification

| Field | Value |
|-------|-------|
| **Summary** | Dashboard highlights topics with accuracy <60% |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-019 |

**Acceptance Criteria:**
- [ ] Threshold: ≥3 attempts AND accuracy <60%
- [ ] Each weak topic card shows:
  - Topic name
  - Accuracy % (e.g., "42%")
  - Primary button: "Assign Practice"
  - Secondary link: "Request Better Notes" (priority AI generation)
- [ ] Empty state: "No weak topics detected this week. Great job, [Child]! 🎉"

**Technical Notes:**
- Query aggregates from `practice_attempts` joined with `topics`
- Recalculate on dashboard load and after each practice session

**QA Checklist:**
- [ ] Weak topics appear correctly
- [ ] Threshold (3 attempts + <60%) works
- [ ] Empty state shows encouragement

---

### TASK-PARENT-021: Assign Extra Practice

| Field | Value |
|-------|-------|
| **Summary** | Parent can assign custom practice set to child |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-020 |

**Acceptance Criteria:**
- [ ] Tapping "Assign Practice" generates 10-question set (same topic, varied difficulty)
- [ ] Confirmation toast: "10 [Topic] questions assigned to [Child Name]"
- [ ] Child receives push notification: "[Parent Name] assigned you extra practice on [Topic]. Complete it to earn 50 Bonus XP!"
- [ ] Assigned practice appears as glowing node on child's Learning Map
- [ ] On completion: Parent push notification "[Child] completed [Topic] practice. Accuracy: [X]% (↑ from [Y]%)"
- [ ] Assignment history in dashboard: "Assigned: Long Division (Apr 23). Completed: Apr 24. Score: 7/10"

**Technical Notes:**
- Table: `parent_assignments` (id, parent_profile_id, child_profile_id, topic_id, questions_json, status, assigned_at, completed_at, score)

**QA Checklist:**
- [ ] Assignment generates 10 questions
- [ ] Child receives notification
- [ ] Glowing node appears on Learning Map
- [ ] Completion notification sent to parent
- [ ] History recorded correctly

---

### TASK-PARENT-022: Screen Time Management

| Field | Value |
|-------|-------|
| **Summary** | Parent sets daily learning time limits per child |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-019 |

**Acceptance Criteria:**
- [ ] Dashboard Settings tab: "Daily Learning Limit"
- [ ] Options: 30 min / 60 min / 90 min / 120 min / Unlimited
- [ ] Default: 90 min (age <12) / 120 min (age 12+)
- [ ] Child hits limit → Study Buddy screen: "Great work today! You've studied for [X] minutes. Come back tomorrow!"
- [ ] "Parent Override" button (requires parent PIN on child's device)
- [ ] Separate limits for weekdays vs weekends
- [ ] Time tracking uses active session time (not background)

**Technical Notes:**
- Store limits in `child_settings` table
- Track active time via session start/end events

**QA Checklist:**
- [ ] Limit options saved correctly
- [ ] Child locked out after hitting limit
- [ ] Parent override works with PIN
- [ ] Weekday/weekend separate limits work

---

### TASK-PARENT-023: Multi-Child Dashboard Toggle

| Field | Value |
|-------|-------|
| **Summary** | Parent toggles between children's dashboards |
| **Story Points** | 3 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-009, TASK-PARENT-019 |

**Acceptance Criteria:**
- [ ] Dashboard top bar: Horizontal scrollable child tabs (e.g., "Aarav | Anaya")
- [ ] Current child tab highlighted (#FF6B35)
- [ ] Tapping tab switches all dashboard data (metrics, weak topics, assignments)
- [ ] No sibling comparison charts (prevents unhealthy competition)

**QA Checklist:**
- [ ] All children appear as tabs
- [ ] Tab switching updates all dashboard sections
- [ ] No sibling comparison visible

---

## Epic: Exam Season (Parent as Coach)

**Epic Goal:** Help parents prepare children for exams.

---

### TASK-PARENT-024: Exam Warrior Mode Activation

| Field | Value |
|-------|-------|
| **Summary** | Parent activates distraction-free exam mode from dashboard |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-019 |

**Acceptance Criteria:**
- [ ] Dashboard card appears Feb 1 (auto) or admin-set date: "Final Exams approaching! Activate Exam Warrior Mode?"
- [ ] Toggle ON:
  - Child's app switches to Dark Theme
  - Gamification minimized (no coin animations)
  - Home screen shows exam countdown timer
  - Practice defaults to timed mock test format
- [ ] Toggle OFF: Returns to standard Learning Map
- [ ] Manual toggle available anytime

**Technical Notes:**
- Admin-configurable date range
- Settings stored in `child_settings.exam_mode`

**QA Checklist:**
- [ ] Card appears on correct date
- [ ] Toggle changes child's app theme
- [ ] Countdown timer visible
- [ ] Manual toggle works

---

### TASK-PARENT-025: Mock Test Scheduler

| Field | Value |
|-------|-------|
| **Summary** | Parent schedules timed mock tests for child |
| **Story Points** | 8 |
| **Priority** | P2 |
| **Dependencies** | Student Journey TASK-008 |

**Acceptance Criteria:**
- [ ] Dashboard tab: "Mock Tests"
- [ ] Parent selects: Subject, Chapters, Date, Time Window, Duration (1hr/2hr/3hr)
- [ ] At scheduled time: Child push notification "Your [Subject] Mock Test starts now!"
- [ ] Test locks other app features during exam window
- [ ] Auto-graded on completion
- [ ] Parent push: "[Child]'s [Subject] Mock Test scores are ready"
- [ ] Report: Section-wise accuracy, time per question, comparison to previous

**Technical Notes:**
- Table: `mock_tests` (id, parent_id, child_id, subject, chapters, scheduled_at, duration, status, score)

**QA Checklist:**
- [ ] Schedule creates mock test record
- [ ] Notification triggers at scheduled time
- [ ] Test locks other features
- [ ] Auto-grading works
- [ ] Report shows correctly

---

### TASK-PARENT-026: Revision Plan Generator

| Field | Value |
|-------|-------|
| **Summary** | Auto-generate daily revision plan based on exam date and weak topics |
| **Story Points** | 8 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-020, TASK-PARENT-025 |

**Acceptance Criteria:**
- [ ] Dashboard tool: "Revision Plan Generator"
- [ ] Parent inputs: Subject + Exam Date
- [ ] System analyzes:
  - All topics in curriculum for that subject
  - Child's accuracy on each topic (from practice history)
  - Days remaining
- [ ] Generates daily plan: "Day 1: Revise Long Division (weak). Day 2: Practice Fractions (strong)..."
- [ ] Plan appears as daily quests on child's Learning Map
- [ ] Plan adapts: If child misses a day, redistribute remaining topics

**Technical Notes:**
- Algorithm: Prioritize weak topics, space repetition logic
- Store plan in `revision_plans` table

**QA Checklist:**
- [ ] Plan generates correctly based on weak topics
- [ ] Daily quests appear on Learning Map
- [ ] Plan adapts if child misses days

---

## Epic: Retention & Advocacy

**Epic Goal:** Reduce churn, encourage referrals, handle cancellation gracefully.

---

### TASK-PARENT-027: Referral Program

| Field | Value |
|-------|-------|
| **Summary** | Parent invites friends via WhatsApp and tracks rewards |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-001 |

**Acceptance Criteria:**
- [ ] Dashboard card: "Invite a friend. You both get 1 month free."
- [ ] Share sheet opens WhatsApp with pre-filled message + referral link
- [ ] Referral dashboard shows:
  - Invited: X
  - Joined: Y (signed up via link)
  - Subscribed: Z (converted to premium)
  - Reward earned: Z free months
- [ ] Reward auto-applied as subscription extension

**Technical Notes:**
- Table: `referrals` (id, referrer_user_id, referred_email, status, reward_applied_at)
- Unique referral code per user

**QA Checklist:**
- [ ] WhatsApp share opens with correct link
- [ ] Referral tracking counts correctly
- [ ] Reward auto-applies when referred user subscribes

---

### TASK-PARENT-028: Annual Renewal Reminders

| Field | Value |
|-------|-------|
| **Summary** | Timely, non-aggressive reminders before subscription expires |
| **Story Points** | 3 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-015 |

**Acceptance Criteria:**
- [ ] 30 days before expiry: Email "Your Spinzy Premium year is ending soon"
- [ ] 14 days before: In-app banner (non-dismissible)
- [ ] 7 days before: Push notification
- [ ] 1 day before: Email + Push
- [ ] Expiry day: Child sees freemium wall with "Ask Mom to renew!"
- [ ] Renewal is one-tap (saved payment method)

**QA Checklist:**
- [ ] Reminders send at correct intervals
- [ ] In-app banner appears
- [ ] One-tap renewal works

---

### TASK-PARENT-029: Cancellation Flow with Win-Back

| Field | Value |
|-------|-------|
| **Summary** | Friction-minimal cancellation with win-back offers |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-PARENT-015 |

**Acceptance Criteria:**
- [ ] Settings → Manage Subscription → Cancel Subscription
- [ ] Exit survey (single screen, not multiple modals):
  - Options: Too expensive / Child not using / Found alternative / Taking a break / Other
- [ ] If "Too expensive": Offer 50% off for 3 months. "Would you stay at ₹149/month?"
- [ ] If "Child not using": Offer pause for up to 3 months (no charge)
- [ ] If other: Confirm cancellation. No dark patterns (no "Are you sure?" x3)
- [ ] Post-cancellation screen: "Download [Child]'s learning history before you go."
- [ ] 30 days post-cancellation: One re-engagement email

**QA Checklist:**
- [ ] Cancellation completes in ≤3 taps
- [ ] Win-back offer appears for "Too expensive"
- [ ] Pause option for "Child not using"
- [ ] Re-engagement email sends once

---

### TASK-PARENT-030: Learning History Export (PDF)

| Field | Value |
|-------|-------|
| **Summary** | Parent downloads complete learning history as PDF |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-PARENT-019 |

**Acceptance Criteria:**
- [ ] Settings → Download Learning History
- [ ] PDF includes:
  - Child name, grade, board
  - Subscription period (if any)
  - All topics studied with accuracy %
  - Weak topics summary
  - Total XP, streak history
  - Mock test scores (if any)
- [ ] Generated server-side, emailed within 5 minutes
- [ ] Available for 90 days post-cancellation

**Technical Notes:**
- Use PDFKit or Puppeteer for PDF generation
- Queue for async generation

**QA Checklist:**
- [ ] PDF contains all required fields
- [ ] Emailed within 5 minutes
- [ ] Available post-cancellation for 90 days

---

## Summary: All Parent Journey Tasks

| Task ID | Summary | Points | Priority |
|---------|---------|--------|----------|
| PARENT-001 | Landing page with Google Sign-In | 5 | P0 |
| PARENT-002 | Referral landing page variant | 3 | P1 |
| PARENT-003 | School partnership landing page | 3 | P1 |
| PARENT-004 | Add child profile form | 5 | P0 |