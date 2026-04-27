# Product-Layer Systems — Architecture & Implementation

**Document version:** 1.0  
**Audience:** Product, engineering, and stakeholders  
**Scope:** Five product-layer systems built on top of the existing Spinzy tutoring engine  
**Constraint:** Session engine (`sessionEngine.ts`, `transitionSessionPhase.ts`, `phaseCompletionValidator.ts`) and recommendation rules remain unchanged.

---

## 1. Purpose and Rationale

### 1.1 Why These Systems Are Needed

Spinzy is an AI-powered digital home tutor. The **core tutoring engine** (sessions, phases, recommendations) is already implemented. The following **product-layer systems** close gaps between engine output and user-facing value:

| System | Business need | User need |
|--------|----------------|-----------|
| **Recommendation Reason UI** | Transparency builds trust; reduces “why this topic?” support. | Student and parent see why the tutor suggested this topic. |
| **Weak Topic Recovery** | Reduces drop-off on struggling topics; aligns with “fix gaps” positioning. | Clear “strengthen this topic” path without a separate “recovery” product. |
| **Curriculum Progress Map** | Demonstrates progress; supports parent and school conversations. | Student sees subject/chapter completion at a glance. |
| **Parent Report Automation** | Differentiator; supports subscription and retention. | Parent gets a weekly, AI-summarized view without logging in daily. |
| **Learning Outcome Analytics** | Evidence of improvement; supports sales and retention. | Student/parent see “improved” / “stable” / “needs practice” at a glance. |

### 1.2 Design Principles

- **Engine unchanged:** All logic that drives sessions and recommendations stays in the existing engine. Product-layer code only **consumes** engine output and existing data.
- **Existing data model:** Prefer `StudentTopicProgress`, `StudentTopicMastery`, `StructuredSession`, `WeeklyStudentSummary`, and related tables. New tables only when strictly necessary (e.g. one optional column for report text).
- **Small, focused services:** `WeakTopicService`, `CurriculumProgressService`, `ParentReportService`, `LearningOutcomeService` — each does one job and is read-only where possible.
- **Deterministic logic:** No non-deterministic behavior in recommendations or analytics; same inputs yield same outputs.
- **One file per step:** Implementation is done in small, reviewable steps (one file create or modify per step) to reduce risk and ease rollback.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCT-LAYER SYSTEMS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐ │
│  │ Recommendation       │  │ Weak Topic           │  │ Curriculum         │ │
│  │ Reason UI             │  │ Recovery              │  │ Progress Map       │ │
│  │ (display only)        │  │ (WeakTopicService +   │  │ (learning-snapshot │ │
│  │                       │  │  UI differentiation)  │  │  + SubjectMastery  │ │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬──────────┘ │
│             │                          │                         │           │
│             ▼                          ▼                         ▼           │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ EXISTING: getNextAction(), PrimaryActionCard, SessionHeader, dashboard   ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                          │
│  │ Parent Report         │  │ Learning Outcome     │                          │
│  │ Automation            │  │ Analytics            │                          │
│  │ (ParentReportService  │  │ (LearningOutcome     │                          │
│  │  + weekly job + UI)   │  │  Service + API + UI) │                          │
│  └──────────┬───────────┘  └──────────┬───────────┘                          │
│             │                          │                                       │
│             ▼                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ EXISTING: WeeklyStudentSummary, generateParentReportAI, parent dashboard ││
│  │ EXISTING: StudentTopicMastery, StudentTopicProgress                      ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  UNCHANGED: sessionEngine.ts | transitionSessionPhase.ts | phaseCompletionValidator.ts  │
│  UNCHANGED: Recommendation rules P0–P6 (getNextAction)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Recommendation Reason UI

### 3.1 Why It Is Needed

The engine already returns a **reason** for every recommendation (`reasonLabel` and `ruleId`). Today this is shown in EndOfSessionCard, ContinueLearningCard, and RecommendedPracticeCard, but **not** on the main dashboard hero (PrimaryActionCard) or in the session header. Students and parents often ask “why this topic?” — surfacing the reason on the hero and in-session reduces confusion and builds trust.

### 3.2 Current State (Audit)

- **Backend:** `getNextAction()` and `/api/home/next-action` return `ruleId` and `reasonLabel`. No change required.
- **UI:** PrimaryActionCard does not accept or display `reasonLabel`. SessionHeader does not display it. Dashboard page does not pass it.

### 3.3 Architecture

- **Data flow:** Dashboard page already has `rawAction` from `getNextAction()`. Add `reasonLabel` and optionally `ruleId` to the object passed to PrimaryActionCard. Session page already receives `reason` from query; pass it as `reasonLabel` into SessionContainer → SessionHeader.
- **Service layer:** None. Display-only; no new service.
- **Components:** PrimaryActionCard (extend props, render one line in Start state); SessionHeader (optional prop, one line under breadcrumb); SessionContainer (pass reasonLabel to SessionHeader).

### 3.4 Integration Points

- **Recommendation engine:** Read-only consumer of `action.reasonLabel` and `action.ruleId`.
- **Session engine:** Not used.

---

## 4. Weak Topic Recovery

### 4.1 Why It Is Needed

Weak topics (low mastery, sufficient practice) are already detected and recommended via P2 `weak_topic_urgent`. There is no **dedicated recovery flow** — the same “start session” or “practice” is used. The gap is **UX**: when the recommendation is a weak topic, the student should see clear “strengthen this topic” framing and, optionally, a weak-topic badge so it feels intentional rather than arbitrary.

### 4.2 Current State (Audit)

- **Backend:** P2 in getNextAction; getWeakTopics / getWeakTopicsWithNames; weak-topic APIs. Failure recovery (FRS) is **inactivity-based** (3/7/14 days), not weak-topic-based.
- **UI:** WeakTopicsSection shows up to 2 weak topics. No differentiation when the hero recommendation is P2.

### 4.3 Architecture

- **WeakTopicService (new, read-only):**
  - `getWeakTopicsForStudent(studentId)` → delegate to `getWeakTopicsWithNames`.
  - `isRecoveryRecommendation(action)` → `action?.ruleId === 'weak_topic_urgent'`.
- **Data flow:** Dashboard computes `isWeakTopicRecovery = rawAction?.ruleId === 'weak_topic_urgent'` and passes to PrimaryActionCard. Optional: pass `recommendedTopicId` to WeakTopicsSection to highlight the recommended weak topic.
- **UI:** PrimaryActionCard shows distinct copy and optional badge when `isWeakTopicRecovery` is true; same navigation (no new routes or session types).

### 4.4 Integration Points

- **Recommendation engine:** Read-only; interpret `ruleId` for UI only.
- **getWeakTopics:** Consumed by WeakTopicService; no change to getWeakTopics.
- **Session engine:** Not used; links go to existing session/practice routes.

---

## 5. Curriculum Progress Map

### 5.1 Why It Is Needed

Students and parents need to see **curriculum progress** (subject/chapter completion) at a glance. This supports motivation (“you’ve completed 60% of Maths”) and parent conversations. The data and API already exist; the gap is visibility on the **main** student dashboard.

### 5.2 Current State (Audit)

- **Backend:** `/api/home/learning-snapshot` returns subject- and chapter-level completion (from curriculum + StudentTopicMastery). No change required.
- **UI:** SubjectMasteryBars exists and is used in HomeTab. The main dashboard (Phase 1 layout) does not include it.

### 5.3 Architecture

- **Optional CurriculumProgressService:** Thin read-only wrapper around the same aggregation used by learning-snapshot; single place for “curriculum progress for a student.” For minimal implementation, the dashboard can use the existing API via SubjectMasteryBars.
- **Data flow:** Dashboard page adds a “Curriculum progress” section and renders `<SubjectMasteryBars />`, which uses `useLearningSnapshot()` → `/api/home/learning-snapshot`.
- **UI:** No new component; reuse SubjectMasteryBars.

### 5.4 Integration Points

- **Learning-snapshot API:** Sole data source.
- **Curriculum + StudentTopicMastery:** Already used by learning-snapshot; no change.
- **Session engine:** Not used.

---

## 6. Parent Report Automation

### 6.1 Why It Is Needed

Parents want a **weekly, AI-summarized report** (what improved, what to encourage, one suggested action) without logging in daily. The weekly aggregation job and parent dashboard already exist; the AI report generator (`generateParentReportAI`) exists but is **not invoked** automatically and its output is not stored or shown.

### 6.2 Current State (Audit)

- **Backend:** `aggregateWeeklySummaries` writes to `WeeklyStudentSummary` and related tables. `generateParentReportAI` is not called by any route or job. No storage for report text.
- **UI:** Parent dashboard shows weekly and subject data; no “weekly summary” narrative card.

### 6.3 Architecture

- **Schema:** One optional column on `WeeklyStudentSummary`: e.g. `reportText String?` (or `aiSummary String?`). Migration adds the column.
- **ParentReportService (new):**
  - `buildWeekSummaryInput(studentId, weekStart)` — build `WeekSummaryInput` from `WeeklyStudentSummary` and existing summary data (read-only).
  - `generateAndStoreReport(studentId, weekStart)` — build input, call `generateParentReportAI`, store result in `WeeklyStudentSummary.reportText` (or cache); return text.
  - `getReportForWeek(studentId, weekStart)` — read stored report.
- **Invocation:** In `weeklyParentSummary.ts`, after `aggregateForStudent` for each student with linked parents, call `ParentReportService.generateAndStoreReport`. Errors must not break aggregation (try/catch).
- **API:** Parent dashboard route includes `reportText` (or equivalent) for each student’s current week.
- **UI:** Parent dashboard client adds a “Weekly summary” card per student; render report text or “Summary will appear after the weekly update.”

### 6.4 Integration Points

- **Weekly job:** Calls ParentReportService after aggregation; no change to aggregation logic.
- **generateParentReportAI:** Used only by ParentReportService; input from existing summaries.
- **Session / recommendation engine:** Not used.

---

## 7. Learning Outcome Analytics

### 7.1 Why It Is Needed

Stakeholders need **learning outcome metrics**: current accuracy, and where possible “improved / stable / declined” (or “vs last period”). Today there is no product-level system that computes or exposes these. The motivation service accepts `accuracyTrend` as input but does not compute it; there is no analytics dashboard for outcomes.

### 7.2 Current State (Audit)

- **Backend:** StudentTopicMastery and StudentTopicProgress hold current state. No stored baseline or history for “accuracy change” unless derived from other tables (e.g. TestResult). No dedicated outcome API.
- **UI:** No learning-outcome block on student or parent dashboard.

### 7.3 Architecture

- **LearningOutcomeService (new, read-only where possible):**
  - `getOutcomesForStudent(studentId, options?)` — aggregate current accuracy/mastery per topic (and optionally per subject) from StudentTopicMastery (and StudentTopicProgress if needed).
  - `getTrend(studentId, topicId?)` — if history or baseline is available, return `'improved' | 'stable' | 'declined' | null`; otherwise null. Optional: one column on existing table (e.g. `baselineAccuracy`) updated on existing write paths if product requires “change since baseline.”
- **API:** New GET `/api/student/learning-outcomes` (or extend existing progress API) that returns LearningOutcomeService output.
- **UI:** Student dashboard: small “Learning progress” or “Outcomes” block (e.g. LearningOutcomeBlock component that fetches the API). Parent dashboard: include outcome summary in student payload and show one line or block per student (e.g. “Accuracy trend: improved / stable / needs practice”).

### 7.4 Integration Points

- **StudentTopicMastery / StudentTopicProgress:** Read-only by LearningOutcomeService; writes remain in existing flows (session engine, progress APIs).
- **Session engine:** Not used.
- **Motivation service:** Can later consume LearningOutcomeService for `accuracyTrend`; not required for initial implementation.

---

## 8. Implementation Plan (20 Steps, One File Per Step)

Each step creates or modifies **exactly one file**. Session engine files are never modified.

### Recommendation Reason UI (Steps 1–4)

| Step | File | Purpose |
|------|------|---------|
| 1 | `components/home/PrimaryActionCard.tsx` | Add optional `reasonLabel` (and `ruleId`) to recommendation props; render one line in Start state. |
| 2 | `app/(student)/dashboard/page.tsx` | Pass `reasonLabel` and optional `ruleId` from `rawAction` into PrimaryActionCard. |
| 3 | `components/session/SessionHeader.tsx` | Add optional `reasonLabel` prop; render one line under breadcrumb when present. |
| 4 | `components/session/SessionContainer.tsx` | Pass `reasonLabel` to SessionHeader. |

### Weak Topic Recovery (Steps 5–7)

| Step | File | Purpose |
|------|------|---------|
| 5 | `lib/weakTopic/WeakTopicService.ts` (new) | Read-only: getWeakTopicsForStudent, isRecoveryRecommendation. |
| 6 | `components/home/PrimaryActionCard.tsx` | Add `isWeakTopicRecovery` prop; conditional copy and optional badge in Start state. |
| 7 | `app/(student)/dashboard/page.tsx` | Set `isWeakTopicRecovery` from `rawAction?.ruleId`; pass to PrimaryActionCard and optionally to WeakTopicsSection. |

### Curriculum Progress Map (Step 8)

| Step | File | Purpose |
|------|------|---------|
| 8 | `app/(student)/dashboard/page.tsx` | Add “Curriculum progress” section; render SubjectMasteryBars. |

### Parent Report Automation (Steps 9–14)

| Step | File | Purpose |
|------|------|---------|
| 9 | `prisma/schema.prisma` | Add optional `reportText` (or `aiSummary`) to WeeklyStudentSummary. |
| 10 | New migration file | Add column to WeeklyStudentSummary. |
| 11 | `lib/parentReport/ParentReportService.ts` (new) | buildWeekSummaryInput, generateAndStoreReport, getReportForWeek. |
| 12 | `worker/jobs/weeklyParentSummary.ts` | After aggregateForStudent, call ParentReportService.generateAndStoreReport for students with linked parents. |
| 13 | `app/api/parent/dashboard/route.ts` | Include report text for each student’s current week in response. |
| 14 | `app/(student)/parent/ParentDashboardClient.tsx` | Add “Weekly summary” card; display report text or placeholder. |

### Learning Outcome Analytics (Steps 15–20)

| Step | File | Purpose |
|------|------|---------|
| 15 | `lib/learningOutcome/LearningOutcomeService.ts` (new) | getOutcomesForStudent, optional getTrend; read-only from existing tables. |
| 16 | `app/api/student/learning-outcomes/route.ts` (new) | GET endpoint calling LearningOutcomeService. |
| 17 | `components/dashboard/LearningOutcomeBlock.tsx` (new) | Client component that fetches and displays outcomes. |
| 18 | `app/(student)/dashboard/page.tsx` | Add section that renders LearningOutcomeBlock. |
| 19 | `app/api/parent/dashboard/route.ts` | Include learning-outcome summary in each student’s payload. |
| 20 | `app/(student)/parent/ParentDashboardClient.tsx` | Display learning outcomes in each student card. |

---

## 9. Data Models Used (No New Tables Except Optional Column)

| System | Tables / models used |
|--------|----------------------|
| Recommendation Reason UI | None (engine output only). |
| Weak Topic Recovery | getWeakTopicsWithNames (reads StudentTopicProgress / weak-topic logic); getNextAction result. |
| Curriculum Progress Map | SubjectDef, ChapterDef, TopicDef, StudentTopicMastery; learning-snapshot aggregation. |
| Parent Report Automation | WeeklyStudentSummary (optional `reportText`), SubjectProgressSummary, parent link tables; generateParentReportAI. |
| Learning Outcome Analytics | StudentTopicMastery, StudentTopicProgress; optional one column for baseline if needed. |

---

## 10. Verification and Rollback

- **Lint:** `npm run lint` (or project equivalent) must pass.
- **Type-check:** `npm run type-check` (e.g. `tsc --noEmit`) must pass.
- **Build:** `npm run build` must complete successfully.
- **Rollback:** Each step is one file; revert the commit for that step to roll back. No shared state between steps except the optional DB column (Step 9/10); migration can be reverted if needed.

---

## 11. References

- Session UX revamp: `Docs/session-ux-revamp.md`
- Recommendation engine: `Docs/RECOMMENDATION_ENGINE.md`
- Audit and gap analysis: from prior product-layer audit and gap analysis documents
- Implementation plan: 20-step, one-file-per-step plan above

---

*This document describes the architecture and implementation plan for the five product-layer systems. Implementation proceeds step-by-step with one file per step; the session engine and recommendation rules remain unchanged.*
