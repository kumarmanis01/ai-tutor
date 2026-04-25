AI HOME TUTOR PLATFORM
Student Actor
Approach Document — Current Implementation (v1 Snapshot)

Actor: Student  
Document Version: 1.0-v1-snapshot  
Scope: What is actually live / mostly implemented in v1  
Stack: Next.js + React + Node.js + TS + Prisma + PostgreSQL (Neon) + Redis + BullMQ

---

1. Overview

The v1 product focuses on topic-based practice and content delivery, with a home “Next Action” engine and a mix of legacy learning sessions and a newer structured session shell. Diagnostics, tests, and content generation are powered by an AI Content Engine. The student primarily interacts via a React/Next.js PWA.

North Star (v1, implicit):  
Weekly Active Study Sessions per Active Student, driven by a single “what to do next” CTA on the home dashboard.

---

1.1 Student Journey Stages (v1)

| Stage               | Features                                                                                            | Status                                     |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Onboarding          | Registration, profile capture (board/grade/medium/subjects), basic gating                           | Partially implemented                      |
| Core Learning       | Topic sessions via `StructuredSession` + legacy `LearningSession`, AI explanations via chat/content | Implemented (mixed engines)                |
| Assessment          | Practice tests, chapter/topic tests, some result views                                              | Implemented (not fully aligned to v2 spec) |
| Engagement          | Streaks, weekly activity, dashboard sections                                                        | Implemented (simpler than v2)              |
| Advanced Engagement | XP, badges, pods, crunch mode                                                                       | Not implemented / experimental only        |

---

2. Onboarding & Profile (v1)

F-STU-V1-001 — Registration & Profile

Scope: What exists today for student signup/profile.

| AC#   | Acceptance Criterion                                                                         | Status                                                                               |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AC-01 | Student can register with email/password and/or OAuth (Google)                               | Implemented                                                                          |
| AC-02 | Profile stores: name, board, grade, language/medium, subjects                                | Implemented (fields present)                                                         |
| AC-03 | Parent linkage for \<13: mobile OTP, mandatory before activation                             | Partially implemented (parent OTP routes exist, enforcement not fully global)        |
| AC-04 | Profile completeness gate: blocks some learning features until board/grade/medium/≥1 subject | Implemented in places (profile guard + overlays), not consistently across all routes |
| AC-05 | Grade is immutable post-registration except via grade-change request                         | Implemented (partial) — enforced on some APIs; grade-change request model exists     |
| AC-06 | Onboarding checklist UI (“Complete profile → Take diagnostic → Start first session”)         | Implemented (partial) — checklist component exists; shown in some flows              |

---

3. Home Dashboard & Next Action (v1)

F-STU-V1-010 — Home Dashboard & Next Action

Scope: What the student sees after login.

| AC#   | Acceptance Criterion                                                                                                                                | Status                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| AC-01 | Home dashboard shows a **single primary CTA** (“Start session”, “Continue session”, or “Do homework”)                                               | Implemented via `getNextAction` + `PrimaryActionCard` |
| AC-02 | Next Action engine considers: active structured session, legacy session, weak topics, spaced-like revision rules, homework, and “new topic” ranking | Implemented in `lib/homeEngine/getNextAction.ts`      |
| AC-03 | Weekly activity strip (7-day) and streaks visible                                                                                                   | Implemented                                           |
| AC-04 | Weak topics and upcoming topics lists shown when enough data                                                                                        | Implemented (requires minimum session history)        |
| AC-05 | No explicit coupling to diagnostic or learning plan — uses session/test history and topic progress                                                  | Implemented (current reality; not v2-aligned)         |

---

4. Learning Sessions (v1)

F-STU-V1-020 — Session Shell (`StructuredSession`)

| AC#   | Acceptance Criterion                                                                                                                | Status                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| AC-01 | New session engine uses `StructuredSession` with 5 phases: OVERVIEW, EXPLANATION, PRACTICE, TEST, HOMEWORK                          | Implemented (Prisma `StructuredSession`, `SessionPhase`)   |
| AC-02 | Student enters sessions via `/session/[topicId]` page which resolves legacy `sessionId` vs `topicId` and renders `SessionContainer` | Implemented                                                |
| AC-03 | Session state (phase, started/completed timestamps) stored in DB; Redis is not yet authoritative for pedagogy                       | Implemented with DB as source of truth                     |
| AC-04 | Session UI integrates with existing AI content/notes/practice generation for explanations and questions                             | Partially implemented; relies on AI Content Engine prompts |
| AC-05 | No unified 7-stage pedagogy or per-turn machine-readable tags                                                                       | Not implemented (v2 feature)                               |

---

5. Diagnostics (v1)

F-STU-V1-030 — Diagnostic Engine

| AC#   | Acceptance Criterion                                                                                          | Status                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AC-01 | Diagnostic engine exists as adaptive question flow (`DiagnosticEngine` in `services/diagnostic/engine.ts`)    | Implemented                                                                         |
| AC-02 | Engine adjusts difficulty based on correctness and tracks simple topic/skill scores                           | Implemented                                                                         |
| AC-03 | Session/attempt persistence standardized across all subjects                                                  | Partially implemented; not fully wired to end-to-end student flows                  |
| AC-04 | Diagnostics used as **hard gate before first session per subject**                                            | Partially implemented — gating exists for some entrypoints, not enforced everywhere |
| AC-05 | Diagnostic results currently produce topic/chapter-level insights but not full v2-style knowledge map visuals | Partially implemented                                                               |

---

6. Tests & Practice (v1)

F-STU-V1-040 — Practice Tests & Results

- Topic/chapter tests exist and are powered by the AI Content Engine’s generated questions.
- Submit APIs grade attempts and record scores in `TestResult`.
- Per-question breakdowns shown in some UIs; not yet a full v2 chapter-test spec with error-type explanations and board-pattern guarantees.

---

7. Engagement (v1)

F-STU-V1-050 — Streaks & Activity

- Daily streaks and some XP-like mechanics exist, integrated into the dashboard.
- Dashboard engagement sections: streak, weak topics, upcoming topics, nudges.
- Full v2 gamification (XP system with levels, badges, streak shield, crunch mode) is not implemented; v1 focuses on streaks and simple motivational cues.
