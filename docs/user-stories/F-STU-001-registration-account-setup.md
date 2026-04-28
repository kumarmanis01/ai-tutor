# F-STU-001 — Registration & Account Setup (MVP)

**Feature:** Student creates an account with academic profile. Parent linkage enforced for students under 13.

---

## User Stories

### US-001 — Sign-up methods

**As a** student  
**I want to** register using Google OAuth or email + password  
**So that** I can create an account in the way I prefer.

- **AC:** AC-01
- **Acceptance:** Registration supports Google OAuth and email+password; both paths create a valid user account.
- **Priority:** MUST

---

### US-002 — Academic profile collection

**As a** student  
**I want to** provide my name, age, grade (1–12), board (CBSE/ICSE/State), and medium of instruction  
**So that** the platform can personalize my learning.

- **AC:** AC-02
- **Acceptance:** System collects and stores: Name, Age, Grade (1–12), Board, Medium (language). All fields validated and persisted.
- **Priority:** MUST

---

### US-003 — Parent verification for under-13

**As a** student under 13  
**I want to** have my parent’s mobile verified via OTP before my account is activated  
**So that** the platform complies with child-safety rules.

- **AC:** AC-03
- **Acceptance:** If age < 13: parent mobile is required; parent OTP must be verified before account activation; student cannot bypass this step.
- **Priority:** MUST

---

### US-004 — Incomplete profile blocks learning

**As a** student  
**I want to** be blocked from all learning features until my profile is complete  
**So that** the system only shows content after it has my board, grade, medium, and subjects.

- **AC:** AC-04
- **Acceptance:** Profile is INCOMPLETE until Board + Grade + Medium + at least one subject are set. INCOMPLETE profile blocks access to all learning features (dashboard content, sessions, diagnostics).
- **Priority:** MUST

---

### US-005 — Subject selection (up to 6, core pre-selected)

**As a** student  
**I want to** select up to 6 subjects, with core subjects pre-selected by my grade and board  
**So that** I can focus on the right syllabus and optionally deselect non-core subjects.

- **AC:** AC-05
- **Acceptance:** Up to 6 subjects; core subjects pre-selected from Grade + Board; student can deselect non-core subjects.
- **Priority:** MUST

---

### US-006 — Grade immutability

**As a** platform  
**I want** grade to be immutable after registration unless changed by admin  
**So that** diagnostic and leaderboard abuse is prevented.

- **AC:** AC-06
- **Acceptance:** Grade cannot be edited by the student post-registration; changes require admin approval.
- **Priority:** MUST

---

### US-007 — Editable profile (non-grade)

**As a** student  
**I want to** edit my profile (except grade) from the Profile screen after registration  
**So that** I can update name, board, medium, subjects, etc. when needed.

- **AC:** AC-07
- **Acceptance:** All profile fields except Grade are editable from Profile; Grade is read-only or gated by admin.
- **Priority:** SHOULD

---

### US-008 — Post-registration welcome and checklist

**As a** student  
**I want** a welcome email and an onboarding checklist (Complete profile → Take diagnostic → Start first session) after successful registration  
**So that** I know what to do next.

- **AC:** AC-08
- **Acceptance:** On successful registration: welcome email sent; onboarding checklist shown with 3 steps: Complete profile → Take diagnostic → Start first session.
- **Priority:** SHOULD

---

## Summary

| Story ID | AC    | Priority | Theme                   |
| -------- | ----- | -------- | ----------------------- |
| US-001   | AC-01 | MUST     | Sign-up methods         |
| US-002   | AC-02 | MUST     | Profile data collection |
| US-003   | AC-03 | MUST     | Parent verification <13 |
| US-004   | AC-04 | MUST     | Incomplete profile gate |
| US-005   | AC-05 | MUST     | Subject selection       |
| US-006   | AC-06 | MUST     | Grade immutability      |
| US-007   | AC-07 | SHOULD   | Editable profile        |
| US-008   | AC-08 | SHOULD   | Welcome + checklist     |
