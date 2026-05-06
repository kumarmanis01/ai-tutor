AI HOME TUTOR PLATFORM
Student Actor
Approach Document — Full Lifecycle Feature Specification

Actor	Document Version	Scope	Stack
Student	1.0 — MVP	MVP Phase 1 — ~1K concurrent	Node.js + TS + Prisma + Neon + React

CONFIDENTIAL — FOR INTERNAL REVIEW ONLY


1. Overview
The student is the primary user and core value recipient of the platform. Every design decision is optimised for three outcomes: measurable learning improvement, sustained daily engagement, and board exam performance. The student interacts exclusively through the React PWA on mobile or desktop.

NORTH STAR	Weekly Active Learning Sessions per Paid Student > 5. Every feature is evaluated against this metric before building.

1.1 Student Personas — MVP Scope
Persona	Grade	Board	Primary Pain Point
---

# AI HOME TUTOR PLATFORM — Student Actor

> CONFIDENTIAL — FOR INTERNAL REVIEW ONLY

**Document Version:** 1.0 — MVP  
**Scope:** MVP Phase 1 — ~1K concurrent  
**Stack:** Node.js + TypeScript + Prisma + Neon + React

## 1. Overview

The student is the primary user and core value recipient of the platform. Every design decision is optimised for three outcomes: measurable learning improvement, sustained daily engagement, and board exam performance. The student interacts exclusively through the React PWA on mobile or desktop.

**North Star:** Weekly Active Learning Sessions per Paid Student > 5 — every feature is evaluated against this metric.

### 1.1 Student Personas — MVP Scope

| Persona | Grade | Board | Primary Pain Point |
|---|---:|---|---|
| Board Exam Aspirant | 9–10 | CBSE / ICSE | No affordable tutor. Needs exam-focused practice and gap analysis. |
| Competitive Exam Preparer | 11–12 | CBSE | Concept depth + speed. Current tutors teach to rote, not understanding. |
| Self-Study Student | 6–8 | State Board | No study structure. Skips chapters. Falls behind silently. |

### 1.2 Student Journey Stages

| Stage | Features | Phase |
|---|---|---|
| Onboarding | Registration, Diagnostic, Learning Path, Language Preference | MVP |
| Core Learning | Session Flow, AI Teach Mode, Whiteboard, Doubt Resolution | MVP |
| Assessment | Chapter Tests, Mock Exams, Spaced Repetition, Readiness Score | MVP |
| Engagement | Streaks, XP, Progress Reports, Dashboard | MVP |
| Advanced Engagement | Leaderboard, Study Pods, Brain Games | Phase 2 |
| Accessibility | Voice Mode, Camera Input (OCR), Offline Mode | Phase 2 |

## 2. Onboarding & Personalisation

### F-STU-001 — Registration & Account Setup (MVP)

Student creates an account with academic profile. Parent linkage enforced for students under 13.

- **AC-01 (MUST):** Student registers via mobile OTP, Google OAuth, or email + password.
- **AC-02 (MUST):** Collect Name, Age, Grade (1–12), Board (CBSE/ICSE/State), Medium of instruction.
- **AC-03 (MUST):** If age < 13: parent mobile mandatory; parent OTP verification required before activation.
- **AC-04 (MUST):** Profile marked INCOMPLETE until Board + Grade + Medium + ≥1 subject selected; incomplete profile blocks learning features.
- **AC-05 (MUST):** Student can select up to 6 subjects; core subjects pre-selected by Grade+Board.
- **AC-06 (MUST):** Grade is immutable post-registration without admin approval.
- **AC-07 (SHOULD):** Other profile fields editable from Profile screen.
- **AC-08 (SHOULD):** On success: send welcome email and show onboarding checklist (Complete profile → Take diagnostic → Start first session).

### F-STU-002 — Diagnostic Assessment (MVP)

Per-subject adaptive baseline test used to bootstrap the student's knowledge graph. Mandatory before first session.

- **AC-01 (MUST):** Diagnostic mandatory per subject; cannot be skipped.
- **AC-02 (MUST):** Adaptive 15–25 questions per subject; difficulty adjusts via IRT 3PL.
- **AC-03 (MUST):** Questions span full grade syllabus to detect gaps and advanced mastery.
- **AC-04 (MUST):** 30-minute soft cap; students may pause/resume within 24 hours; auto-submit after 24 hours.
- **AC-05 (MUST):** Outputs: Mastery % per chapter, Grade placement, Recommended starting chapter.
- **AC-06 (MUST):** Results shown as visual Knowledge Map (Red <40%, Amber 40–70%, Green >70%).
- **AC-07 (SHOULD):** Abandoned diagnostics with <10 Qs: partial data used; assume grade-level start for unanswered chapters.
- **AC-08 (SHOULD):** Retake available after 30 days; different question set; rapid-fire answer detection.
- **AC-09 (MUST):** Diagnostic results create StudentConceptState records for all concepts.

### F-STU-003 — Learning Path Generation (MVP)

AI generates a personalised, time-bound study plan from diagnostic results and student goals.

- **AC-01 (MUST):** Student sets exam date (or "No exam — steady learning").
- **AC-02 (MUST):** Student provides weekly study availability; minimum 3 hrs/week required.
- **AC-03 (MUST):** Plan: weak chapters prioritized, sequential curriculum, mandatory board topics locked, revision buffer (last 2 weeks).
- **AC-04 (MUST):** Display: calendar view + chapter sequence with estimated session counts.
- **AC-05 (MUST):** Plan auto-adjusts weekly based on progress.
- **AC-06 (SHOULD):** Student may reorder topics within a week (cannot remove mandatory topics).
- **AC-07 (MUST):** Plan regenerated if board, grade, exam date, or subject selection changes.
- **AC-08 (MUST):** "Today's Plan" widget reflects current recommendation.

### F-STU-004 — Language & Learning Style Preference (MVP)

- **AC-01 (MUST):** Teaching language selectable per subject (e.g., Math in Hindi).
- **AC-02 (MUST):** Show available languages per subject; unavailable ones greyed with "Coming soon".
- **AC-03 (MUST):** MVP supported languages: English and Hindi.
- **AC-04 (MUST):** Language changes take effect next session.
- **AC-05 (SHOULD):** UI shell language is separate from teaching language.
- **AC-06 (SHOULD):** Learning style: Visual / Reading / Kinesthetic; AI uses this to pick explanation modality.
- **AC-07 (MUST):** Code-switched input (Hinglish, Tanglish) accepted and not penalised.

## 3. Core Learning — Session Flow

### F-STU-010 — Session Initiation (MVP)

- **AC-01 (MUST):** Home CTA: "Continue where you left off" (single tap resume/start).
- **AC-02 (MUST):** Secondary options: Today's planned topic, Browse syllabus, "Surprise me".
- **AC-03 (MUST):** Pre-session screen shows topic, estimated duration, prerequisite check.
- **AC-04 (MUST):** Session loads < 3s on 4G; first AI message < 5s.
- **AC-05 (MUST):** If interrupted: options to Resume / Restart / Skip (marks deferred).
- **AC-06 (MUST):** Auto-save every 60s; no progress loss on network drop or app close.

### F-STU-011 — AI Teach Mode — Pedagogical Flow (MVP)

Seven-stage structured explanation with adaptive branching.

- **AC-01 (MUST):** Sequence: Hook → Prerequisite Bridge → Core Explanation → Worked Example → Guided Practice → Independent Practice → Consolidation.
- **AC-02 (MUST):** AI cannot advance until stage exit criteria met; failing twice triggers remediation.
- **AC-03 (MUST):** Student may interrupt to ask a doubt; AI pauses and resolves it.
- **AC-04 (MUST):** Student may request re-explanation in different styles.
- **AC-05 (MUST):** AI never gives direct answers to practice problems; use 3-tier hint system.
- **AC-06 (MUST):** Use culturally relevant analogies (India-aware).
- **AC-07 (SHOULD):** Cite board exam objective where appropriate.
- **AC-08 (MUST):** 3 consecutive wrong answers trigger prerequisite remediation.
- **AC-09 (SHOULD):** Detect suspiciously perfect/copy-paste answers and probe further.
- **AC-10 (SHOULD):** Tone calibrated by grade band.

### F-STU-012 — 3-Tier Hint System (MVP)

- **Tier 1 (MUST):** Directional nudge (point to relevant concept/formula).
- **Tier 2 (MUST):** Structural hint (reveal approach without executing it).
- **Tier 3 (MUST):** Worked scaffold (first step only).
- **AC-04 (MUST):** Hints not volunteered before 90s inactivity; after 90s ask if student wants a hint.
- **AC-05 (MUST):** Student must explicitly request each hint; show hint counter.
- **AC-06 (MUST):** After 3 hints exhausted and still wrong: provide full solution and an isomorphic problem.
- **AC-07 (SHOULD):** Track hint usage per concept; high dependency flags for consolidation.

### F-STU-013 — Misconception Detection & Correction (MVP)

- **AC-01 (MUST):** Maintain subject-level misconception library mapped to diagnostic signatures.
- **AC-02 (MUST):** When matched, AI names and corrects the misconception.
- **AC-03 (MUST):** Use contrastive explanations with counterexamples.
- **AC-04 (MUST):** Log detected misconceptions to student profile and session prompts.
- **AC-05 (SHOULD):** Log novel misconceptions to analytics for content team review.
- **AC-06 (MUST):** Seed library: minimum 20 misconceptions per subject.

### F-STU-014 — Virtual Whiteboard Mode (MVP)

- **AC-01 (MUST):** Auto-activate for geometry, algebra step-by-step, chemistry, physics diagrams.
- **AC-02 (MUST):** AI draws incrementally timed to narration.
- **AC-03 (MUST):** Student has a separate canvas layer.
- **AC-04 (MUST):** "Submit my working" button for AI evaluation.
- **AC-05 (MUST):** Student must explicitly submit for re-evaluation.
- **AC-06 (SHOULD):** Save whiteboard state as a session artifact.

### F-STU-015 — Session Completion & Summary (MVP)

- **AC-01 (MUST):** Summary shows concepts covered, questions attempted vs correct %, time spent, mastery change, next session.
- **AC-02 (MUST):** Show XP earned with animation; milestone celebrations displayed.
- **AC-03 (MUST):** AI generates one personalised closing insight per session.
- **AC-04 (SHOULD):** Student may rate the session 1–5 stars (optional).
- **AC-05 (SHOULD):** Suggest schedule for next session based on historical active hours.
- **AC-06 (SHOULD):** Share summary to parent via WhatsApp (Phase 2) or copy-to-clipboard (MVP).

## 4. Assessment Engine

### F-STU-020 — Chapter Practice Test (MVP)

- **AC-01 (MUST):** AI auto-generates unique tests; ensure semantic diversity (no semantically equivalent attempts within 90 days).
- **AC-02 (MUST):** Question mix: 40% MCQ, 30% short answer, 30% long answer/problem solving.
- **AC-03 (MUST):** Time limit based on board exam time-per-mark; auto-submit on expiry.
- **AC-04 (MUST):** Correct answers hidden during test; review only after submission.
- **AC-05 (MUST):** Post-submission: wrong answers show step-by-step solution and specific error analysis.
- **AC-06 (MUST):** Score < 40% flags chapter for revision; insert targeted revision within 24 hours.
- **AC-07 (MUST):** Track score history and show improvement trends.
- **AC-08 (SHOULD):** Students may flag ambiguous questions; quarantine after 3 flags.

### F-STU-021 — Full Syllabus Mock Exam (MVP)

- **AC-01 (MUST):** Replicate board exam format exactly in UI.
- **AC-02 (MUST):** Enforce real exam duration; no pause except accessibility mode.
- **AC-03 (MUST):** Allow intra-section navigation; restrict inter-section navigation post-submission.
- **AC-04 (MUST):** Provide post-exam report with time-per-question heatmap and percentile vs cohort.
- **AC-05 (MUST):** Generate a "Next 2 Weeks Priority Plan" post-mock.
- **AC-06 (MUST):** Minimum 5 unique full mocks per subject/grade at launch.
- **AC-07 (SHOULD):** Provide offline PDF (questions only) for practice.

### F-STU-022 — Spaced Repetition & Revision Scheduling (MVP)

- **AC-01 (MUST):** Apply SM-18 algorithm for revision scheduling of mastered concepts.
- **AC-02 (MUST):** Revision cards appear in daily plan; snooze allowed (1 day only).
- **AC-03 (MUST):** Revision session: 5 targeted questions (~5 minutes).
- **AC-04 (MUST):** Revision score >80% increases interval; <80% resets interval + remediation.
- **AC-05 (SHOULD):** Show memory strength per concept in knowledge map.
- **AC-06 (MUST):** Cap daily revision at 20 minutes; prioritise lowest retention.
- **AC-07 (SHOULD):** Pre-exam mode activates 14 days before exam; raise retention threshold to 92%.

### F-STU-023 — Exam Readiness Score (MVP)

- **AC-01 (MUST):** Compute 0–100 readiness from chapter mastery, mock performance, spaced repetition retention, and recency of study.
- **AC-02 (MUST):** Update score after each session and test submission.
- **AC-03 (MUST):** Show chapter-level breakdown to identify dragging chapters.
- **AC-04 (MUST):** Provide AI-predicted score range with confidence interval.
- **AC-05 (SHOULD):** Trigger notifications if score drops >10 points in a week.

## 5. Engagement & Retention

### F-STU-030 — Daily Learning Streak (MVP)

- **AC-01 (MUST):** A day counts as active only when student completes ≥1 full tutoring session (all 7 stages) OR ≥10 revision cards.
- **AC-02 (MUST):** Display streak counter and milestone badges (7, 14, 30, 60, 100 days).
- **AC-03 (MUST):** Each student gets 1 streak shield per calendar month (auto-activate on first missed day).
- **AC-04 (MUST):** Streak break message is motivational and forward-looking.
- **AC-05 (SHOULD):** Permanently show longest streak on profile.
- **AC-06 (SHOULD):** Milestones unlock cosmetic rewards only.

### F-STU-031 — XP, Levels & Badges (MVP)

- **AC-01 (MUST):** Award XP for session completion, correct answers, streaks, first-attempt correct, and revision completion.
- **AC-02 (MUST):** XP never deducted; wrong answers earn 0 XP.
- **AC-03 (MUST):** Levels 1–100 with thresholds and visual changes at key tiers.
- **AC-04 (MUST):** Badges for mastery, streaks, mocks, speed, consistency, comeback.
- **AC-05 (SHOULD):** Allow students to curate 5 badges on profile.
- **AC-06 (MUST):** Level-up is a full-screen celebration.

### F-STU-032 — Student Dashboard (MVP)

- **AC-01 (MUST):** Dashboard is the primary post-login screen and personalised.
- **AC-02 (MUST):** Show Today's plan, current streak + weekly XP, readiness per subject, recent sessions, and active revision cards.
- **AC-03 (MUST):** Primary CTA: "Continue Learning".
- **AC-04 (SHOULD):** Exam crunch mode UI for ≤14 days to exam.
- **AC-05 (MUST):** Dashboard loads < 2s with personalised data.
- **AC-06 (SHOULD):** Support dark mode and adjustable font sizes.

### F-STU-033 — Progress Reports (MVP)

- **AC-01 (MUST):** Reports show sessions trend, mastery %, test scores, weekly study heatmap, concepts mastered.
- **AC-02 (MUST):** Filter by subject and time range.
- **AC-03 (MUST):** Top-of-report AI insight: data-driven and specific.
- **AC-04 (SHOULD):** Downloadable PDF for sharing with parents/teachers.
- **AC-05 (MUST):** Reports accessible on free tier.

## 6. Subscription & Payments

### F-STU-040 — Freemium Access Control (MVP)

- **AC-01 (MUST):** Free tier: 3 AI sessions per subject/month (≤20 mins each), 1 chapter test per subject/month; diagnostic and learning plan always free.
- **AC-02 (MUST):** Show session cap counter.
- **AC-03 (MUST):** On cap: show upgrade prompt at session end (non-interrupting).
- **AC-04 (MUST):** Free users receive full AI quality; only quantity limited.
- **AC-05 (SHOULD):** Free tier resets on 1st of month; notify 3 days before.

### F-STU-041 — Subscription Purchase Flow (MVP)

- **AC-01 (MUST):** Plans: Monthly, Quarterly (10% off), Annual (25% off); display INR with GST.
- **AC-02 (MUST):** Support UPI, cards, netbanking, and EMI on annual plan.
- **AC-03 (MUST):** Show payment confirmation screen before charge with clear terms.
- **AC-04 (MUST):** On success: unlock access, send SMS + email receipt, show personalised AI welcome.
- **AC-05 (MUST):** Failed payments: 3 auto-retries over 3 days, then grace notifications and free tier revert.
- **AC-06 (MUST):** Cancel anytime; access continues through paid period.
- **AC-07 (SHOULD):** Family plan covers up to 3 child profiles at 1.8x single price.

### F-STU-042 — Referral Programme (MVP)

- **AC-01 (MUST):** Unique referral code per student; shareable via WhatsApp or copy-to-clipboard.
- **AC-02 (MUST):** Referrer reward: 1 month free after referred friend's first cleared payment.
- **AC-03 (MUST):** Referred friend reward: 20% off first month.
- **AC-04 (SHOULD):** Referral dashboard for tracking.
- **AC-05 (MUST):** Fraud detection: flag same device/IP referrals.

## 7. Phase 2 Features (Scoped, Not Built at MVP)

> The features below are designed but excluded from MVP to avoid blocking architecture changes.

| Feature | Code | Why Deferred |
|---|---|---|
| Voice Interaction (ASR + TTS) | F-STU-P2-001 | Requires Whisper ASR + ElevenLabs TTS; high infra cost and language validation needed. |
| Camera Input / OCR | F-STU-P2-002 | Requires GPT-4o vision pipeline + math parsing; complex handling for low-quality images. |
| Offline Mode | F-STU-P2-003 | Requires PWA service worker, content pre-download, and sync-on-reconnect. |
| Leaderboard | F-STU-P2-004 | Privacy review required for minors; needs critical mass. |
| Study Pods (Peer Learning) | F-STU-P2-005 | Requires real-time chat and robust moderation. |
| Brain Break Mini-Games | F-STU-P2-006 | Requires game design and curriculum alignment. |
| WhatsApp Session Sharing | F-STU-P2-007 | Requires WhatsApp Business API and parent dependencies. |
| Accessibility Mode | F-STU-P2-008 | ARIA compliance, dyslexia font, and extended time; important but not blocking MVP. |

## 8. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Session load time | < 3 seconds on 4G | First AI response within 5 seconds of session start |
| AI response latency | < 8 seconds (text doubt) | SSE streaming: first token within 2 seconds |
| Dashboard load | < 2 seconds | Includes personalised data from Neon |
| Mobile-first | Works on Android 8+, 2 GB RAM device | PWA (not native) |
| Availability | 99.5% uptime target | Excludes Neon maintenance windows |
| Data retention | Session turns: 90 days hot; archive to R2 thereafter | India DPDP Act compliance |
| Session auto-save | Every 60 seconds | Redis session state; resilient to network loss |
| Concurrent sessions | 1,000 target at MVP | PM2 cluster x2, Redis-backed session state |

---

Last updated: 2026-05-06
