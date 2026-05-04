
<!--
FILE OBJECTIVE:
- Student actor approach document — requirements and acceptance criteria for student-facing features (MVP).

LINKED UNIT TEST:
- tests/unit/docs/01_student.spec.ts

COPILOT_INSTRUCTIONS_FOLLOWED:
- .github/copilot-instructions.md
- docs/COPILOT_GUARDRAILS.md

EDIT LOG:
- 2026-04-16T12:00:00Z | copilot | added Production Run & Deployment section; updated header
- 2026-04-16T12:50:00Z | copilot | add Phase 2 backlog: admin-triggered mock seeding (API + worker), audit logs, admin UI, tests
 - 2026-04-17T10:30:00Z | copilot | add Phase 2 referral backlog: referral dashboard UI, in-app notifications for voided rewards, fraud review tooling, E2E billing tests
-->

AI HOME TUTOR PLATFORM
Student Actor
Approach Document — Full Lifecycle Feature Specification


Actor
Document Version
Scope
Stack
Student
1.0 — MVP
MVP Phase 1 — ~1K concurrent
Node.js + TS + Prisma + Neon + React


CONFIDENTIAL — FOR INTERNAL REVIEW ONLY

1. Overview
The student is the primary user and core value recipient of the platform. Every design decision is optimised for three outcomes: measurable learning improvement, sustained daily engagement, and board exam performance. The student interacts exclusively through the React PWA on mobile or desktop.

NORTH STAR
Weekly Active Learning Sessions per Paid Student > 5. Every feature is evaluated against this metric before building.


1.1 Student Personas — MVP Scope
Persona
Grade
Board
Primary Pain Point
Board Exam Aspirant
9–10
CBSE / ICSE
No affordable tutor. Needs exam-focused practice and gap analysis.
Competitive Exam Preparer
11–12
CBSE
Concept depth + speed. Current tutors teach to rote, not understanding.
Self-Study Student
6–8
State Board
No study structure. Skips chapters. Falls behind silently.


1.2 Student Journey Stages
Stage
Features
Phase
Onboarding
Registration, Diagnostic, Learning Path, Language Preference
MVP
Core Learning
Session Flow, AI Teach Mode, Whiteboard, Doubt Resolution
MVP
Assessment
Chapter Tests, Mock Exams, Spaced Repetition, Readiness Score
MVP
Engagement
Streaks, XP, Progress Reports, Dashboard
MVP
Advanced Engagement
Leaderboard, Study Pods, Brain Games
Phase 2
Accessibility
Voice Mode, Camera Input (OCR), Offline Mode
Phase 2


## Phase 2 — Referral & Rewards (Deferred)

The backend billing and redemption logic for referrals is implemented in Phase 1 (see implementation summary in repo). The following items are intentionally deferred to Phase 2 (feature-flagged) to prioritise core learning flows and minimise launch scope:

- **Referral Dashboard (Student):** UI that shows total referrals sent, converted (paid), rewards earned, and pending rewards with pagination and filters.
- **Referral Management (Creator):** In-app screens for copying/sharing referral code, viewing referral history, and contest/limits UI.
- **In-App Notifications for Voided Rewards:** Rich client notifications and UI flows that surface voided/refunded referral events to both referrer and redeemer. (Currently implemented as best-effort push/email sends server-side.)
- **Fraud Review Tooling:** Admin console for reviewing flagged referrals (same IP/device fingerprints), marking false positives, and manual reward adjustments.
- **Comprehensive E2E Tests:** Full integration tests covering order creation with referral discount, webhook reconciliation, auto-redemption, and credit application to billing flows.
- **Analytics & Reporting:** Aggregated metrics for referral conversion rates, abuse signals, and cohort analyses.

These items will be gated behind a feature flag and scheduled in Phase 2 once the core referral billing loop is validated in production.


2. Onboarding & Personalisation
F-STU-001
Registration & Account Setup
MVP

Student creates an account with academic profile. Parent linkage enforced for students under 13.
AC#
Acceptance Criterion
Priority
Status
AC-01
Student registers via: mobile OTP, Google OAuth, or email + password
MUST
✅ DONE — email+password via POST /api/auth/signup; Google OAuth via NextAuth; mobile OTP via MSG91 /api/auth/parent/send-otp + /api/auth/parent/verify-otp
AC-02
System collects: Name, Age, Grade (1–12), Board (CBSE/ICSE/State), Medium of instruction (language)
MUST
✅ DONE — POST /api/user/onboarding collects all fields; checkProfileCompleteness validates name, grade (1-12), board, subjects, language, age
AC-03
If age < 13: parent mobile is mandatory. Parent OTP must be verified before account is activated. Student cannot bypass this.
MUST
✅ DONE — DPDP_MINOR_AGE=13 constant enforced in profileGuard.checkProfileCompleteness; parent phone required for age<13; /api/auth/parent/send-otp + verify-otp gate account activation
AC-04
Profile is marked INCOMPLETE until: Board + Grade + Medium + at least one subject are selected. INCOMPLETE profile blocks access to all learning features.
MUST
✅ DONE — isProfileComplete() in lib/student/profileGuard.ts; tutor/session/start checks profile; diagnostic guard checks profile
AC-05
Student can select up to 6 subjects. Core subjects pre-selected based on Grade + Board combination. Student can deselect non-core subjects.
MUST
✅ DONE — subject cap enforced in POST /api/user/onboarding (line: if subjects.length > 6 → 400); subject list validated against SubjectDef for student grade+board; core pre-selection is UI-side based on SubjectDef.slug returned by /api/hierarchy
AC-06
Grade is immutable post-registration without admin approval. Prevents diagnostic abuse and leaderboard gaming.
MUST
✅ DONE — PATCH /api/user/profile strips grade/board unconditionally; comment "grade/board immutable after first save" present
AC-07
All other profile fields are editable post-registration from the Profile screen.
SHOULD
✅ DONE — PATCH /api/user/profile accepts learningStyle, preferences, examDate; PATCH /api/user/language accepts UI language
AC-08
On successful registration: welcome email sent, onboarding checklist shown with 3 steps: Complete profile → Take diagnostic → Start first session.
SHOULD
✅ DONE — welcome email fired via sendMailSafe in /api/auth/signup and maybeSendWelcomeEmail in auth.ts; onboarding page at /student/onboarding renders the 3-step checklist


F-STU-002
Diagnostic Assessment
MVP

Per-subject adaptive baseline test. Establishes knowledge graph starting state. Mandatory before first session.
AC#
Acceptance Criterion
Priority
Status
AC-01
Diagnostic is mandatory for each subject before the first tutoring session begins. Cannot be skipped.
MUST
✅ DONE — hasDiagnosticForSubject() gate in lib/student/diagnosticGuard.ts; enforced in /api/tutor/session/start (returns 403 DIAGNOSTIC_REQUIRED)
AC-02
Test is adaptive: 15–25 questions per subject. Each next question's difficulty is determined by the previous answer using IRT (Item Response Theory 3PL model).
MUST
✅ DONE — lib/diagnostics/diagnosticQuestionService.ts + lib/diagnostics/selector.ts (IRT 3PL adaptive selection); lib/irt/irt.ts (theta computation)
AC-03
Questions span the full grade syllabus to detect both gaps and advanced mastery — not just weak areas.
MUST
✅ DONE — question pool drawn from all active TopicDef rows for the subject via SubjectDef → ChapterDef → TopicDef → Question hierarchy
AC-04
Time limit: 30 minutes soft cap. Student can pause and resume within 24 hours. After 24 hours the partial diagnostic is auto-submitted.
MUST
✅ DONE — /api/student/diagnostic/save-partial (pause to Redis); /api/student/diagnostic/resume (restore state); jobs/diagnosticAutoSubmit.ts (24h BullMQ job scheduled at start)
AC-05
On completion, system outputs: Mastery % per chapter, Grade-level placement (below / at / above grade), Recommended starting chapter.
MUST
✅ DONE — /api/student/diagnostic/submit returns placement via thetaToPlacement(); diagnosticBootstrapWorker seeds StudentConceptState.masteryScore; GET /api/student/diagnostic/results/[subjectId] aggregates per-chapter mastery with recommended start
AC-06
Result is displayed as a visual Knowledge Map — not a numerical score. Avoids discouragement. Colour coded: Red (< 40%), Amber (40–70%), Green (> 70%).
MUST
✅ DONE — GET /api/student/diagnostic/results/[subjectId] returns chapters[] with masteryPct, band (RED/AMBER/GREEN), isRecommendedStart, and overall placement
AC-07
If student abandons diagnostic with < 10 questions answered: partial data used + system assumes grade-level start for unanswered chapters.
SHOULD
✅ DONE — diagnosticAutoSubmit fires after 24h on any partial state; unanswered chapters default to masteryScore=0 (grade-level start) in bootstrap worker
AC-08
Retake available after 30 days. Retake uses a different question set. Score gaming detection: rapid-fire answers flagged.
SHOULD
✅ DONE — 30-day cooldown enforced in /api/student/diagnostic/start (429 RETAKE_COOLDOWN); retake excludes previous questionIds; rapid-fire flag stored in DiagnosticStatus.gamingFlagged
AC-09
Diagnostic results are immediately used to bootstrap the student's knowledge graph (StudentConceptState records created for all concepts).
MUST
✅ DONE — /api/student/diagnostic/submit enqueues diagnosticBootstrapJob; worker/services/diagnosticBootstrapWorker.ts creates StudentConceptState rows for all subject concepts


F-STU-003
Learning Path Generation
MVP

AI generates a personalised, time-bound study plan from diagnostic results + student goals.
AC#
Acceptance Criterion
Priority
Status
AC-01
Student sets exam date (or selects "No exam — steady learning"). Exam date drives urgency of the plan.
MUST
✅ DONE — examDate accepted (ISO string or null) in POST /api/user/onboarding and PATCH /api/user/profile; null = no exam (steady learning)
AC-02
Student sets weekly study availability (hours/week). Minimum 3 hrs/week required to generate a valid plan. Below minimum: system warns and suggests minimum.
MUST
✅ DONE — studyDaysPerWeek accepted in POST /api/student/onboarding/generate-plan; belowMinimumHours flag returned when weeklyMinutes < 180 (3 hrs); client displays warning
AC-03
Plan structure: Weak chapters first (priority order), Sequential curriculum chapters, Mandatory board exam topics locked (cannot be removed), Revision buffer — last 2 weeks always reserved.
MUST
✅ DONE — lib/ai/learningPlan.ts generateLearningPlan(): concepts sorted ascending by masteryScore (weak-first) then curriculum order; BoardChapterWeight marks mandatory topics; isMandatory flag set on timeline items
AC-04
Plan displayed as a visual timeline: calendar view + chapter sequence with estimated session count per chapter.
MUST
✅ DONE — GET /api/student/learning-plan/timeline returns week-by-week payload via lib/student/learningPlanTimeline.ts buildTimeline(); includes weekNumber, orderInWeek, estimated session count
AC-05
Plan auto-adjusts weekly based on actual progress: if behind → re-prioritises remaining chapters. If ahead → introduces advanced / extension content.
MUST
✅ DONE — GET /api/student/learning-plan/today triggers background plan regeneration when plan is >7 days old (uses current masteryScore for fresh prioritisation); POST /api/student/learning-plan/adjust provides an explicit trigger callable by the client
AC-06
Student can manually reorder topics within a given week. Cannot remove mandatory board exam topics.
SHOULD
✅ DONE — PATCH /api/student/learning-plan/[itemId] supports action=reorder and action=move via lib/learningPlan/safeSwapOrder.ts
AC-07
Plan is fully regenerated if student changes: board, grade, exam date, or subject selection.
MUST
✅ DONE — PATCH /api/user/profile triggers generateLearningPlan for all plans when examDate changes; POST /api/user/onboarding triggers generation when subjects change
AC-08
"Today's Plan" widget on dashboard always reflects the current plan's recommendation for today.
MUST
✅ DONE — GET /api/student/learning-plan/today returns first UPCOMING LearningPlanItem for current week; falls back to getNextAction engine when no plan exists


F-STU-004
Language & Learning Style Preference
MVP

Student configures teaching language per subject and sets learning style preference.
AC#
Acceptance Criterion
Priority
Status
AC-01
Student can select teaching language independently per subject. E.g., Math in Hindi, English in English.
MUST
✅ DONE — PATCH /api/student/subject-language with {subjectId, language} persists per-subject preference in StudentLearningProfile.recommendations.subjectLanguages
AC-02
Available languages per subject shown based on content availability. Unavailable languages greyed out with "Coming soon" label.
MUST
✅ DONE — GET /api/student/subject-language returns availableLanguages=['en','hi']; client greys out anything not in that list
AC-03
MVP supported languages: English + Hindi. Additional languages (Tamil, Telugu, Bengali, Marathi) added in Phase 2.
MUST
✅ DONE — VALID_LANGUAGES=['en','hi'] in /api/student/subject-language/route.ts; PATCH rejects any other value
AC-04
Student can switch teaching language at any time. Change takes effect from the next session.
MUST
✅ DONE — PATCH /api/student/subject-language immediately upserts StudentLearningProfile; AI tutor reads preference at session start via tutorSession Redis state
AC-05
UI shell language is set separately from teaching language.
SHOULD
✅ DONE — GET/POST /api/user/language manages User.language (shell); PATCH /api/student/subject-language manages teaching language per-subject — fully independent
AC-06
Learning style preference: Visual / Reading / Kinesthetic. AI uses this to select default explanation modality. Student can override per session.
SHOULD
✅ DONE — PATCH /api/user/profile accepts learningStyle; VALID_LEARNING_STYLES now includes visual, reading, kinesthetic (plus verbal/practice/mixed for backwards compat); value stored in User.learningStyle and injected into AI system prompt
AC-07
Code-switched input (Hinglish, Tanglish) is accepted by the AI — not penalised or corrected.
MUST
✅ DONE — lib/ai/prompts/schemas.ts Language type includes 'Hinglish'; tutor system prompt (lib/whatsapp.ts + generateParentReport.ts) explicitly handles Hinglish mode; AI is instructed to accept mixed-language input without correction



3. Core Learning — Session Flow
F-STU-010
Session Initiation
MVP

Student starts a learning session — by plan, by chapter, or via AI recommendation.
AC#
Acceptance Criterion
Priority
Status
AC-01
Home screen primary CTA is always "Continue where you left off" — single tap to resume last session or start today's planned topic.
MUST
✅ DONE — GET /api/dashboard/continue-learning returns most recently accessed incomplete LearningSession; fallback to learning-plan/today
AC-02
Secondary start options: Today's planned topic, Browse syllabus and pick any chapter, "Surprise me" (AI picks highest-priority weak concept).
MUST
✅ DONE — GET /api/student/learning-plan/today (today's topic); GET /api/student/surprise-me (weak-concept AI pick with TopicRanker fallback); browse-syllabus is client-side navigation via /api/hierarchy subject tree
AC-03
Pre-session screen shows: Topic name, Estimated duration, Prerequisite check (if prerequisite not mastered → warning + option to study prerequisite first or proceed anyway).
MUST
✅ DONE — POST /api/tutor/session/start returns {prereqs: [{conceptId, name, mastered}], resumeContext, freeTierUsage}; client renders pre-session screen with unmet prerequisite warning
AC-04
Session loads within 3 seconds on a 4G connection. First AI message appears within 5 seconds of session start.
MUST
✅ DONE — /api/tutor/session/start logs a warning when response exceeds 3000ms (elapsed > 3000); first AI token delivered via SSE streaming in /api/tutor/turn (Connection: keep-alive, first token target <2s)
AC-05
If a session was interrupted mid-way, student is offered three options: Resume from where I left off, Restart topic from beginning, Skip topic (marks as deferred in plan).
MUST
✅ DONE — GET /api/session/[sessionId] returns current phase via getSessionView (resume); new POST /api/session/start with same topicId restarts; PATCH /api/student/learning-plan/[itemId] with status=DEFERRED skips and defers in plan
AC-06
Session auto-saves state every 60 seconds. No progress is lost on network drop or app close.
MUST
✅ DONE — PATCH /api/session/[sessionId] with {action:"heartbeat"} updates meta.lastHeartbeatAt; session phase state is DB-persisted on every phase transition via sessionEngine; client calls heartbeat every 60s


F-STU-011
AI Teach Mode — Pedagogical Flow
MVP

Seven-stage structured explanation with adaptive branching. The AI's core teaching loop.
AC#
Acceptance Criterion
Priority
AC-01
Every concept session follows this sequence: Hook → Prerequisite Bridge → Core Explanation → Worked Example → Guided Practice → Independent Practice → Consolidation.
MUST
AC-02
AI may not advance a stage until the stage's exit criterion is met. Failing the exit criterion twice triggers Prerequisite Remediation before retry.
MUST
AC-03
Student can interrupt AI explanation at any point to ask a doubt. AI pauses, resolves the doubt, then offers to resume or re-explain from the start.
MUST
AC-04
Student can request re-explanation in a different style at any time: "Show me a diagram", "Give me a real-life example", "Explain simpler", "Explain harder".
MUST
AC-05
AI never gives direct answers to practice problems. Uses the 3-tier hint system exclusively.
MUST
AC-06
AI uses culturally relevant analogies: cricket averages for statistics, train journeys for speed-distance, market prices for percentages. Analogy pool is region-aware (India).
MUST
AC-07
Every explanation cites the board exam objective it addresses: "This concept appears in CBSE Class 10 Board Exam — 6 marks weightage."
SHOULD
AC-08
If student gives 3 consecutive wrong answers: AI detects struggle, inserts prerequisite remediation sub-flow before retrying the original concept.
MUST
AC-09
AI detects copy-pasted or suspiciously perfect answers and follows up with a probing question: "Great — can you explain why that works?"
SHOULD
AC-10
Dialogue tone calibrated by grade: Grade 6–8 → encouraging elder sibling. Grade 9–10 → peer collaborator. Grade 11–12 → focused mentor.
SHOULD


F-STU-012
3-Tier Hint System
MVP

AI guides students toward the answer through scaffolded hints rather than giving solutions directly.
AC#
Acceptance Criterion
Priority
AC-01
Tier 1 — Directional Nudge: points student toward relevant concept or formula without revealing approach. E.g., "Think about what formula connects distance, speed, and time."
MUST
AC-02
Tier 2 — Structural Hint: reveals the method or approach without executing it. Asks student to supply components. E.g., "You'll use the quadratic formula — what goes into a, b, c here?"
MUST
AC-03
Tier 3 — Worked Scaffold: AI works through the first step only. Student must complete the rest independently.
MUST
AC-04
Hints are never volunteered unprompted before 90 seconds of student inactivity. After 90 seconds → AI prompts: "Still working on it? Want a hint?" — never auto-delivers the hint.
MUST
AC-05
Student must explicitly request each hint. Hint counter (0/3) visible to student.
MUST
AC-06
After all 3 hints exhausted and answer still wrong: AI solves fully with step-by-step explanation, then immediately presents an isomorphic problem (same structure, different numbers/context) for independent retry.
MUST
AC-07
Hint usage tracked per concept in knowledge graph. High hint dependency on a concept triggers a "needs consolidation" flag and additional practice allocation.
SHOULD


F-STU-013
Misconception Detection & Correction
MVP

AI identifies and corrects specific wrong mental models using contrastive explanation.
AC#
Acceptance Criterion
Priority
AC-01
Platform maintains a misconception library per subject: common wrong mental models mapped to diagnostic signals (wrong answer patterns + error types).
MUST
AC-02
When a student answer matches a misconception signature, AI names and corrects it: "It looks like you might be thinking X — that's a very common confusion."
MUST
AC-03
Correction uses contrastive explanation: show why the wrong model fails with a counterexample, then show why the correct model works. Not just "that's wrong, here's right."
MUST
AC-04
Detected misconceptions are logged to the student's profile and injected into all future session prompts for that concept cluster.
MUST
AC-05
Novel misconceptions (no library match) are logged to an analytics event for content team review. Used to enrich the misconception library.
SHOULD
AC-06
MVP seed: minimum 20 misconceptions per subject, hand-crafted by subject experts.
MUST


F-STU-014
Virtual Whiteboard Mode
MVP

AI draws step-by-step on a shared canvas. Student can draw and submit working for AI evaluation.
AC#
Acceptance Criterion
Priority
AC-01
Whiteboard activates automatically for: geometry, algebra step-by-step, chemistry equations, physics diagrams.
MUST
AC-02
AI draws incrementally — each step revealed as AI narrates. Not a static image reveal. Steps timed to narration pace.
MUST
AC-03
Student has a separate canvas layer. Student can draw, annotate, and write working without overwriting AI content.
MUST
AC-04
"Submit my working" button — AI evaluates student's canvas drawing and provides specific feedback.
MUST
AC-05
Student can erase and redo their working. AI does not re-evaluate until student explicitly submits.
MUST
AC-06
Whiteboard state saved as part of session artifact. Student can revisit whiteboard from session replay.
SHOULD


F-STU-015
Session Completion & Summary
MVP

Structured end-of-session summary with progress feedback and next steps.
AC#
Acceptance Criterion
Priority
AC-01
Summary screen shows: Concepts covered, Questions attempted vs correct %, Time spent, Mastery change (before vs after session), Next recommended session.
MUST
AC-02
XP earned in session displayed with animation before summary. Milestone celebrations (level-up, badge unlock) shown in full-screen moment before summary.
MUST
AC-03
AI generates one personalised closing insight specific to this session's performance. Not a generic message.
MUST
AC-04
Student rates the session 1–5 stars (optional free text). Rating stored and feeds AI quality monitoring.
SHOULD
AC-05
"Schedule next session" prompt with AI's recommended time slot (based on student's historical active hours).
SHOULD
AC-06
Session summary shareable to parent via WhatsApp (Phase 2) or copy-to-clipboard (MVP).
SHOULD



4. Assessment Engine
F-STU-020
Chapter Practice Test
MVP

AI-generated unique tests per chapter. Every attempt uses a different question set.
AC#
Acceptance Criterion
Priority
AC-01
Chapter test is auto-generated on demand by AI. No two attempts for the same student on the same chapter within 90 days are semantically equivalent (embedding similarity check enforced).
MUST
AC-02
Question type mix matches board exam pattern: 40% MCQ, 30% short answer (numeric/text), 30% long answer / problem solving.
MUST
AC-03
Time limit is set at board exam time-per-mark ratio. Countdown timer visible. Auto-submits on time expiry.
MUST
AC-04
Student cannot view correct answers during the test. Answer review available only post-submission.
MUST
AC-05
Post-submission: every wrong answer shows full step-by-step solution + specific explanation of the error made (not generic "incorrect").
MUST
AC-06
Score < 40% → chapter automatically flagged "needs revision." A targeted revision session is inserted into the student's learning plan within 24 hours.
MUST
AC-07
Score history tracked across attempts. Improvement trend graph visible on chapter detail screen.
MUST
AC-08
Student can flag any question as "incorrect or ambiguous." Flagged question quarantined after 3 student flags pending admin review.
SHOULD


### Phase 2 — Chapter Trend UX & History

- Rationale: make score history more discoverable on the chapter detail and provide full, paginated history for review and analytics.
- Tasks:
	- Add inline mini-sparkline + last-score badge on each chapter card (compact, mobile-first). (A)
	- Implement a paginated history API endpoint and a dedicated history page for deep review. (B)
	- Make the detail view adapt to a bottom-sheet on narrow viewports (mobile) while remaining a centered modal on larger screens. (C)
- Acceptance criteria:
	- Mini-sparkline displays recent trend and last-score on the chapter card without blocking layout.
	- "View history" links to a paginated history page that returns `data`, `totalCount`, `limit`, `offset`.
	- Modal adapts to bottom-sheet on small screens (rounded top, drag-to-dismiss optional) and remains accessible (focus trap, ESC closes, scroll lock).


F-STU-021
Full Syllabus Mock Exam
MVP

Board-pattern full mock exam under real exam conditions.
AC#
Acceptance Criterion
Priority
AC-01
Mock exam UI replicates the board exam paper format exactly: section headings, mark allocation per question, official question numbering convention.
MUST
AC-02
Real exam duration enforced. Clock counts down. Auto-submits when time expires. No pause (except declared accessibility mode).
MUST
AC-03
Student can navigate freely between questions within a section. Can mark questions for review (flag icon). Cannot navigate between sections once a section is submitted.
MUST
AC-04
Post-exam detailed report: section-wise score, time spent per question (heatmap), percentile vs anonymised platform cohort of same grade + board.
MUST
AC-05
AI generates a "Next 2 Weeks Priority Plan" immediately post-mock based on weak section analysis.
MUST
AC-06
Minimum 5 unique full mock exams available per subject per grade at MVP launch. New mocks generated monthly by AI.
MUST
AC-07
Mock exam available for offline download as PDF (questions only, no answers). For offline paper practice.
SHOULD


F-STU-022
Spaced Repetition & Revision Scheduling
MVP

AI automatically schedules concept revision to prevent forgetting, using SM-18 algorithm.
AC#
Acceptance Criterion
Priority
AC-01
Every mastered concept (mastery_score > 0.75) gets a revision due date computed by SM-18 spaced repetition algorithm.
MUST
AC-02
Revision cards appear in the student's daily plan automatically. Student cannot permanently dismiss them — can snooze by 1 day only.
MUST
AC-03
Revision session format: 5 targeted questions on the concept. Duration: ~5 minutes. Not a full re-teach unless the student fails.
MUST
AC-04
Revision score > 80% → memory stability interval increases (next revision scheduled further out). Score < 80% → interval resets + remediation re-teach session inserted.
MUST
AC-05
"Memory strength" indicator visible per concept in the knowledge map (bar chart showing predicted retention %).
SHOULD
AC-06
Total daily revision load capped at 20 minutes. If more concepts are due, oldest due (lowest retention) are prioritised. Remainder rescheduled to next day.
MUST
AC-07
Pre-exam mode activates automatically 14 days before exam date. Retention threshold raised to 92% (more aggressive scheduling). Student notified of mode change.
SHOULD


F-STU-023
Exam Readiness Score
MVP

Live 0–100 readiness score per subject, with predicted board exam score range.
AC#
Acceptance Criterion
Priority
AC-01
Score (0–100) computed from: Chapter mastery % weighted by board exam chapter marks distribution, Mock exam performance (recency-weighted), Spaced repetition retention scores, Recency of study activity.
MUST
AC-02
Score updates after every session completion and every test submission. Student sees it on subject dashboard.
MUST
AC-03
Score breakdown shown by chapter: student can see exactly which chapters are dragging down the overall score.
MUST
AC-04
AI-generated predicted score range: "Based on current trajectory, you are likely to score 72–81 in your board exam." Confidence interval narrows as exam date approaches.
MUST
AC-05
If readiness score drops > 10 points in a week (due to forgetting or missed sessions): student notification triggered. Parent notification also triggered (Phase 2).
SHOULD



5. Engagement & Retention
F-STU-030
Daily Learning Streak
MVP

Consecutive daily activity tracking with streak protection mechanics.
AC#
Acceptance Criterion
Priority
AC-01
A day counts as "active" only when: student completes ≥ 1 full tutoring session (all 7 stages) OR completes ≥ 10 spaced repetition revision cards. Prevents gaming with 1-minute logins.
MUST
AC-02
Streak counter displayed prominently on home screen with fire emoji visual. Milestone badges at 7, 14, 30, 60, 100 days.
MUST
AC-03
Each student gets 1 streak shield per calendar month. Shield activates automatically on the first missed day to preserve streak. Student notified when shield is used.
MUST
AC-04
On streak break: message is motivational and forward-looking — not guilt-inducing. "Start a new streak today — your best is still ahead." + "Restart Streak" CTA.
MUST
AC-05
Longest streak ever permanently displayed on profile even after it breaks.
SHOULD
AC-06
Streak milestones unlock cosmetic rewards: avatar items, profile background themes. No academic impact.
SHOULD


F-STU-031
XP, Levels & Badges
MVP

Gamification layer driving intrinsic motivation through visible effort-based progress.
AC#
Acceptance Criterion
Priority
AC-01
XP awarded for: Session completion (base XP by duration), Correct answers (per question difficulty), Streak maintenance (daily multiplier), First-attempt correct (1.5x bonus), Revision card completion.
MUST
AC-02
XP is never deducted. Wrong answers earn 0 XP — not negative. Negative reinforcement is explicitly avoided.
MUST
AC-03
Level 1–100 with increasing XP thresholds. Level name and avatar frame change at key tiers (10, 20, 30, 50, 75, 100).
MUST
AC-04
Badges for: Subject chapter mastery, Streak milestones, Mock exam completion, Speed (fast correct answers), Consistency (5 sessions in 7 days), Comeback (returned after 7-day gap and completed a session).
MUST
AC-05
Badge showcase on student profile: student curates which 5 badges to display publicly.
SHOULD
AC-06
Level-up is a full-screen celebration animation — cannot be suppressed. It is an earned moment.
MUST


F-STU-032
Student Dashboard
MVP

Personalised home screen — central hub for daily learning actions and progress visibility.
AC#
Acceptance Criterion
Priority
AC-01
Dashboard is the only screen shown after login. No generic home page. Always personalised.
MUST
AC-02
Dashboard shows: Today's plan (next recommended action), Current streak + XP this week, Exam readiness score per subject, Recent session history (last 3), Active revision cards due today.
MUST
AC-03
Primary CTA is always "Continue Learning" — one tap to resume or start. Never buried.
MUST
AC-04
Exam crunch mode (≤ 14 days to exam): Dashboard UI switches to focused mode — countdown timer prominent, only exam-relevant actions shown.
SHOULD
AC-05
Dashboard loads in < 2 seconds including all personalised data. No skeleton loader longer than 2 seconds.
MUST
AC-06
Dark mode support. Font size adjustable (small / medium / large).
SHOULD


F-STU-033
Progress Reports
MVP

Detailed performance history per subject with AI-generated insight.
AC#
Acceptance Criterion
Priority
AC-01
Report shows: Sessions completed (trend graph last 30 days), Mastery % per chapter (colour-coded), Test scores over time, Time spent studying (weekly heatmap), Concepts mastered count.
MUST
AC-02
Filterable by: Subject, Time range (7 / 30 / 90 days / all time).
MUST
AC-03
AI-generated insight at top of report: specific, data-driven, non-generic. E.g., "You've improved 18% in Algebra this month. Quadratic Equations is still your weakest chapter — 2 more sessions will close the gap."
MUST
AC-04
Report downloadable as PDF — formatted for sharing with parents or teachers.
SHOULD
AC-05
Progress reports accessible on free tier. Progress visibility is never paywalled.
MUST



6. Subscription & Payments
F-STU-040
Freemium Access Control
MVP

Free tier with meaningful limits. Quality never degrades — only quantity is capped.
AC#
Acceptance Criterion
Priority
AC-01
Free tier: 3 AI tutoring sessions per subject per month (max 20 minutes each), 1 chapter test per subject per month. Diagnostic always free. Learning plan always free. Progress reports always free.
MUST
AC-02
Session cap counter visible: "2 of 3 free sessions used this month." Never hidden.
MUST
AC-03
When cap is hit: upgrade prompt shown at session end — never interrupting an in-progress session. Prompt shows: what unlocks, price, testimonial from same grade student.
MUST
AC-04
Free users receive full AI quality — same model, same prompts. Only session count is limited.
MUST
AC-05
Free tier resets on the 1st of each calendar month. Reset notification sent 3 days before: "Your free sessions reset in 3 days."
SHOULD


F-STU-041
Subscription Purchase Flow
MVP

Student or parent subscribes to a paid plan via Indian payment methods.
AC#
Acceptance Criterion
Priority
AC-01
Plans: Monthly (full price), Quarterly (10% discount), Annual (25% discount). All prices shown in INR with GST breakdown.
MUST
AC-02
Payment methods: UPI (PhonePe, GPay, Paytm), Debit/Credit card, Net banking, EMI (3/6/12 months on annual plan only).
MUST
AC-03
Payment confirmation screen shown before charge. No dark patterns. Amount, plan, renewal date, cancellation terms all visible before confirmation.
MUST
AC-04
On successful payment: instant access unlock, receipt via SMS + email, personalised welcome message from AI tutor.
MUST
AC-05
Failed payment: 3 auto-retry attempts over 3 days, then grace period notification to student + parent, then free tier reversion.
MUST
AC-06
Cancel anytime: access continues to end of paid period. No partial refunds (clearly communicated at purchase). Subscription status always visible in profile.
MUST
AC-07
Family plan: one subscription covers up to 3 child profiles. Price is 1.8x single price. Managed from parent account.
SHOULD

Phase 2 — Family Plan Enhancements

The following enhancements are planned for Phase 2 to expand and harden the Family plan experience. These are out of MVP scope but should be implemented once the core billing loop is validated in production.

- **Family seat management:** allow parents to add/remove child profiles (invite flow), transfer seats between parent accounts, and view seat audit logs. Include email/OTP verification for seat claims.
- **Flexible slot options & pricing experiments:** support configurable slot counts (4+ children) and per-child add‑ons; run A/B pricing experiments to validate the 1.8x multiplier and alternatives.
- **Upgrade/downgrade proration rules:** implement deterministic proration math, immediate-apply vs scheduled-change options, and safe credit/refund flows. Provide unit and integration tests for edge cases.
- **Referral & promo integration:** enable referral discounts and promo codes to apply correctly to family subscriptions, with fraud detection and safe rollback paths.
- **Billing metadata & reconciliation:** extend order metadata schema (Razorpay `notes`) for family subscriptions and implement reconciliation jobs to surface mismatches and auto-retry logic.
- **Admin tooling & manual adjustments:** admin console to view/modify family subscriptions, revoke seats, apply credits, and inspect referral audits.
- **End-to-end billing tests:** CI‑gated integration tests for order creation, webhook verification, refund/proration, and referral credit application, including mock payment gateway fixtures.
- **Migration & data hygiene:** one-time migration script to normalise existing subscriptions to the canonical family schema (childSlots=3, multiplier=1.8) with dry-run and rollback support.
- **Monitoring & alerts:** metrics and alerts for family churn, failed family payments, reconciliation failures, and suspicious referral activity.

Each Phase 2 item must include acceptance tests (happy, edge, error paths), UI mocks, and an owner assigned in the backlog.


F-STU-042
Referral Programme
MVP

Student earns rewards for referring friends who convert to paid subscribers.
AC#
Acceptance Criterion
Priority
AC-01
Each student gets a unique referral code. Shareable via WhatsApp share button or copy-to-clipboard.
MUST
AC-02
Referrer reward: 1 month free when referred friend's first payment clears. Applied automatically to next billing cycle — no manual claiming.
MUST
AC-03
Referred friend reward: 20% off first month subscription.
MUST
AC-04
Referral dashboard: total referrals sent, converted (paid), rewards earned, rewards pending.
SHOULD
AC-05
Fraud detection: same device fingerprint or same IP referrals flagged and voided. Student notified if reward is voided.
MUST



7. Phase 2 Features (Scoped, Not Built at MVP)
SCOPE NOTE
The following features are fully designed and acceptance-criteria-ready but explicitly excluded from MVP build scope. They are documented here to ensure MVP architecture does not block their addition.


Feature
Code
Why Deferred
Voice Interaction (ASR + TTS)
F-STU-P2-001
Requires Whisper ASR + ElevenLabs TTS integration. High infra cost at MVP scale. Language model quality for regional languages needs validation before student-facing.
Camera Input / OCR
F-STU-P2-002
Requires GPT-4o vision pipeline + math parsing. Complex error handling for low-quality images. Phase 1 students can type doubts.
Offline Mode
F-STU-P2-003
Requires PWA service worker + content pre-download + offline queue + sync-on-reconnect. Significant frontend complexity.
Leaderboard
F-STU-P2-004
Requires privacy review for minors. National-scale ranking requires sufficient student base to be meaningful.
Study Pods (Peer Learning)
F-STU-P2-005
Requires real-time group chat + AI facilitation + moderation pipeline. Separate safety review needed for minor-to-minor communication.
Brain Break Mini-Games
F-STU-P2-006
Curriculum-aligned game content requires significant design and content creation effort.
WhatsApp Session Sharing
F-STU-P2-007
Requires WhatsApp Business API integration — parent actor dependency.
Accessibility Mode
F-STU-P2-008
ARIA compliance, dyslexia font, extended time mode. Important but not blocking initial launch.


Additional Phase 2 — Freemium Observability & Tests

- Feature: Freemium job observability
	Code: F-STU-P2-009
	Why Deferred: Requires metrics & dashboard work (Prometheus / StatsD + Grafana) and alerting rules. Not required for MVP delivery of freemium UX but important for operational reliability at scale.
	Acceptance Criteria:
	- Emit per-run metrics from `worker/jobs/freemiumResetNotifications`:
		- `freemium.reset_notifications.eligible` (count of eligible students)
		- `freemium.reset_notifications.sent` (count of notifications sent)
		- `freemium.reset_notifications.failures` (count of failed sends)
	- Dashboards display 7d/30d trends and a firing alert when failures rate > 5% over 1h.
	- Unit tests exercise metric emission using a metrics mock.

- Feature: Freemium integration test (end-to-end)
	Code: F-STU-P2-010
	Why Deferred: Requires test harness seeding and controlled push send mocks. Valuable for regression coverage but not blocking the initial job implementation.
	Acceptance Criteria:
	- Integration test seeds `FreeTierUsage` rows for a small set of students with `sessionsUsed > 0` and `subscriptionStatus='free'`.
	- Run job in test harness and assert that `sendPushSafe` was called expected number of times and DB unchanged (idempotent).
	- Test included under `tests/integration/worker/` and runnable in CI with a test DB.

- Feature: Scheduler smoke test (CI dry-run)
	Code: F-STU-P2-011
	Why Deferred: Running the full scheduler in CI can be noisy; a lightweight smoke test that imports `worker/scheduler` and runs `runFreemiumResetNotifications()` in dry-run mode validates wiring.
	Acceptance Criteria:
	- A CI-only test imports the scheduler or job module and invokes the freemium job with push sending mocked.
	- Test verifies no uncaught exceptions and that the job returns a valid `FreemiumResetResult` object.
	- Marked as `ciOnly` and excluded from slower integration gates until infra available.



8. Non-Functional Requirements
Requirement
Target
Notes
Session load time
< 3 seconds on 4G
First AI response within 5 seconds of session start
AI response latency
< 8 seconds (text doubt)
SSE streaming: first token within 2 seconds
Dashboard load
< 2 seconds
Including personalised data from Neon
Mobile-first
Works on Android 8+, 2 GB RAM device
PWA, not native app at MVP
Availability
99.5% uptime target
Excludes Neon scheduled maintenance windows
Data retention
Session turns: 90 days hot, archived to R2 after
India DPDP Act compliance
Session auto-save
Every 60 seconds
Redis session state. Zero progress loss on network drop.
Concurrent sessions
1,000 target at MVP
PM2 cluster x2, Redis-backed session state


9. Production Run & Deployment

Overview
- The application runs as a Node.js production deployment managed by PM2. The web frontend (Next.js) and backend API are served from the compiled `dist/` output; background workers run from `dist/worker`.

Key constraints & entry points
- Node version: >= 20 (use the system Node or a version manager). Ensure `npm ci --include=dev` is run during CI to produce a reproducible install.
- Build outputs:
	- Web/server: `dist/server.js` (Next.js compiled server artifacts / server-side helpers).
	- Worker entry: `dist/worker/entry.js` (workers compiled with `tsconfig.workers.json`).
- PM2 processes: use `ecosystem.config.cjs` to declare processes. PM2 must run compiled JS from `dist/` only.
- Environment injection: production environment variables MUST be provided via server env files or a secrets manager. Do NOT hard-code or use `dotenv` at runtime in production code; rely on PM2 `env_file` (e.g. `.env.production`) or native orchestrator secrets.

Canonical deploy checklist (operator)
1. Pull latest tag/commit on the deploy host.
2. Ensure a DB snapshot is taken before running migrations (recommended): create a SQL dump or Neon restore point.
3. Install dependencies and build:

```bash
npm ci --include=dev
npm run build:prod
node scripts/verify-dist.cjs    # repository verification (forbidden deps, entry points)
```

4. Apply DB migrations (production-safe):

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
```

5. Start / restart services with PM2 (reads `.env.production` or process env):

```bash
pm2 start ecosystem.config.cjs --env production
pm2 restart --update-env
pm2 status
pm2 logs --lines 200
```

Operational notes
- Verification: run `node scripts/verify-dist.cjs` and confirm there are no forbidden runtime dependencies in `dist/` (e.g., `dotenv`, `ts-node`, `tsconfig-paths`). The deployment pipeline should fail on any violation.
- Workers: build workers with `tsconfig.workers.json` and start via PM2 entry `dist/worker/entry.js`. Workers must be idempotent and safe to restart.
- Timeouts & fallbacks: All external calls (OpenAI, Redis, DB) must enforce timeouts and retries with safe fallbacks (see developer guardrails in `/docs/COPILOT_GUARDRAILS.md`).
- Secrets: keep secrets out of source control. Use a secrets manager or `env_file` with restricted OS permissions. Ensure `NEXTAUTH_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`, `SENTRY_DSN` (optional) are present.
- Monitoring & logging: configure Sentry (set `SENTRY_DSN`) and Prometheus exporters. Use `pm2 monit` and centralized log collection (e.g., CloudWatch/S3 + `pm2-logrotate`).
- Health checks: expose a simple `/health` or `/api/health` endpoint returning 200; alert if the route fails.

Rollback & emergency
- Before migrations, snapshot DB and note the previous release's commit/tag.
- If a migration is irreversible, restore DB snapshot then redeploy previous artifact.
- Use graceful PM2 reloads when possible to drain requests: `pm2 reload ecosystem.config.cjs --only web`.

Security & compliance
- Do not commit `.env.production` or any secrets. Maintain an allowlist of deploy hosts with SSH key access.
- Verify third-party services and DSP compliance for student data (India DPDP). Retention policy: session turns 90 days hot, archived to R2.

Post-deploy verification commands

```bash
pm2 status
pm2 logs --lines 200
curl -fS https://localhost:3000/api/health || echo 'health failed'
node scripts/verify-dist.cjs
grep -R "dotenv" dist || echo OK
grep -R "tsconfig-paths" dist || echo OK
```

These steps describe the intended production run model and the operational checks required before release. Add infra-specific automation (CI/CD) to codify these steps in your pipeline.


---

### Phase 2 Backlog — Post-release Operational & Content Tasks

- Rationale: operational safety and content coverage tasks that must be executed post-launch to ensure mock availability and auditable content generation.
- Key items (post-release):
	- Admin-triggered seeding job: implement an admin-only API to enqueue a background `seed-mocks` job (dry-run and real modes) to create missing `MockExam` rows per subject/grade/board.
	- Worker handler & queue: background worker (BullMQ) to run `ensureMinimumMocks({ minPer })`, support LLM fallbacks safely, and persist detailed run results and errors.
	- Audit logging & ExecutionJob: every seed run must create an `AuditLog`/`ExecutionJob` entry with operator id, parameters, dryRun flag, and a persisted JSON summary for post-run review.
	- Admin UI controls: Dry-run preview, explicit backup confirmation, two-step “Run” with typed acknowledgement, and run history view with links to persisted summaries.
	- DB safety / preflight: require an operator DB snapshot / restore point before any non-dry-run run; document canonical operator commands for dev and prod.
	- Tests & CI: unit + integration tests for dry-run behavior, worker handler, audit records, and idempotency; add CI gating for these tests.
	- Post-seed verification: automated validation job that samples counts per subject/grade/board and alerts if `minPer` not met or question bank shortages occur.
	- Monitoring & retention: store run summaries (R2/S3) with retention policy, expose run metrics to operator dashboard, and surface errors to Sentry.

Acceptance criteria:
	- Admin API supports `dryRun=true` returning a concise preview and `dryRun=false` to enqueue an auditable background job.
	- Every real run requires explicit backup confirmation in the UI and a persisted `AuditLog` row linking to stored summary JSON.
	- Worker runs are idempotent and safe to retry; failures are logged and surfaced to operators.
	- CI includes tests covering dry-run, enqueueing, worker execution (mocked), and audit persistence.


