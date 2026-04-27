AI HOME TUTOR PLATFORM
Parent Actor
Approach Document — Current Implementation (v1 Snapshot)

Actor: Parent  
Document Version: 1.0-v1-snapshot  
Scope: What exists for parents today in v1  
Stack: Shared with student app (Next.js + React + Node.js + TS + Prisma + PostgreSQL + Redis + BullMQ)

---

1. Overview

In v1, the parent actor is only partially implemented. The main parent-related capabilities are:
- Under-13 parent mobile verification (OTP) during/after student onboarding.
- Limited parent-facing surfaces (if any) and basic email/SMS notifications.
- Subscription and paywall behaviour that is primarily student-centric rather than parent-first.

There is no full-fledged parent dashboard comparable to the v2 Parent document; much of the monitoring and control functionality is still to be built.

---

1.1 Parent Journey Stages (v1)

Stage | Features | Status
----- | -------- | ------
Account Setup | Parent mobile OTP, linkage from student account | Partially implemented
Monitoring | Limited or no dedicated parent dashboard | Not fully implemented
Trust Building | Occasional notifications, no narrative weekly digest | Not implemented
Payment | Subscription purchase handled from student side, not parent-centric | Partially implemented
Active Communication | No WhatsApp 2-way or parent chatbot | Not implemented

---

2. Account Setup & Child Linking (v1)

F-PAR-V1-001 — Parent Mobile Verification & Linkage

AC# | Acceptance Criterion | Status
--- | -------------------- | ------
AC-01 | Student under an age/grade threshold is required to provide parent mobile and request OTP | Partially implemented (age/grade heuristic; not fully aligned to v2 age logic)
AC-02 | `/api/auth/parent/send-otp` issues OTP with DB + rate limiting and phone normalisation | Implemented
AC-03 | `/api/auth/parent/verify-otp` verifies OTP, marks parentVerified / updates accountStatus | Implemented
AC-04 | Parent account is not yet a distinct user type; linkage is primarily fields on `User` | Current reality
AC-05 | Multiple children per parent (family plan) is not explicitly modelled | Not implemented

---

3. Monitoring & Dashboards (v1)

F-PAR-V1-010 — Parent Monitoring View

- There is no fully separate “parent dashboard” per v2 spec.
- Parents may:
  - Receive transactional notifications (OTP, some emails/SMS).
  - Log in (or share device) as the student and see the student dashboard.
- There is **no dedicated per-child view** showing:
  - Simplified weekly activity,
  - Subject mastery summaries,
  - Exam readiness scores,
  - Parent-friendly narrative explanations.

Status: **Not implemented** as a first-class parent experience.

---

4. Child Profile Management (v1)

F-PAR-V1-020 — Child Profile Management from Parent Lens

- Child academic profiles (board, grade, medium, subjects) are managed primarily by the student within the student app.
- Parents do not yet have:
  - A separate management screen to adjust exam dates, weekly hours, or study schedules,
  - A mechanism to request plan adjustments or topic focus via a parent-only channel.

Status: **Not implemented** (beyond indirect influence via student profile).

---

5. Consent & Safety Acknowledgement (v1)

F-PAR-V1-030 — Consent & Safety

- Parent OTP verification implies a form of consent but:
  - There is no structured consent record with: data processing purposes, AI interaction, community features, and explicit timestamps/IP.
  - Withdrawal of consent and associated data deletion flow are not modelled as first-class parent actions.

Status: **Not implemented** as a DPDP-style consent module; partially implied via OTP workflows.

---

6. Payment & Subscription (v1)

F-PAR-V1-040 — Payment & Plans

- Subscription logic and paywalls exist but are mostly **student-centric**:
  - Free question caps on `/api/chat`.
  - Premium checks to unlock unlimited usage or additional features.
- Razorpay or equivalent integration is present for checkout, but:
  - The flow is not deliberately framed as a “parent chooses plan for child(ren)”.
  - There is no family plan UX or invoices dashboard targeted specifically at parents.

Status: **Partially implemented** (core payments exist, parent-centric experience does not).

---

7. Communication (v1)

F-PAR-V1-050 — Notifications & Messaging

- v1 sends some transactional emails/SMS:
  - Account-related messages (OTP, verification).
  - Possibly some basic progress/test result emails.
- There is no:
  - WhatsApp 2-way parent-AI assistant,
  - Weekly digest summarising study activity and readiness,
  - Explicit parent “nudges” (e.g., exam approaching, low readiness).

Status: **Implemented at a basic transactional level**, but not aligned yet with the richer v2 parent communication model.

