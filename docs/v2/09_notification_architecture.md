<!--
FILE OBJECTIVE:
- Comprehensive notification architecture for Vidya AI tutor platform — defines student/parent notification triggers, severity levels, channel strategies, and centralized messaging templates for all learning, engagement, and lifecycle events.

LINKED UNIT TEST:
- tests/unit/docs/09_notification_architecture.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/ENGINEERING_PRACTICES.md
- /docs/COPILOT_GUARDRAILS.md
- /.github/copilot-instructions.md

EDIT LOG:
- 2026-05-09T00:00:00Z | staff-engineer | created comprehensive notification architecture with centralized mail/whatsapp template requirements
-->

# NOTIFICATION ARCHITECTURE — VIDYA AI TUTOR PLATFORM

## Executive Summary

Notifications in an AI tutoring product are not communication—they are part of the **learning psychology system**. Poor notification design leads to:

- **Notification fatigue** → unsubscribe / churn
- **Wrong channel usage** → missed critical information
- **Anxiety-inducing messaging** → parent distrust
- **Parent spam** → reduced engagement
- **No prioritization** → signal lost in noise

This document defines a **notification-first behavioral framework** that optimizes for:

- **Student**: continuation, motivation, clarity, actionability
- **Parent**: trust, visibility, reassurance, intervention calibration

---

## Core Design Principles

### Principle 1: Psychology Over Frequency

Every notification must change student/parent behavior positively. Random triggers destroy trust.

**Rule**: If you cannot articulate why a notification should change behavior, do not send it.

### Principle 2: Channel Is Part of Message

- **WhatsApp** = immediate action / emotional connection / time-sensitive
- **Email** = detailed context / reports / trust building
- **In-app** = celebration / progress feedback / no urgency

Mixing channels weakens signal.

### Principle 3: Never Send Raw Failure Signals

| ❌ BAD                                            | ✅ GOOD                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------|
| "Your child scored 35% in Algebra."             | "Vidya noticed Aarav may benefit from additional Algebra practice. Revision ready." |
| "Weak topic detected in Fractions."             | "Fractions + 20% practice can unlock the next concept. Let's start a session?"      |
| "Student missed 3 days of learning."            | "Let's build momentum again. Your personalized plan is waiting."                    |
| "Child has not logged in for 7 days."           | "Aarav's learning journey is paused. We'd love to continue together."               |

**Psychological Impact**: Reframe deficits as opportunities, not failures.

### Principle 4: Parent Notifications = Reassurance, Not Surveillance

Parents have low digital literacy and high anxiety. Notifications must answer:

- Is my child learning? ✅
- Is my child making progress? ✅
- Should I intervene? (rarely)

Never send:
- Keystroke counts
- Session duration obsession
- Comparison to other students
- Failure-focused metrics

---

## Notification Severity Framework

### Level 1 — Informational (Low Urgency)

Examples:
- Streak maintained
- Lesson completed
- Revision reminder
- Concept mastered
- Daily study summary

**Channel**: In-app → Push → Optional WhatsApp

**Send Frequency**: 1–2 per day max

**Tone**: Celebratory, supportive

---

### Level 2 — Important (Medium Urgency)

Examples:
- Missed 1 study session
- Weak topic pattern detected
- Exam approaching (countdown)
- Improvement milestone
- Mock test completed

**Channel**: Push → WhatsApp → Digest Email

**Send Frequency**: 2–4 per week

**Tone**: Constructive, action-oriented

---

### Level 3 — Critical (High Urgency)

Examples:
- Severe disengagement (7+ days)
- Major exam risk detected
- Payment failure
- Suspicious account activity
- Repeated concept avoidance

**Channel**: WhatsApp → Email → Parent Alert

**Send Frequency**: Immediate (rare)

**Tone**: Urgent but supportive, not panicked

---

## Golden Rule — Event Type × Actor Matrix

| Event Type                  | Student | Parent           | Channel Strategy                    |
| --------------------------- | ------- | ---------------- | ----------------------------------- |
| Daily learning              | YES     | Sometimes        | In-app + Push; Parent: daily digest |
| Progress milestone          | YES     | YES              | WhatsApp + Email                    |
| Weak performance detection  | Gentle  | Carefully        | In-app + Push; Parent: weekly only  |
| Missed learning (1–3 days)  | YES     | NO               | Push only                           |
| Severe disengagement (7+)   | YES     | YES              | WhatsApp + Email                    |
| Exam readiness              | YES     | YES              | Push + WhatsApp + Email             |
| Improvement detected        | YES     | YES              | In-app + WhatsApp                   |
| Billing/payment             | Rare    | YES              | Email + WhatsApp                    |
| Dispute/Safety             | YES     | YES              | Email + WhatsApp (immediate)        |

---

## Production Notification Matrix

### A. ONBOARDING & ACTIVATION

#### 1. Signup Completed

**Trigger**: POST /api/auth/signup success + parent OTP verified (for minors)

**Student**
- Channel: Email + WhatsApp
- Template: `STUDENT_WELCOME`
- Purpose: Setup guidance, first study session CTA
- Delay: Immediate

**Parent** (if student age < 18)
- Channel: Email + WhatsApp
- Template: `PARENT_WELCOME`
- Purpose: Trust building, explain learning system, set expectations
- Delay: Immediate

---

#### 2. Diagnostic Completed

**Trigger**: POST /api/student/diagnostic/submit success

**Student**
- Channel: In-app (visual Knowledge Map)
- Template: None (in-app modal)
- Purpose: Celebrate effort, show starting point
- Delay: Immediate

**Parent** (optional, via digest)
- Channel: Daily digest
- Template: `PARENT_DAILY_DIGEST`
- Purpose: Include in "started diagnostic" event
- Delay: End of day

---

#### 3. Learning Plan Generated

**Trigger**: POST /api/student/onboarding/generate-plan success

**Student**
- Channel: In-app + Push
- Template: `STUDENT_PLAN_READY`
- Purpose: Excitement, first session CTA
- Delay: Immediate

**Parent**
- Channel: WhatsApp
- Template: `PARENT_PLAN_GENERATED`
- Purpose: Structured planning visibility (parents love this)
- Delay: Immediate

---

### B. DAILY LEARNING FLOW

#### 4. Daily Study Reminder

**Trigger**: Cron job at student's preferred study time (or 5 PM default)

**Condition**: Student has not started session today AND has ≤1 session in last 7 days

**Student**
- Channel: Push
- Template: `STUDENT_DAILY_REMINDER`
- Tone: Supportive, calm, never guilt
- Example: "Continue your Math revision whenever ready. Your 3-day streak is waiting!"
- Delay: Preferred time or 5 PM

---

#### 5. Study Goal Completed

**Trigger**: POST /api/session/[sessionId]/complete success

**Student**
- Channel: In-app
- Template: None (in-session celebration modal)
- Purpose: Instant positive reinforcement
- Delay: Immediate

**Parent** (via digest only)
- Channel: Daily digest
- Template: Included in `PARENT_DAILY_DIGEST`
- Purpose: Avoid spamming for every completion
- Delay: End of day

---

#### 6. Streak Milestones (3, 7, 14, 30 days)

**Trigger**: StreakWidget milestone detection at session completion

**Student (3–7 days)**
- Channel: In-app + Push
- Template: `STUDENT_STREAK_MILESTONE_{N_DAYS}`
- Purpose: Motivation, celebrate consistency
- Delay: Immediate

**Student (14–30+ days)**
- Channel: In-app + Push + WhatsApp
- Template: `STUDENT_STREAK_MILESTONE_{N_DAYS}`
- Purpose: Major celebration, social proof
- Delay: Immediate

**Parent (7+ days only)**
- Channel: WhatsApp
- Template: `PARENT_STREAK_MILESTONE_{N_DAYS}`
- Purpose: Visible progress to parent
- Delay: Immediate

---

### C. LEARNING RISK SCENARIOS

⚠️ **CRITICAL CATEGORY**: This is where good products differ from spammy products.

---

#### 7. Student Missed 1 Day (no session in last 24h)

**Trigger**: Cron job at 9 PM (daily)

**Condition**: Last session > 24 hours ago AND < 3 consecutive days missed

**Student**
- Channel: Push only
- Template: `STUDENT_MISSED_ONE_DAY`
- Tone: Gentle, invitation (not guilt)
- Example: "Let's continue where you left off. Your session is saved."
- Delay: Immediate

**Parent**
- Channel: None (do not notify yet)
- Rationale: Too early, not a pattern yet

---

#### 8. Student Missed 3 Consecutive Days

**Trigger**: Cron job (daily) when `consecutiveMissedDays === 3`

**Student**
- Channel: Push + WhatsApp
- Template: `STUDENT_MISSED_THREE_DAYS`
- Tone: Supportive, acknowledge difficulty
- Example: "Aarav, momentum matters. A 15-min session today keeps your streak alive."
- Delay: Immediate

**Parent**
- Channel: WhatsApp
- Template: `PARENT_MISSED_THREE_DAYS`
- Tone: Constructive, not alarming
- Example: "Aarav hasn't continued learning for a few days. A small revision session today can help maintain momentum."
- Delay: Immediate

---

#### 9. Severe Disengagement (7+ Consecutive Days)

**Trigger**: Cron job (daily) when `consecutiveMissedDays >= 7`

**Student**
- Channel: WhatsApp + Email
- Template: `STUDENT_DISENGAGED_CRITICAL`
- Tone: Caring, offer support
- Purpose: Re-activation attempt
- Delay: Immediate

**Parent**
- Channel: WhatsApp + Email
- Template: `PARENT_DISENGAGED_CRITICAL`
- Tone: Escalation (without panic)
- Purpose: Parental intervention
- Delay: Immediate

**Additional**
- Mark in DB: `StudentEngagement.escalationStatus = 'CRITICAL'`
- Flag for support team review

---

### D. PERFORMANCE & LEARNING INTELLIGENCE

#### 10. Weak Topic Detection (Single Instance)

**Trigger**: Session result shows < 40% accuracy in a concept

**Student**
- Channel: In-app (end of session)
- Template: `STUDENT_WEAK_TOPIC_SINGLE`
- Tone: Opportunity-focused
- Example: "Fractions are tricky—that's normal. Let's practice with simpler examples."
- Delay: Immediate (in-session)

**Parent**
- Channel: None (wait for pattern)
- Rationale: Single instance is noise

---

#### 11. Weak Topic Pattern (3+ Attempts, <40% Avg)

**Trigger**: StudentConceptState.masteryScore updates when accuracy pattern emerges

**Student**
- Channel: In-app + Push
- Template: `STUDENT_WEAK_TOPIC_PATTERN`
- Purpose: Suggest focused practice
- Delay: Within 1 hour

**Parent** (only if exam-related AND exam < 30 days)
- Channel: WhatsApp
- Template: `PARENT_WEAK_TOPIC_PATTERN_EXAM`
- Purpose: Alert if high-weightage topic weak
- Delay: Immediate (exam scenario only)

---

#### 12. Strong Improvement Detected

**Trigger**: StudentConceptState.masteryScore increases by ≥25% points from baseline

**Student**
- Channel: In-app + WhatsApp
- Template: `STUDENT_IMPROVEMENT_DETECTED`
- Tone: Celebration, reinforce effort
- Example: "Your accuracy in Algebra jumped from 45% → 72%. That's real progress!"
- Delay: Immediate

**Parent**
- Channel: WhatsApp
- Template: `PARENT_IMPROVEMENT_DETECTED`
- Tone: Confident, visible proof
- Purpose: **VERY important psychologically** — parents love visible improvement
- Delay: Immediate

---

#### 13. Concept Mastered (≥75% Mastery)

**Trigger**: StudentConceptState.masteryScore reaches ≥ 75 after session

**Student**
- Channel: In-app (visual badge on knowledge map)
- Template: `STUDENT_CONCEPT_MASTERED`
- Tone: Celebration
- Delay: Immediate

**Parent** (via weekly summary only)
- Channel: Email (in weekly report)
- Template: Included in `PARENT_WEEKLY_REPORT`
- Purpose: Aggregate progress
- Delay: Weekly digest

---

### E. EXAM PREPARATION (Highest-Value Notification Category)

#### 14. Exam Countdown Begins (examDate - 30 days)

**Trigger**: Scheduled job when `daysToExam === 30`

**Student**
- Channel: Push + In-app
- Template: `STUDENT_EXAM_COUNTDOWN`
- Purpose: Activate exam mode psychology
- Delay: Morning (7 AM)

**Parent**
- Channel: WhatsApp + Email
- Template: `PARENT_EXAM_COUNTDOWN`
- Purpose: Align expectations, structured timeline
- Delay: Immediate

---

#### 15. Revision Plan Generated

**Trigger**: POST /api/student/learning-plan/exam-mode success

**Student**
- Channel: In-app + WhatsApp
- Template: `STUDENT_REVISION_PLAN_READY`
- Purpose: Excitement, structured clarity
- Delay: Immediate

**Parent**
- Channel: WhatsApp + Email
- Template: `PARENT_REVISION_PLAN_READY`
- Purpose: **Parents LOVE structured planning visibility**
- Content: Week-by-week breakdown, weak area focus, revision schedule
- Delay: Immediate

---

#### 16. Mock Test Scheduled

**Trigger**: LearningPlanItem created with type = MOCK_EXAM

**Student**
- Channel: Push
- Template: `STUDENT_MOCK_TEST_SCHEDULED`
- Purpose: Prepare student mentally
- Delay: 3 days before test

**Parent** (optional)
- Channel: Email
- Template: None (mentioned in weekly digest)

---

#### 17. Mock Test Completed

**Trigger**: Session completed with sessionType = MOCK_EXAM

**Student**
- Channel: In-app (instant detailed feedback)
- Template: `STUDENT_MOCK_FEEDBACK`
- Content: Strengths, weak areas, action plan (NOT raw marks)
- Delay: Immediate

**Parent**
- Channel: Email + WhatsApp (summary)
- Template: `PARENT_MOCK_SUMMARY`
- Content: Performance overview, top 3 weak areas, revision recommendations
- Delay: Within 1 hour

---

#### 18. High Exam Risk Detected

**Trigger**: StudentExamReadiness.riskScore > 0.6 (low mastery in high-weightage topics)

**Student**
- Channel: Push + In-app
- Template: `STUDENT_EXAM_RISK_ALERT`
- Tone: Constructive, not panic-inducing
- Example: "Vectors account for 15% of your exam. Let's focus here to boost your score."
- Delay: Immediate

**Parent**
- Channel: WhatsApp + Email
- Template: `PARENT_EXAM_RISK_ALERT`
- Tone: Professional, offers structured intervention
- Delay: Immediate

---

### F. AI TUTOR INTERACTION EVENTS

#### 19. Student Asked Many Doubts (Session Pattern)

**Trigger**: Session with ≥5 doubt questions asked

**Student**
- Channel: None (encourage healthy behavior, no notification)
- Rationale: Asking doubts is good—normalize, never penalize

**Parent**
- Channel: None (do not aggregate doubts instantly)
- Rationale: Feels invasive, creates anxiety
- Better: Use weekly digest for aggregated insights

---

#### 20. AI Detected Confusion Pattern

**Trigger**: Multiple sessions in same concept + repetitive questions

**Student**
- Channel: In-app + Push
- Template: `STUDENT_CONFUSION_PATTERN`
- Purpose: Suggest prerequisite review
- Delay: Immediate

**Parent** (via weekly report only)
- Channel: Email (weekly)
- Template: Included in `PARENT_WEEKLY_REPORT`
- Content: "Vidya noticed Aarav may benefit from reviewing [Prerequisite]. A personalized lesson is ready."
- Delay: Weekly digest

---

### G. REPORTING & DIGESTS (Notification Spam Prevention)

#### 21. Daily Learning Digest (Parent, Optional)

**Trigger**: Scheduled job at 10 PM (daily)

**Recipient**: Parent (opt-in)

**Template**: `PARENT_DAILY_DIGEST`

**Content**:
- Time studied today
- Topics covered
- Consistency check
- Single CTA (review plan / start session)

**Format**: Short, scannable (max 5 lines)

**Example**:
```
Hi [ParentName],

Today's learning update:
✅ 45 minutes in Math + Science
📚 Topics: Quadratic Equations (Practice), Photosynthesis (Learn)
🔥 7-day streak maintained

Keep it going! Check the app for details.
```

---

#### 22. Weekly Learning Report (Parent, Mandatory)

**Trigger**: Scheduled job every Sunday at 7 PM

**Recipient**: Parent

**Template**: `PARENT_WEEKLY_REPORT`

**Content**:
- Study consistency (days studied / 7)
- Total time invested
- Topics mastered (badges)
- Topics needing focus (with action plan)
- Exam readiness score (if exam set)
- AI recommendations
- Weekly streak status

**Format**: Structured email, ~500 words

**Key**: This is a **retention engine** — most important parent touchpoint

---

#### 23. Monthly Progress Report

**Trigger**: Scheduled job on first Monday of month

**Recipient**: Parent

**Template**: `PARENT_MONTHLY_REPORT`

**Content**:
- Mastery growth trajectory (% improvement)
- Engagement trends (uptrend / stable / declining)
- Subjects with highest growth
- Exam readiness projection (if exam set)
- Personalized AI recommendations for next month
- Comparative insights (without naming peers)

**Format**: Professional email + visual charts (if available)

---

### H. BILLING & SUBSCRIPTION LIFECYCLE

#### 24. Trial Ending (3 Days Before)

**Trigger**: Scheduled job when `trialExpiresAt - 3 days`

**Student**
- Channel: In-app banner (no push, no email pressure)
- Template: None (in-app only)
- Purpose: Low-pressure awareness
- Tone: Supportive, not pushy

**Parent**
- Channel: WhatsApp + Email
- Template: `PARENT_TRIAL_ENDING`
- Tone: Value-based (not fear-based)
- Example: "Aarav's learning journey has just begun. Continue with a ₹399/month plan."
- Delay: 3 days before

---

#### 25. Trial Ended

**Trigger**: `trialExpiresAt <= now`

**Student**
- Channel: In-app banner
- Template: None
- Purpose: Clear CTA to subscribe

**Parent**
- Channel: Email (calm, final offer)
- Template: `PARENT_TRIAL_ENDED`
- Delay: Day of expiry

---

#### 26. Payment Success

**Trigger**: Webhook from Razorpay → POST /api/billing/webhook

**Student**
- Channel: None (minimal celebration)
- Rationale: Payment is parent action, not student benefit

**Parent**
- Channel: Email + WhatsApp
- Template: `PARENT_PAYMENT_SUCCESS`
- Content: Invoice, subscription details, next billing date
- Delay: Immediate

---

#### 27. Payment Failure

**Trigger**: Webhook from Razorpay → payment.failed

**Student**
- Channel: None

**Parent**
- Channel: WhatsApp + Email (high priority)
- Template: `PARENT_PAYMENT_FAILED`
- Tone: Supportive, action-oriented (not accusatory)
- Delay: Immediate

---

### I. SAFETY & TRUST EVENTS

#### 28. Suspicious Activity (Multiple Failed Logins)

**Trigger**: ≥3 failed login attempts in 15 minutes

**Student**
- Channel: Email (security notice)
- Template: `STUDENT_SECURITY_ALERT`

**Parent**
- Channel: Email + WhatsApp
- Template: `PARENT_SECURITY_ALERT`
- Tone: Professional, offer support
- Delay: Immediate

---

#### 29. New Device Login

**Trigger**: Session created from new device fingerprint

**Student**
- Channel: Email (confirmation)
- Template: `STUDENT_NEW_DEVICE_LOGIN`

**Parent** (optional, if available)
- Channel: Email (FYI)
- Template: `PARENT_NEW_DEVICE_LOGIN`

---

---

## Channel Strategy & Rules

### WhatsApp Strategy

**Use WhatsApp for**:
- Time-sensitive reminders (study time approaching)
- Milestone celebrations (streaks, mastery)
- Risk escalations (disengagement, exam risk)
- Payment alerts (success, failure)
- Exam countdowns and revision plans

**Characteristics**:
- Short (1–2 sentences)
- Emotional/action-oriented
- No links (or short links only)
- Personal tone (use student/parent name)
- Time-bounded (send within study hours or early evening)

**Max Frequency**:
- Student: 1–2 per day (never >3)
- Parent: 2–3 per week (never >5)

**Template Format**:
```
Hi [StudentName]/[ParentName],

[Action-oriented body]

[CTA or motivational closing]
```

### Email Strategy

**Use Email for**:
- Detailed reports (weekly, monthly)
- Structured information (learning plans, exam prep)
- Legal/billing (receipts, subscription details)
- Trust-building (progress narratives)
- Referral invitations

**Characteristics**:
- Structured, scannable layout
- Rich formatting (headings, bullets, colors)
- Comprehensive (500–1500 words typical)
- Professional tone
- Links and CTAs integrated

**Max Frequency**:
- Student: 1 per week (rare)
- Parent: 2–3 per week (digest + reports)

**Template Format**:
```
Subject: [Descriptive, action-oriented]

Hi [Name],

[Context paragraph]

[Main content (structured sections)]

[CTA]
[Closing with signature]
```

### In-App Notifications

**Use In-App for**:
- Celebration (session complete, concept mastered)
- Gentle suggestions (weak topic detected)
- Progress feedback (accuracy improved)
- Feature invitations (revisit, explore)
- No urgency items (user can see at their own pace)

**Characteristics**:
- Instant gratification
- Visual/gamified
- Highly contextual
- Optional "dismiss" always available
- Never blocking

---

## Centralized Implementation Architecture

### lib/mail.ts — Email Template Management

All email sending MUST go through a single, centralized mail module.

**Structure**:
```typescript
// lib/mail.ts

export interface EmailTemplate {
  id: string
  subject: (context: any) => string
  htmlBody: (context: any) => string
  textBody: (context: any) => string
  from: string
  to: (context: any) => string
  cc?: (context: any) => string[]
}

// Catalog of all email templates
export const EMAIL_TEMPLATES = {
  STUDENT_WELCOME: EmailTemplate,
  PARENT_WELCOME: EmailTemplate,
  STUDENT_PLAN_READY: EmailTemplate,
  PARENT_DAILY_DIGEST: EmailTemplate,
  PARENT_WEEKLY_REPORT: EmailTemplate,
  PARENT_MONTHLY_REPORT: EmailTemplate,
  PARENT_EXAM_COUNTDOWN: EmailTemplate,
  PARENT_IMPROVEMENT_DETECTED: EmailTemplate,
  PARENT_PAYMENT_SUCCESS: EmailTemplate,
  PARENT_PAYMENT_FAILED: EmailTemplate,
  // ... all 30+ templates
}

// Send function with validation
export async function sendEmail(
  templateId: string,
  context: Record<string, any>,
  options?: { delay?: number; priority?: 'high' | 'normal' }
): Promise<{ success: boolean; messageId?: string; error?: string }>

// Batch send for digests
export async function sendEmailBatch(
  emails: Array<{ templateId: string; context: any }>
): Promise<{ sent: number; failed: number }>

// From addresses (constants)
export const EMAIL_FROM = {
  SUPPORT: 'support@vidya.ai',
  NOREPLY: 'noreply@vidya.ai',
  LEARNING: 'learning@vidya.ai',
  BILLING: 'billing@vidya.ai',
}

// Subject line templates (constants)
export const EMAIL_SUBJECTS = {
  WELCOME: 'Welcome to Vidya, [StudentName]!',
  PLAN_READY: 'Your personalized learning plan is ready',
  WEEKLY_REPORT: 'Aarav\'s Weekly Learning Report — [WeekOf]',
  // ... all subjects
}
```

**Usage**:
```typescript
// In any service or API route
import { sendEmail } from '@/lib/mail'

await sendEmail('PARENT_WEEKLY_REPORT', {
  parentName: 'Mrs. Sharma',
  studentName: 'Aarav',
  studyHours: 5.25,
  consistency: 6,
  masteryConcepts: ['Quadratic Equations', 'Photosynthesis'],
  examReadinessScore: 0.72,
})
```

---

### lib/whatsapp.ts — WhatsApp Template Management

All WhatsApp messages MUST go through a single, centralized WhatsApp module.

**Structure**:
```typescript
// lib/whatsapp.ts

export interface WhatsAppTemplate {
  id: string
  body: (context: any) => string
  mediaUrl?: (context: any) => string
  cta?: (context: any) => { text: string; url: string }
  mediaType?: 'image' | 'document' | 'video'
}

// Catalog of all WhatsApp templates
export const WHATSAPP_TEMPLATES = {
  STUDENT_WELCOME: WhatsAppTemplate,
  PARENT_WELCOME: WhatsAppTemplate,
  STUDENT_DAILY_REMINDER: WhatsAppTemplate,
  STUDENT_STREAK_MILESTONE_7: WhatsAppTemplate,
  PARENT_STREAK_MILESTONE_7: WhatsAppTemplate,
  STUDENT_MISSED_THREE_DAYS: WhatsAppTemplate,
  PARENT_MISSED_THREE_DAYS: WhatsAppTemplate,
  STUDENT_IMPROVEMENT_DETECTED: WhatsAppTemplate,
  PARENT_IMPROVEMENT_DETECTED: WhatsAppTemplate,
  PARENT_EXAM_COUNTDOWN: WhatsAppTemplate,
  PARENT_REVISION_PLAN_READY: WhatsAppTemplate,
  STUDENT_EXAM_RISK_ALERT: WhatsAppTemplate,
  PARENT_EXAM_RISK_ALERT: WhatsAppTemplate,
  PARENT_PAYMENT_FAILED: WhatsAppTemplate,
  // ... all 25+ templates
}

// Send function
export async function sendWhatsApp(
  templateId: string,
  phoneNumber: string,
  context: Record<string, any>,
  options?: { priority?: 'high' | 'normal' }
): Promise<{ success: boolean; messageId?: string; error?: string }>

// Batch send
export async function sendWhatsAppBatch(
  messages: Array<{ templateId: string; phone: string; context: any }>
): Promise<{ sent: number; failed: number }>
```

**Usage**:
```typescript
// In any service or job
import { sendWhatsApp } from '@/lib/whatsapp'

await sendWhatsApp('PARENT_IMPROVEMENT_DETECTED', parentPhone, {
  parentName: 'Shreya',
  studentName: 'Aarav',
  concept: 'Algebra',
  oldAccuracy: '45%',
  newAccuracy: '72%',
})
```

---

### lib/notifications.ts — Centralized Notification Router

High-level service that decides which channel(s) to use for each event.

**Structure**:
```typescript
// lib/notifications.ts

export interface NotificationEvent {
  eventType: NotificationEventType
  studentId: string
  parentId?: string
  context: Record<string, any>
  severity: 'INFORMATIONAL' | 'IMPORTANT' | 'CRITICAL'
  dryRun?: boolean
}

export type NotificationEventType =
  | 'SIGNUP_COMPLETED'
  | 'DIAGNOSTIC_COMPLETED'
  | 'PLAN_GENERATED'
  | 'DAILY_REMINDER'
  | 'STUDY_COMPLETED'
  | 'STREAK_MILESTONE'
  | 'WEAK_TOPIC_DETECTED'
  | 'IMPROVEMENT_DETECTED'
  | 'DISENGAGED_3DAYS'
  | 'DISENGAGED_7DAYS'
  | 'EXAM_COUNTDOWN'
  | 'EXAM_RISK_ALERT'
  // ... all 30 event types

// Main routing logic
export async function routeNotification(event: NotificationEvent): Promise<RoutingResult>

// Event validation
export function validateNotificationEvent(event: NotificationEvent): ValidationError[]

// Log all notifications for audit
export async function logNotificationEvent(
  event: NotificationEvent,
  result: RoutingResult
): Promise<void>
```

**Routing Logic** (pseudo-code):
```typescript
function routeNotification(event) {
  const channels = []
  
  switch (event.eventType) {
    case 'SIGNUP_COMPLETED':
      channels.push('email', 'whatsapp')
      break
    case 'DAILY_REMINDER':
      channels.push('push')
      if (hasHighEngagement) channels.push('whatsapp')
      break
    case 'IMPROVEMENT_DETECTED':
      channels.push('in_app', 'whatsapp')
      if (student.age >= 16) channels.push('email')
      break
    case 'DISENGAGED_7DAYS':
      channels = ['whatsapp', 'email', 'push'] // all channels
      severity = 'CRITICAL'
      break
  }

  return Promise.all(channels.map(ch => sendViaChannel(...)))
}
```

---

## Template Catalog & Examples

### Student Welcome Email

**Template ID**: `STUDENT_WELCOME`

**Subject**: Welcome to Vidya, [StudentName]!

**Body**:
```
Hi [StudentName],

Welcome to Vidya! 🎓

You're now set up to start your personalized learning journey. Here's what's next:

Step 1: Complete your diagnostic test in [Subject]
This quick 20-minute test helps Vidya understand where you are and what you need to focus on.

Step 2: Get your personalized learning plan
Based on your diagnostic, you'll get a custom study plan that fits your exam timeline.

Step 3: Start your first learning session
Vidya will guide you through interactive lessons, examples, and practice.

Ready to begin? Tap the button below to start your diagnostic.

[CTA: Start Diagnostic]

Questions? Reply to this email or check our FAQ.

Best,
The Vidya Team
```

---

### Parent Weekly Report Email

**Template ID**: `PARENT_WEEKLY_REPORT`

**Subject**: [StudentName]'s Weekly Learning Report — Week of [Date]

**Body**:
```
Hi [ParentName],

Here's [StudentName]'s learning progress for the week of [DateRange]:

📊 CONSISTENCY
✅ Studied 6 out of 7 days
⏱️ Total time: 5 hours 45 minutes
🔥 Streak: 6 days (keep it going!)

📚 TOPICS COVERED
✓ Quadratic Equations (Mastery: 72%)
✓ Photosynthesis (Mastery: 58%)
→ Revision scheduled for Fractions

🎯 AREAS OF FOCUS
Based on this week's learning, Vidya recommends focusing on:
• Fractions fundamentals (3 practice sessions)
• Algebraic identities (review prerequisite)

📈 PROGRESS OVER TIME
Last month: 8 hours
This week: 5.75 hours
Trend: Stable ✓

[Exam Readiness (if applicable)]
Exam in 45 days | Current readiness: 68% | On track for target score

[CTA: Review Detailed Progress in App]

Have questions about [StudentName]'s progress? Reply to this email.

Best,
The Vidya Team
```

---

### Student Streak Milestone WhatsApp (7 Days)

**Template ID**: `STUDENT_STREAK_MILESTONE_7`

**Body**:
```
🔥 Aarav, you've got a 7-day streak! That's amazing.

You've been consistent all week. Your brain is building real learning momentum now.

Keep it going? Your next session is ready when you are. 💪
```

---

### Parent Missed 3 Days WhatsApp

**Template ID**: `PARENT_MISSED_THREE_DAYS`

**Body**:
```
Hi [ParentName],

Aarav hasn't continued learning for 3 days. A small revision session today can help him maintain momentum and protect his 6-day streak.

Would you like us to send him a reminder?
```

---

### Parent Exam Risk Alert WhatsApp

**Template ID**: `PARENT_EXAM_RISK_ALERT`

**Body**:
```
Hi [ParentName],

Vidya noticed that Vectors (15% of Aarav's exam) needs more focus. Current mastery: 42%.

A focused practice plan is ready. 2–3 sessions can boost this significantly.

Would you like to review the plan in the app?
```

---

### Student Improvement Detected WhatsApp

**Template ID**: `STUDENT_IMPROVEMENT_DETECTED`

**Body**:
```
🎉 Aarav, your Algebra accuracy jumped from 45% → 72%!

That's real progress. You're understanding it now. Keep this momentum! 🚀

Next up: Quadratic Equations (related concept)
```

---

## Notification Frequency Rules & Caps

### Student Notification Caps

| Channel  | Daily Max | Weekly Max | Exception                           |
| -------- | --------- | ---------- | ----------------------------------- |
| Push     | 3         | 15         | Exam mode: +2 per day allowed       |
| WhatsApp | 2         | 10         | Disengagement escalation: unlimited |
| Email    | 1         | 2          | Billing/security: separate limit    |
| In-app   | Unlimited | Unlimited  | No send-based limit (user paced)   |

---

### Parent Notification Caps

| Channel  | Daily Max | Weekly Max | Exception                           |
| -------- | --------- | ---------- | ----------------------------------- |
| Push     | 0         | 0          | Feature not used for parents        |
| WhatsApp | 2         | 8          | Critical escalation: unlimited      |
| Email    | 1         | 3          | Digest + weekly report + optional   |
| In-app   | 0         | 0          | Feature not used for parents        |

**Enforcement**:
- Every notification send increments daily/weekly counter
- Counter resets at 12 AM IST
- Exceeding caps = queue for next day or skip if non-critical

---

## Acceptance Criteria (Implementation)

### AC-01: Centralized Mail Module Exists

- [ ] `lib/mail.ts` exists with complete EMAIL_TEMPLATES catalog
- [ ] sendEmail() function tested with ≥5 template scenarios
- [ ] Email body interpolation works for all context variables
- [ ] Subject line dynamic generation tested
- [ ] FROM address constant used, never hardcoded

### AC-02: Centralized WhatsApp Module Exists

- [ ] `lib/whatsapp.ts` exists with complete WHATSAPP_TEMPLATES catalog
- [ ] sendWhatsApp() function tested with ≥5 template scenarios
- [ ] WhatsApp message body interpolation works
- [ ] Phone number validation before send
- [ ] WhatsApp provider (MSG91, Twilio, etc.) API integration complete

### AC-03: Notification Router Exists

- [ ] `lib/notifications.ts` with routeNotification() function
- [ ] All 30 event types correctly route to right channel(s)
- [ ] Severity levels mapped to channel combinations
- [ ] Dry-run mode works for testing
- [ ] Audit log created for every notification

### AC-04: Frequency Capping Works

- [ ] Daily/weekly counters incremented on every send
- [ ] Exceeding daily cap = queue to next day or skip
- [ ] Counter reset at 12 AM IST works correctly
- [ ] Tested with multiple rapid notifications

### AC-05: Template Catalog Complete

- [ ] All 30+ templates implemented with real copy (non-placeholder)
- [ ] Templates use consistent greeting/closing style
- [ ] No raw failure signals (all reframed positively)
- [ ] Parent templates avoid surveillance language
- [ ] Exam-related templates include actionable recommendations

### AC-06: No Hardcoded Strings in Routes/Services

- [ ] Grep finds zero email subject hardcodes outside lib/mail.ts
- [ ] Grep finds zero WhatsApp message hardcodes outside lib/whatsapp.ts
- [ ] All notification sends use library functions
- [ ] Email "from" address pulled from constant

### AC-07: Email/WhatsApp Sends Are Audited

- [ ] Every send logged to NotificationAudit table with: eventType, templateId, recipient, channel, timestamp, status
- [ ] Audit queryable by student/parent/date range
- [ ] Failed sends included in audit with error message
- [ ] Frequency cap enforcement visible in audit

### AC-08: Testing Requirements

- [ ] Unit tests for lib/mail.ts (template rendering, variable interpolation)
- [ ] Unit tests for lib/whatsapp.ts (template rendering, phone validation)
- [ ] Unit tests for lib/notifications.ts (routing logic, event validation)
- [ ] Integration test: end-to-end notification flow (event → send → audit log)
- [ ] Frequency cap tests (rapid notifications, counter reset)
- [ ] Email/WhatsApp content tests (no smart quotes, proper escaping)

---

## Production Deployment Checklist

- [ ] All templates copy-reviewed by Product + Legal
- [ ] WhatsApp provider credentials secure and tested
- [ ] Email provider (SendGrid/AWS SES) configured with SPF/DKIM
- [ ] Frequency caps tuned based on user feedback
- [ ] Dry-run mode enabled for first 24 hours
- [ ] Monitoring alerts set up (send failures, rate limits, opt-out rates)
- [ ] Audit logs queryable from admin dashboard
- [ ] Parent opt-out mechanism implemented
- [ ] Student can configure notification preferences
- [ ] Quiet hours respected (no notifications between 10 PM – 7 AM)

---

## Product Philosophy — Final

Notifications in Vidya should make:

- **Students feel**: "I'm supported. My learning matters. I can do this."
- **Parents feel**: "My child is learning with structure. Progress is happening. I'm not forgotten."

NOT:
- Pressured ❌
- Monitored excessively ❌
- Guilt-tripped ❌
- Overwhelmed ❌

**Golden Truth**: Your notification system is a behavioral learning engine. Design it as a teaching tool, not a sales channel.
