
<!--
FILE OBJECTIVE:
- Parent actor approach document covering monitoring, trust and subscription management; includes Parent Dashboard (F-PAR-010) requirements.

LINKED UNIT TEST:
- tests/unit/docs/parent_docs.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-17T00:00:00Z | assistant | Add Phase 2 timezone enhancement items and document implementation notes for F-PAR-010 (dual-timezone display); updated roadmap and tests/code references.
 - 2026-04-17T09:50:00Z | copilot | Add Phase 2 enhancement items for F-PAR-020 (Weekly Progress Digest) and note QA send/testing status.
-->

AI HOME TUTOR PLATFORM
Parent Actor
Approach Document — Monitoring, Trust & Subscription Management


Actor
Document Version
Scope
Stack
Parent
1.0 — MVP
MVP Phase 1 — ~1K concurrent
Node.js + TS + Prisma + Neon + React


CONFIDENTIAL — FOR INTERNAL REVIEW ONLY

1. Overview
The parent is the decision-maker and payment authority. They do not interact with the AI tutor directly. Their primary concerns are trust ("Is my child actually learning?"), value ("Is my money well spent?"), and safety ("Is my child safe online?"). The parent experience is deliberately simplified — designed for low digital literacy with a mobile-first, WhatsApp-native philosophy.

MVP CONSTRAINT
Parent features at MVP are scoped to: account creation + child linking, read-only progress dashboard, subscription management, and email/SMS notifications. WhatsApp two-way interaction is Phase 2.


1.1 Parent Persona
Attribute
Description
Age Range
30–55
Digital Literacy
Low to medium. Comfortable with WhatsApp and UPI payments. Not comfortable with dashboards.
Primary Device
Android smartphone. May share device with student.
Primary Language
Regional language (Hindi, Tamil, Telugu, etc.) — app must support regional UI language.
Decision Driver
Trust signals: board exam score improvement, time spent studying, teacher / tutor endorsement.
Payment Behaviour
Pays by UPI (70%), debit card (20%), EMI (10%). Monthly payment preferred over annual.
Communication Preference
WhatsApp (primary), SMS (fallback for feature phones), Email (invoices only).


1.2 Parent Journey Stages
Stage
Features
Phase
Account Setup
Registration, child profile creation, consent
MVP
Monitoring
Progress dashboard, session history, mastery view
MVP
Trust Building
Weekly digest, milestone alerts, exam readiness view
MVP
Payment
Subscription purchase, renewal, family plan, invoices
MVP
Active Communication
WhatsApp notifications, parent-AI chatbot, two-way updates
Phase 2
Intervention Control
Schedule override, topic focus request, AI difficulty adjustment
Phase 2



2. Account Setup & Child Linking
F-PAR-001
Parent Account Registration
MVP

Parent creates an account and links it to one or more child student profiles.
AC#
Acceptance Criterion
Priority
AC-01
Parent can register independently (without student) or be auto-prompted during student registration when student age < 13.
MUST
AC-02
Registration requires: parent mobile number (OTP verified), name, relationship to student (Father / Mother / Guardian).
MUST
AC-03
If student age < 13: parent account creation and verification is mandatory before student account is activated. Student cannot bypass this gate.
MUST
AC-04
If student age ≥ 13: parent account linking is optional. Student can invite parent from their profile settings at any time.
MUST
AC-05
Parent can link up to 3 child profiles (family plan). Each child has an independent learning profile and subscription.
MUST
AC-06
Parent account is separate from student account. Parent cannot accidentally access or alter the student's learning sessions.
MUST
AC-07
Parent receives a verification SMS + welcome email on account activation with: what they can see, what their child can do, privacy policy summary.
SHOULD


F-PAR-002
Child Profile Management
MVP

Parent creates and manages academic profiles for each linked child.
AC#
Acceptance Criterion
Priority
AC-01
Parent can create a child profile: name, date of birth, grade, board, medium (language). This creates a linked student account.
MUST
AC-02
Parent can set or update: exam date, weekly study hours target, preferred study schedule (morning / afternoon / evening preference).
MUST
AC-03
Parent can view — but not modify — the AI-generated learning plan. To request topic focus changes, parent submits a preference that the AI considers in the next plan adjustment.
SHOULD
AC-04
Parent can temporarily pause a child's account (e.g., during illness or travel). Sessions do not count against free limits during pause. Streak shield auto-activates.
SHOULD
AC-05
Multiple children shown as tabs on the parent dashboard — quick switching between children without re-login.
MUST


F-PAR-003
Consent & Safety Acknowledgement
MVP

Parent acknowledges child data usage and platform safety policies.
AC#
Acceptance Criterion
Priority
AC-01
During child account creation, parent must explicitly accept: data collection consent for minor, AI interaction consent, community features consent (Phase 2), platform safety policy.
MUST
AC-02
Consent is stored with timestamp + IP for DPDP Act (India) compliance. Non-acceptance blocks account creation.
MUST
AC-03
Parent can withdraw consent at any time from account settings. Withdrawal triggers: data deletion request initiated (30-day processing), account deactivated immediately.
MUST
AC-04
Privacy policy presented in plain language (not legal jargon). Available in Hindi and English at MVP.
SHOULD



3. Progress Monitoring Dashboard
DESIGN PRINCIPLE
The parent dashboard is NOT a copy of the student dashboard. It is simplified, narrative-first, and optimised for a parent who checks in once a week for 3 minutes — not a power user.


F-PAR-010
Parent Dashboard — Overview
MVP

Simplified, child-centric home screen showing the week's key learning signals.
AC#
Acceptance Criterion
Priority
AC-01
Parent dashboard is separate from student dashboard. Parent cannot see the AI tutoring conversation transcript (privacy + trust — student should feel the AI tutor session is their private space).
MUST
AC-02
Dashboard shows for each linked child: Study activity this week (sessions completed, time spent), Current streak, Subject mastery summary (3 subject cards), Upcoming exam countdown + readiness score.
MUST
AC-03
Multiple children shown as horizontal tabs. Active child tab highlighted.
MUST
AC-04
Dashboard uses simple language — no jargon. "Your child mastered 3 new topics this week" not "Knowledge graph updated: 3 concept nodes reached mastery threshold."
MUST
AC-05
All data shown in parent timezone. If parent and student are in different time zones (e.g., NRI parent), study times shown in both zones.
SHOULD
AC-06
Dashboard loads in < 2 seconds. No empty states — always shows something meaningful even in the first week.
MUST

Phase 2 — Timezone & UX enhancements (planned)

- P2-AC-01: Timezone toggle — allow parent to choose display mode per-child: `Parent time`, `Student time`, or `Both` (default: `Both` when zones differ).
- P2-AC-02: Detailed session timestamps — show both local timestamps on the last-10 sessions list and in the session detail view when timezones differ, with hover/copy-to-clipboard ISO timestamp.
- P2-AC-03: Digest scheduling resilience — support DST changes and automatic parent timezone detection with optional manual override in account settings.
- P2-AC-04: Notification preview — include a small timezone label in weekly digest emails and SMS: "Times shown in your timezone (Asia/Kolkata) — view in student timezone" deep link.
- P2-AC-05: Accessibility — ensure timezone labels have `aria-label` descriptions and are localised (Hindi + English) for parents with low digital literacy.
- P2-AC-06: Telemetry & audit — log timezone mismatch events (parent != student) to help evaluate NRI/remote parent usage and prioritise perf/UI follow-ups.



F-PAR-011
Subject Mastery View
MVP

Detailed per-subject mastery breakdown readable by a non-technical parent.
AC#
Acceptance Criterion
Priority
AC-01
Each subject shows: Overall mastery % (large number, colour coded), Chapter-by-chapter mastery bar chart, Top 3 strong chapters, Bottom 3 weak chapters with status ("AI is actively working on this").
MUST
AC-02
Mastery percentages displayed as progress bars — not raw numbers only. Visual makes trend obvious.
MUST
AC-03
"What this means" tooltip on mastery %. Plain-language explanation: "72% mastery means your child has solidly learned 72% of the Class 10 Maths syllabus."
MUST
AC-04
Benchmarking shown anonymously: "Your child's mastery is above 68% of students in their grade on our platform." Opt-in only.
SHOULD
AC-05
Exam readiness score shown per subject: 0–100 score + predicted mark range. E.g., "Predicted board score: 72–81 out of 100."
MUST


F-PAR-012
Study Activity History
MVP

Weekly and monthly study activity visible to parent.
AC#
Acceptance Criterion
Priority
AC-01
Activity calendar: heatmap showing study days in the last 30 days. Green = active day, Empty = missed day. Visual streak pattern.
MUST
AC-02
Weekly summary: sessions completed, total time studied, subjects covered, tests taken, scores.
MUST
AC-03
Parent can see last 10 sessions: date, subject, topic, duration, mastery change for that session (positive / neutral / needs revision). Cannot see transcript.
MUST
AC-04
Inactivity alert trigger visible: parent can see the inactivity threshold they have set (default: 3 days without study triggers alert).
SHOULD
AC-05
"Predicted study time to exam readiness 80%" shown: "At current pace, Riya will reach 80% readiness in Mathematics by [date]."
SHOULD



4. Notifications & Communication
PHASE SPLIT
MVP delivers notifications via Email + SMS only. WhatsApp Business API integration is Phase 2 — but the notification service is built Phase 1 to be channel-agnostic so WhatsApp can be added without refactoring.


F-PAR-020
Weekly Progress Digest
MVP

Automated weekly summary delivered every Sunday morning.
AC#
Acceptance Criterion
Priority
AC-01
Digest sent every Sunday at 9 AM (parent's local timezone) via email. SMS summary sent simultaneously.
MUST
AC-02
Digest contains: Week's study summary (sessions, time, topics), Mastery highlights (what was learned), Exam readiness trend (up / down / stable), One actionable suggestion from AI ("Encourage Arjun to do one more session on Quadratic Equations this week").
MUST
AC-03
Digest is narrative-first — written as a paragraph by AI, not a data table. E.g., "Priya had a strong week! She completed 6 sessions and mastered 4 new topics in Chemistry. Her exam readiness is now 71%, up from 65% last week."
MUST
AC-04
Parent can configure: opt out of weekly digest, change delivery day/time. Cannot opt out of payment and safety notifications.
SHOULD
AC-05
Digest email is mobile-optimised HTML. Single-column. Loads without images on slow connections. Dark mode safe.
MUST


Phase 2 — Digest Enhancements (Planned)

- P2-AC-01: Per-parent frequency & channel preferences — allow parents to choose Weekly / Bi-weekly / Monthly and preferred channels (Email / SMS / WhatsApp). Default: Weekly (MVP).
- P2-AC-02: Multilingual narrative generation — produce digest in the parent's preferred language (Hindi, Tamil, Telugu, English) with schema validation and strict grade-appropriate tone enforcement.
- P2-AC-03: WhatsApp Business API integration — offer WhatsApp-formatted templates + fallback to SMS for feature phones. Maintain single-message brevity and include deep-link to full report in app.
- P2-AC-04: Personalisation & A/B testing — enable controlled experiments on narrative tone and CTA placement; capture opt-in analytics for opens and clicks.
- P2-AC-05: Robust delivery & retry semantics — idempotent delivery, exponential backoff retries, and a dead-letter queue (DLQ) for persistent failures with operator alerts.
- P2-AC-06: Rich deep-links & in-email quick actions — add secure one-click actions (Snooze, Mute, Change schedule) that deep-link to parent settings with prefilled context.
- P2-AC-07: Analytics & observability — log send success, opens, dark-mode rendering verification, and parent actions taken from digest CTAs for later analysis.
- P2-AC-08: Low-bandwidth & accessibility mode — provide a text-only digest variant (SMS-friendly) and validate colour contrast / dark-mode for assistive-readers.

Notes:
- Implementation summary: Mobile-first, dark-mode-safe HTML template and parent opt-out configuration have been implemented (AC-04, AC-05). A mailer-only QA send was executed and validated using Resend. The full worker-driven delivery path is pending a Prisma migration reconciliation before end-to-end DB-backed sends can be exercised.
- Tests / Next steps: Add end-to-end worker integration test once DB migrations are resolved; add visual regression tests for email renderings (light/dark/no-images); instrument analytics for opens and CTA actions.


F-PAR-021
Inactivity Alert
MVP

Alert when child has not studied for configured number of days.
AC#
Acceptance Criterion
Priority
AC-01
Default threshold: 3 consecutive days without a qualifying study session. Parent can change to 2, 3, 5, or 7 days.
MUST
AC-02
Alert message is warm and constructive — not alarming. E.g., "Arjun hasn't had a study session in 3 days. A quick 20-minute session today would keep his streak going!"
MUST
AC-03
Alert includes a direct deep-link to open the app at the student's next planned session (for platforms that support deep links in email/SMS).
SHOULD
AC-03.1
Deep-link behaviour: inactivity alerts include a parameterised deep-link to open the app at the student's next planned session using `?focus=next&itemId=<id>` when available. Mobile and web clients should parse `focus`/`itemId` and navigate to the corresponding session or highlight the next plan item.
SHOULD

AC-03.2
Reset semantics: when the student takes any qualifying activity (session completion or revision threshold), any active inactivity suppression keys are cleared so that the inactivity alert window resets immediately and future alerts may be sent again per policy.
SHOULD
AC-04
Maximum 1 inactivity alert per 3-day period. No spam. If student studies after first alert, alert resets.
MUST
AC-05
Parent can mute inactivity alerts for a specified period (e.g., school exam period, family event). Mute configurable from alert itself.
SHOULD

Phase 2 — Inactivity Enhancements (Planned)

- P2-AC-01: Per-parent frequency & channel preferences — allow parents to choose frequency (Weekly / Bi-weekly / Monthly) and preferred channels (Email / SMS / WhatsApp) for inactivity alerts. Default: Weekly via parent's preferred channel.
- P2-AC-02: In-alert quick actions — add one-click actions in emails/SMS/WhatsApp for `Mute 7/14/30 days` and `Snooze 24h`. Use tokenized HMAC links for mute actions (already implemented) and surface immediate acknowledgement in the UI.
- P2-AC-03: Deep-link UX improvements — show both parent and student timezone labels, include ISO timestamps (copy-to-clipboard), and provide a safe fallback when the next plan item is unavailable (deep-link to parent dashboard).
- P2-AC-04: Two-way WhatsApp integration — support parent acknowledgements and quick-reply commands (e.g., "Snooze", "Mute", "Report") via WhatsApp Business API, with idempotent backend handling and short human-readable confirmations.
- P2-AC-05: Observability & delivery robustness — add idempotent send semantics, DLQ for persistent failures, exponential backoff retries, and telemetry for suppression/set/reset events to tune caps and UX.
- P2-AC-06: Test & QA — add end-to-end worker integration tests covering: tokenized mute links, suppression semantics, deep-link navigation, and multi-channel delivery. Add visual regression tests for email renderings (light/dark/text-only).

Notes:
- Implementation status: deep-link parameterization (`?focus=next&itemId=<id>`), tokenized mute GET link handling, per-child pause (`ParentStudent.isPaused` / `pausedUntil`), and suppression-clear on qualifying activity are implemented and unit-tested. The service worker now delegates to the canonical job (`runInactivityAlerts`) to avoid duplicated logic.
- Next steps (Phase 2): implement per-parent preferences UI, WhatsApp channel templating + quick-replies, DLQ monitoring + operator dashboard, and run full integration tests before promoting to production.


F-PAR-022
Milestone & Achievement Notifications
MVP

Positive reinforcement alerts when child reaches a learning milestone.
AC#
Acceptance Criterion
Priority
AC-01
Notifications sent for: Streak milestones (7, 14, 30 days), Chapter mastery completion (first time), Mock exam completion + score, Level up (gamification tier), Exam readiness score crosses 50%, 70%, 90% thresholds.
MUST
AC-02
Message framing gives parent a specific action: "Arjun just completed a 30-day study streak — that's amazing dedication! This would be a great moment to celebrate with him."
MUST
AC-03
Milestone notifications are positive-only. No "your child only scored 45% on mock exam" framing. Score report available in dashboard.
MUST
AC-04
Maximum 2 milestone notifications per week to avoid notification fatigue.
SHOULD

Phase 2 — Milestone Enhancements (Planned)

- P2-AC-01: Per-parent notification preferences — allow parents to choose which milestone types to receive (streaks, chapter mastery, mock completions, readiness thresholds) and per-channel preference (Email / SMS / WhatsApp). Default: all on.
- P2-AC-02: Milestone aggregation & digest — collapse multiple milestone events into a single daily/weekly milestone digest with highlights and one actionable suggestion to reduce noise.
- P2-AC-03: Per-parent frequency control & quiet hours — allow parents to set max per-day / per-week caps and quiet hours for delivery; settings respected across channels and across siblings.
- P2-AC-04: WhatsApp templates & two-way actions — add WhatsApp Business API templates for milestone notifications with quick-replies (Celebrate, Mute, Details) and deep-links back to the dashboard.
- P2-AC-05: Advanced delivery semantics — idempotent send, DLQ for persistent failures, exponential backoff retries, and per-parent back-pressure handling to avoid gateway throttling.
- P2-AC-06: Observability & analytics — instrument open/click events, milestone conversion (parent action taken), and fatigue metrics (opt-outs, mute rates) to tune caps and A/B test notification strategies.
- P2-AC-07: Support tooling — add an operator `parent_notification_history` view and support UI for ops to replay or investigate notifications (audit trail, last_sent timestamps).
- P2-AC-08: Personalisation guardrails — ensure all milestone narratives remain age-appropriate, non-judgmental, and schema-validated before sending (reuse hallucination & safe response guardrails already in place).

Notes:
- Implementation: Weekly milestone cap (2/week) is enforced in `lib/notifications/policy.ts` and covered by unit tests at `tests/unit/lib/notifications/policy_milestone.test.ts`. Digests are explicitly exempt from the milestone cap to guarantee weekly delivery (F-PAR-020).
- Phase 2 next steps: design the per-parent preferences UI; implement WhatsApp channel templating and quick-replies; add DLQ monitoring + observability dashboards; implement E2E worker integration tests covering multi-channel delivery and fatigue metrics.


F-PAR-023
Payment & Account Notifications
MVP

Transactional notifications for all payment and account events.
AC#
Acceptance Criterion
Priority
AC-01
Payment success: SMS + email within 60 seconds of charge. Includes: amount, plan, next renewal date, invoice link.
MUST
AC-02
Payment failure: SMS + email immediately. Includes: retry link, grace period expiry date, support contact.
MUST
AC-03
Upcoming renewal reminder: 7 days before renewal date. Includes renewal amount and cancel option.
MUST
AC-04
Subscription cancelled confirmation: immediate email. Includes access expiry date and resubscribe link.
MUST
AC-05
All transactional emails include GST invoice as PDF attachment.
MUST
AC-06
Account security: OTP for any login, child account change, or subscription change. Cannot be disabled.
MUST


F-PAR-024
Exam Readiness Score Drop Alert
MVP

Alert when child's exam readiness drops significantly.
AC#
Acceptance Criterion
Priority
AC-01
Alert triggers when: exam readiness score drops > 10 points within 7 days for any subject.
MUST
AC-02
Message is informative, not alarming. E.g., "Riya's Maths readiness has dipped from 74% to 62% this week — likely due to missed revision sessions. The AI has already adjusted her study plan to catch up."
MUST
AC-03
Alert includes the AI's remediation plan summary: "3 targeted sessions on Trigonometry this week will bring her back on track."
SHOULD
AC-04
Alert only triggers if exam is within 90 days. No alert for readiness drops when exam is > 90 days away (less urgent).
SHOULD



4.1 Phase 2 — WhatsApp Integration
PHASE 2
All notifications above will be delivered to parent's WhatsApp via WhatsApp Business API in Phase 2. Additionally: parent can reply "Report" to get instant progress summary as a WhatsApp message. Two-way parent-AI chatbot: parent can ask "Is Arjun ready for his boards?" and get a data-backed answer. Parent-initiated AI tutor focus requests via WhatsApp.



5. Subscription & Payment Management
F-PAR-030
Subscription Purchase (Parent-Initiated)
MVP

Parent purchases a plan for their child's account.
AC#
Acceptance Criterion
Priority
AC-01
Parent can purchase from their dashboard — no need to log in as student. Plan applied to selected child profile.
MUST
AC-02
Plans visible: Monthly, Quarterly (10% off label shown clearly), Annual (25% off + EMI option). INR pricing with GST shown before confirmation.
MUST
AC-03
Family plan option: 3 children under one subscription at 1.8x single-child price. Savings clearly shown.
MUST
AC-04
Payment via: UPI (GPay, PhonePe, Paytm), Debit/Credit card, Net banking, EMI (3/6/12 months on annual plan). UPI shown as default (highest adoption in target market).
MUST
AC-05
Pre-payment screen shows: plan summary, total amount, renewal terms, cancellation policy. No dark patterns. Must scroll to see full terms before confirm button activates.
MUST
AC-06
Payment confirmation within 5 seconds. If payment gateway times out, transaction status checked via webhook before showing success/failure.
MUST

Phase 2 — Subscription Purchase Enhancements (Planned)

- P2-AC-01: Staging end-to-end validation — run a full purchase flow in a staging environment using Razorpay test keys, exercise: order creation, webhook reconciliation, `planId` persisted on `PaymentOrder`, `Subscription` activation for child slots, invoice generation, and receipt delivery. Add automated E2E job to CI that can run against test gateway keys (flagged off by default).
- P2-AC-02: Family-plan UX improvements — allow explicit per-child seat assignment UI, async child invite flow for adding a third child post-purchase, and granular seat transfer audit logs.
- P2-AC-03: Family plan analytics — record `family_plan_applied` event with `childSlots` and `perChildEffectivePrice` for later pricing experiments and A/B testing.
- P2-AC-04: Admin tools — add reconciliation dashboard that surfaces `PaymentOrder.planId` mismatches, gateway refunds, and DLQ entries for failed deliveries.
- P2-AC-05: Billing flexibility — allow mid-cycle child slot increases (upgrade proration) and scheduled decreases (downgrade on renewal) with clear UX and audit trail.



F-PAR-031
Subscription Management
MVP

Parent manages active subscriptions, renewals, and plan changes.
AC#
Acceptance Criterion
Priority
AC-01
Subscription status screen shows per child: current plan, billing cycle, next renewal date + amount, payment method on file, invoice history (downloadable as PDF).
MUST
AC-02
Parent can upgrade plan at any time. Prorated credit applied for remainder of current period. Effective immediately.
MUST
AC-03
Parent can downgrade or cancel subscription. Access continues to end of paid period. No mid-cycle refund (communicated at purchase). Downgrade takes effect on next renewal.
MUST
AC-04
Failed payment handling: 3 auto-retries (day 0, day 1, day 3). After all retries fail: grace period of 3 days with access maintained. Parent notified daily during grace period. After grace: reversion to free tier.
MUST
AC-05
Parent can update payment method at any time. New method validated before old method removed.
MUST
AC-06
Annual plan with EMI: parent can view EMI schedule. Individual EMI failures handled same as subscription payment failure (grace period per instalment).
SHOULD


F-PAR-032
Invoice & Tax Management
MVP

GST-compliant invoice generation for all payments.
AC#
Acceptance Criterion
Priority
AC-01
Invoice generated automatically on every successful payment. Available in parent dashboard under billing history.
MUST
AC-02
Invoice format: GST-compliant (HSN code, GSTIN of platform, tax breakdown, sequential invoice number). Required for corporate reimbursement claims.
MUST
AC-03
Invoice emailed automatically as PDF attachment on each payment.
MUST
AC-04
Parent can download any historical invoice from dashboard — available indefinitely (stored in R2).
MUST
AC-05
Annual invoice summary downloadable: single PDF with all invoices for a financial year. For parent's tax filings.
SHOULD



6. Phase 2 Parent Features (Scoped, Not Built at MVP)
ARCHITECTURE NOTE
The notification service is built channel-agnostic at MVP (Phase 1). The database schema and worker infrastructure accommodate WhatsApp and two-way chat without structural changes at Phase 2 — only the delivery channel integration needs to be added.


Feature
Code
Description
WhatsApp Notification Delivery
F-PAR-P2-001
All notifications re-routed to WhatsApp Business API. Higher open rate vs email/SMS for Indian parents.
WhatsApp Quick Reply Commands
F-PAR-P2-002
Parent can reply "Report", "Pause", "Help" to the WhatsApp notification. AI responds with real-time data.
Parent-AI Chatbot
F-PAR-P2-003
Two-way chat: parent asks "Is Priya ready for her boards?" AI responds with data-backed, plain-language answer.
Study Schedule Override
F-PAR-P2-004
Parent can request the AI focus on a specific subject for the week. AI adjusts plan while maintaining mandatory board exam coverage.
Parent-Initiated Difficulty Adjustment
F-PAR-P2-005
Parent can signal "my child is struggling" or "my child is not being challenged." AI adjusts difficulty band for next 3 sessions, then re-evaluates.
Multi-Child Comparative Report
F-PAR-P2-006
For family plan: side-by-side comparison of engagement and mastery across siblings. Framed supportively — not as competition.
Teacher/Tutor Sharing
F-PAR-P2-007
Parent can share a read-only progress report link with a school teacher or existing human tutor for coordination.



7. Non-Functional Requirements
Requirement
Target
Notes
Dashboard load time
< 2 seconds
Includes all child data from Neon
Notification delivery — SMS
< 60 seconds after event
Via MSG91 priority queue
Notification delivery — Email
< 5 minutes after event
Via transactional email provider
Mobile responsiveness
Android 8+ support, 2 GB RAM
Parent dashboard is mobile-first
Concurrent parent sessions
500 concurrent (Phase 1)
Lower than student due to read-only nature
Invoice availability
Permanent — never deleted
Stored in Cloudflare R2
Privacy — transcript access
Parent cannot access session transcripts
Student-AI conversation is private. Parent sees summary only.
Language support
English + Hindi at MVP
UI shell localisation — not AI tutoring language


