Here is the complete, updated **Sprint-Wise Ticket Allocation** across MVP and subsequent phases, incorporating the newly defined **Prompt Engineering** domain and the **Sprint 5.5 remediation** work.

---

## Spinzy Academy — Master Sprint Plan (Updated)

### How to Read This Plan
- **P0** = MVP (Must ship before any user touches the product)
- **P1** = Post-MVP Phase 1 (Enhancement & Scale)
- **P2** = Post-MVP Phase 2 (Polish, Retention, Advanced Features)
- Stories marked **[DONE]** have been implemented and accepted
- Stories marked **[IN PROGRESS]** are currently being worked on
- The **Prompt Engineering** domain has been added as a new track

---

## MVP Phase (Sprints 1–8)

### Sprint 1: Backend Foundation
**Goal:** Database, Auth, Communication, AI Worker, WebSocket — nothing works without these.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| B1.1 | Backend | P0 | Core Prisma Schema — All Models & Migrations | 🔲 TODO |
| B1.2 | Backend | P0 | Database Connection Pooling & Redis Setup | 🔲 TODO |
| B2.1 | Backend | P0 | JWT-Based Authentication Service | 🔲 TODO |
| B2.2 | Backend | P0 | Google OAuth Integration Service | 🔲 TODO |
| B3.1 | Backend | P0 | WhatsApp Cloud API Integration | 🔲 TODO |
| B3.2 | Backend | P0 | Email Service (React Email + SES/SendGrid) | 🔲 TODO |
| B4.1 | Backend | P0 | AI Content Generation Worker (BullMQ) | 🔲 TODO |
| B4.2 | Backend | P0 | Duplicate Generation Request Merging | 🔲 TODO |
| B5.1 | Backend | P0 | WebSocket Server with Socket.IO | 🔲 TODO |

**Sprint 1 Total: 9 stories**

---

### Sprint 2: Landing Page (P0)
**Goal:** Trust-communicating landing page that converts visitors into sign-ups.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| LP-1.1 | Landing Page | P0 | Landing Page Shell — Navbar, Footer, Performance | 🔲 TODO |
| LP-2.1 | Landing Page | P0 | Hero Section — Parent-Trust Headline & CTA | 🔲 TODO |
| LP-3.1 | Landing Page | P0 | Trust Moat — DPDP & Safety Icons Grid | 🔲 TODO |
| LP-4.1 | Landing Page | P0 | How It Works — Student + Parent Dual-Track | 🔲 TODO |
| LP-6.1 | Landing Page | P0 | Pricing Section — Feature Comparison Table | 🔲 TODO |

**Sprint 2 Total: 5 stories**

---

### Sprint 3: Entry Points
**Goal:** Student registration, Explore Mode, Onboarding, Admin account setup.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| S0.1 | Student | P0 | Student-Initiated Registration with Age Gate | 🔲 TODO |
| S0.3 | Student | P0 | Student Explore Mode — Learning While Waiting | 🔲 TODO |
| S1.1 | Student | P0 | Student Confirms Board & Grade (Post-Consent or Adult) | 🔲 TODO |
| S1.3 | Student | P0 | Adaptive Diagnostic Quiz (Right-Sizing) | 🔲 TODO |
| A0.1 | Admin | P0 | Super Admin Creates Admin Accounts | 🔲 TODO |
| A0.2 | Admin | P0 | Admin Accepts Invite & Sets Up Account (Password + MFA) | 🔲 TODO |
| A0.3 | Admin | P0 | Admin Login with MFA | 🔲 TODO |

**Sprint 3 Total: 7 stories**

---

### Sprint 4: Parent Flows
**Goal:** Parent landing page CTA wiring, child setup, consent delivery & approval, weekly email.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| P0.1 | Parent | P0 | Landing Page — Value Proposition & Google Sign-Up | 🔲 TODO |
| P1.1-P | Parent | P0 | Add Child Profile — Parent-Initiated | 🔲 TODO |
| P1.2-P | Parent | P0 | DPDP Consent Screen — Parent-Initiated | 🔲 TODO |
| P1.1-R | Parent | P0 | Parent Receives Unsolicited Consent Request (WhatsApp) | 🔲 TODO |
| P1.2-R | Parent | P0 | Parent Receives Unsolicited Consent Request (Email) | 🔲 TODO |
| P1.3-R | Parent | P0 | Parent Approves via Consent Mini-Page | 🔲 TODO |
| P2.2 | Parent | P0 | Weekly Progress Email — Sunday 6 PM IST | 🔲 TODO |

**Sprint 4 Total: 7 stories**

---

### Sprint 5: Core Learning Loop
**Goal:** Learning Map, Lessons, Practice Questions, Freemium Wall.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| S2.1 | Student | P0 | Learning Map Home Screen | ✅ DONE |
| S2.2 | Student | P0 | View Pre-Generated Lesson Content | ✅ DONE |
| S2.3 | Student | P0 | Practice Questions with Freemium Counter | ✅ DONE |
| S2.4 | Student | P0 | Freemium Wall — Student-Initiated Upsell | ✅ DONE |

**Sprint 5 Total: 4 stories (Complete)**

---

### Sprint 5.5: Remediation (Core Learning Loop Fixes)
**Goal:** Fix Blocker and Major deltas identified in Sprint 5 AC-gap audit.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| FIX-01 | Student | P0 | S2.3 — Incorrect answer feedback: red flash, buddy hint, correct answer, Next button | ✅ DONE |
| FIX-02 | Student | P0 | S2.1 — Onboarding→Learning Map handoff wiring verified | ✅ DONE |
| FIX-03 | Student | P0 | S2.1 — Premium-locked node opens Freemium Wall modal (not toast) | ✅ DONE |
| FIX-04 | Student | P0 | S2.2 — Replace no-store fetch with SWR cache strategy | ✅ DONE |
| FIX-05 | Student | P0 | S2.2 — Image rendering and contextual Study Buddy hints | ✅ DONE |
| FIX-06 | Student | P0 | S2.2 — Dark mode support for all lesson components | ✅ DONE |
| FIX-07 | Student | P0 | S2.2 — Hindi content toggle when availableLocales includes 'hi' | ✅ DONE |
| FIX-08 | Student | P0 | S2.3 — Practice affordance on completed chapter nodes | ✅ DONE |
| FIX-09 | Student | P0 | S2.3 — Correct answer feedback: green flash, praise, XP animation, explanation | ✅ DONE |
| FIX-10 | Student | P0 | S2.3 — Review Mistakes opens read-only review mode | ✅ DONE |
| FIX-11 | Student | P0 | S2.3 — Offline submission queue with connectivity replay | ✅ DONE |
| FIX-12 | Student | P0 | S2.4 — Ask Parent button cooldown state restored from server | ✅ DONE |
| FIX-13 | Student | P0 | S2.4 — Review Lesson Notes routes back to topic lesson page | ✅ DONE |

**Sprint 5.5 Total: 13 stories (Complete)**

---

### Sprint 6: On-Demand Content + Admin Core
**Goal:** Search-to-generate pipeline, Content moderation, Analytics dashboard.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| S3.1 | Student | P0 | Search with Empty Result → Content Request Card | 🔲 TODO |
| S3.2 | Student | P0 | AI Content Generation with Loading Experience | 🔲 TODO |
| A1.1 | Admin | P0 | Content Moderation Dashboard | 🔲 TODO |
| A1.2 | Admin | P0 | Content Review Interface — Side-by-Side Editor | 🔲 TODO |
| A4.1 | Admin | P0 | Executive Dashboard — Core KPIs | 🔲 TODO |

**Sprint 6 Total: 5 stories**

---

### Sprint 7: Landing Page (P1) + Prompt Infrastructure
**Goal:** Landing page completion, Prompt management foundation.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| LP-6.2 | Landing Page | P1 | Pricing — Traditional Tuition Savings Comparison | 🔲 TODO |
| LP-7.1 | Landing Page | P1 | FAQ — Parent-Focused Questions (Accordion) | 🔲 TODO |
| LP-9.1 | Landing Page | P1 | Final CTA & Footer | 🔲 TODO |
| PR-1.1 | Prompt Engineering | P0 | Centralized Prompt Registry | 🔲 TODO |
| PR-1.2 | Prompt Engineering | P0 | Prompt Versioning with Database Storage | 🔲 TODO |
| PR-3.1 | Prompt Engineering | P0 | Prompt Usage Logging | 🔲 TODO |

**Sprint 7 Total: 6 stories**

---

### Sprint 8: Integration Testing & Production Deployment
**Goal:** Ship MVP.

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| QA-01 | All | P0 | Full AC-gap re-audit against all Student/Parent/Admin/Landing specs | 🔲 TODO |
| QA-02 | All | P0 | 360px mobile visual QA pass (dark mode, practice flashes, premium wall) | 🔲 TODO |
| QA-03 | All | P0 | Low-end Android device performance test (₹8,000 phone, 4G) | 🔲 TODO |
| QA-04 | Backend | P0 | Onboarding→Learning Map integration test (Criterion 8 TODO) | 🔲 TODO |
| QA-05 | Backend | P0 | Diagnostics cleanup pass (forbidden tokens in compiled files) | 🔲 TODO |
| QA-06 | Backend | P0 | Production guardrail hardening (dist verification constraints) | 🔲 TODO |
| OPS-01 | Backend | P0 | Production environment setup (AWS/GCP, domains, SSL, monitoring) | 🔲 TODO |
| OPS-02 | Backend | P0 | Database backup & disaster recovery plan | 🔲 TODO |

**Sprint 8 Total: 8 stories**

---

## MVP Summary

| Domain | P0 Stories | Completed | Remaining |
| :--- | :---: | :---: | :---: |
| **Student** | 10 | 4 (+ 13 fixes) | 6 |
| **Parent** | 7 | 0 | 7 |
| **Admin** | 6 | 0 | 6 |
| **Backend** | 9 | 0 | 9 |
| **Landing Page** | 5 (+ 3 P1) | 0 | 8 |
| **Prompt Engineering** | 3 | 0 | 3 |
| **QA/Ops** | 8 | 0 | 8 |
| **TOTAL MVP** | **48 (+3 P1)** | **4 (+13 fixes)** | **44** |

---

## Post-MVP Phase 1 (Sprints 9–12): Enhancement & Scale

### Sprint 9: Parent Dashboard & Upgrade Flow

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| P4.0 | Parent | P1 | Parent Profile PIN Protection | 🔲 TODO |
| P4.1 | Parent | P1 | Parent Dashboard — Core Metrics | 🔲 TODO |
| P4.2 | Parent | P1 | Weak Topics Identification & Assign Practice | 🔲 TODO |
| P3.1 | Parent | P1 | Child-Initiated Premium Request — Push Notification | 🔲 TODO |
| P3.2 | Parent | P1 | Upgrade Flow — Plan Selection Screen | 🔲 TODO |
| P3.3 | Parent | P1 | Payment Screen — UPI First | 🔲 TODO |
| P3.4 | Parent | P1 | Post-Payment — Child Session Update | 🔲 TODO |
| B6.1 | Backend | P1 | Razorpay Integration — Orders & Subscriptions | 🔲 TODO |

**Sprint 9 Total: 8 stories**

---

### Sprint 10: Admin Operations & Prompt Quality

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| A0.4 | Admin | P1 | RBAC Enforcement for Admin API | 🔲 TODO |
| A1.3 | Admin | P1 | Bulk Pre-Generated Content Upload | 🔲 TODO |
| A1.4 | Admin | P1 | Content Version History & Rollback | 🔲 TODO |
| A2.1-R | Admin | P1 | Consent Requests Dashboard | 🔲 TODO |
| A2.2-R | Admin | P1 | Handle "Parent Didn't Receive Consent" Support Tickets | 🔲 TODO |
| PR-1.3 | Prompt Engineering | P1 | Prompt Variable Validation | 🔲 TODO |
| PR-2.1 | Prompt Engineering | P1 | Admin Prompt Management Dashboard | 🔲 TODO |
| PR-2.2 | Prompt Engineering | P1 | Prompt Quality Scoring System | 🔲 TODO |
| PR-2.3 | Prompt Engineering | P1 | A/B Testing Framework for Prompts | 🔲 TODO |
| PR-3.2 | Prompt Engineering | P1 | Prompt Performance Analytics Dashboard | 🔲 TODO |
| PR-3.3 | Prompt Engineering | P1 | Prompt Anomaly Detection & Alerts | 🔲 TODO |

**Sprint 10 Total: 11 stories**

---

### Sprint 11: Student Engagement & Parent Controls

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| S2.5 | Student | P1 | XP & Streak Reward System | 🔲 TODO |
| S3.3 | Student | P1 | AI-Generated Content "Beta" Badge & Review Status | 🔲 TODO |
| S3.4 | Student | P1 | Duplicate Generation Request Merging | 🔲 TODO |
| S4.1 | Student | P1 | Student Receives & Completes Parent-Assigned Practice | 🔲 TODO |
| P4.3 | Parent | P2 | Screen Time Management | 🔲 TODO |
| P4.4 | Parent | P2 | Subject Blocker | 🔲 TODO |
| P4.5 | Parent | P1 | Weekly Report — Premium Variant | 🔲 TODO |
| P4.6 | Parent | P2 | Multi-Child Dashboard Toggle | 🔲 TODO |
| P1.4-R | Parent | P1 | Parent Approves via WhatsApp "YES" Reply | 🔲 TODO |
| P1.5-R | Parent | P1 | New Parent Account Creation Post-Consent | 🔲 TODO |
| P1.6-R | Parent | P1 | Parent Declines Consent | 🔲 TODO |
| P1.7-R | Parent | P1 | Parent Handles Consent for Existing Account (2nd Child) | 🔲 TODO |

**Sprint 11 Total: 12 stories**

---

### Sprint 12: Communication & Infrastructure Hardening

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| B2.3 | Backend | P1 | MFA (TOTP) Service for Admin | 🔲 TODO |
| B2.4 | Backend | P1 | RBAC Middleware for Admin API | 🔲 TODO |
| B3.3 | Backend | P1 | Push Notification Service (FCM) | 🔲 TODO |
| B4.3 | Backend | P1 | Content Streaming via Server-Sent Events (SSE) | 🔲 TODO |
| B5.2 | Backend | P1 | Internal Event Bus (Pub/Sub) | 🔲 TODO |
| B7.1 | Backend | P1 | Rate Limiting Middleware | 🔲 TODO |
| B7.2 | Backend | P1 | Input Validation Middleware (Zod) | 🔲 TODO |
| B7.3 | Backend | P1 | Security Headers & CORS Configuration | 🔲 TODO |
| B8.1 | Backend | P1 | BullMQ Queue Infrastructure | 🔲 TODO |
| B8.2 | Backend | P1 | Cron Jobs for Periodic Tasks | 🔲 TODO |
| A3.1 | Admin | P1 | User Search & Profile View | 🔲 TODO |
| A3.2 | Admin | P1 | Manual Login Verification (OTP Bypass) | 🔲 TODO |
| A3.3 | Admin | P1 | Consent Dispute Resolution | 🔲 TODO |

**Sprint 12 Total: 13 stories**

---

## Post-MVP Phase 2 (Sprints 13+): Polish, Retention & Advanced Features

### Sprint 13: Student Retention Events

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| S5.1 | Student | P2 | Streak Rewards (Free Premium Day at 7-Day Streak) | 🔲 TODO |
| S5.2 | Student | P2 | Weekend Practice Arena (Free Unlimited on Mastered Topics) | 🔲 TODO |
| S5.3 | Student | P2 | Exam Warrior Mode (Dark Theme, Mock Tests, Countdown) | 🔲 TODO |
| S5.4 | Student | P2 | Summer Brain Gain Challenge (30-Day Holiday Event) | 🔲 TODO |
| P5.1 | Parent | P2 | Exam Mode Activation (Parent-Controlled) | 🔲 TODO |
| P5.2 | Parent | P2 | Mock Test Scheduler | 🔲 TODO |
| P5.3 | Parent | P2 | Revision Plan Generator | 🔲 TODO |
| P5.4 | Parent | P2 | Post-Exam Summary & Summer Mode Transition | 🔲 TODO |

**Sprint 13 Total: 8 stories**

---

### Sprint 14: Admin Advanced Features

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| A1.5 | Admin | P2 | Content Flagging by Students/Parents — Admin Resolution | 🔲 TODO |
| A2.3-R | Admin | P2 | Expired Consent Token Cleanup (Automated) | 🔲 TODO |
| A3.4 | Admin | P2 | Bulk Communication to Users | 🔲 TODO |
| A4.2 | Admin | P1 | Content Performance Analytics | 🔲 TODO |
| A4.3 | Admin | P1 | Revenue Dashboard (Super Admin Only) | 🔲 TODO |
| A4.4 | Admin | P2 | DPDP Compliance Audit Dashboard | 🔲 TODO |
| A5.1 | Admin | P1 | AI Generation Queue Monitoring | 🔲 TODO |
| A5.2 | Admin | P2 | Automated Content Expiry & Archival | 🔲 TODO |
| A5.3 | Admin | P2 | Automated Content Tagging Suggestions | 🔲 TODO |
| A6.1 | Admin | P1 | WhatsApp API Usage Dashboard | 🔲 TODO |
| A6.2 | Admin | P2 | WhatsApp Delivery Failure Monitoring | 🔲 TODO |

**Sprint 14 Total: 11 stories**

---

### Sprint 15: Growth & Retention

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| P0.2 | Parent | P1 | Referral Landing Page Variant | 🔲 TODO |
| P0.3 | Parent | P1 | School Partnership Landing Page Variant | 🔲 TODO |
| P1.3-P | Parent | P1 | Share App Link to Child's Device (WhatsApp) | 🔲 TODO |
| P1.4-P | Parent | P2 | Add Sibling — Second Child with Discount | 🔲 TODO |
| P2.1 | Parent | P1 | First Session Push Notification | 🔲 TODO |
| P2.3 | Parent | P1 | Monthly Progress Summary Email (Premium) | 🔲 TODO |
| P3.5 | Parent | P2 | Payment Failure Recovery Flow | 🔲 TODO |
| P6.1 | Parent | P2 | Referral Program — Invite & Track | 🔲 TODO |
| P6.2 | Parent | P2 | Annual Renewal Reminder Flow | 🔲 TODO |
| P6.3 | Parent | P2 | Sibling Discount on Renewal | 🔲 TODO |
| P6.4 | Parent | P1 | Cancellation Flow with Win-Back Offer | 🔲 TODO |
| P6.5 | Parent | P2 | Data Export — Learning History PDF Download | 🔲 TODO |

**Sprint 15 Total: 12 stories**

---

### Sprint 16: Prompt Optimization & Admin Polish

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| PR-2.4 | Prompt Engineering | P2 | Automated Prompt Regression Testing | 🔲 TODO |
| PR-3.4 | Prompt Engineering | P2 | Prompt Cost Budgeting & Limits | 🔲 TODO |
| PR-4.1 | Prompt Engineering | P2 | AI-Powered Prompt Optimization Suggestions | 🔲 TODO |
| PR-4.2 | Prompt Engineering | P2 | Few-Shot Example Management | 🔲 TODO |
| A7.1 | Admin | P1 | Platform Status Page Management | 🔲 TODO |
| A7.2 | Admin | P1 | Immutable Admin Audit Log | 🔲 TODO |
| B6.2 | Backend | P2 | Invoice PDF Generation | 🔲 TODO |
| B8.3 | Backend | P2 | Admin Job Dashboard (Bull Board) | 🔲 TODO |

**Sprint 16 Total: 8 stories**

---

### Sprint 17: Final Polish & Pre-Launch

| ID | Domain | Priority | Story Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| FIX-14 | Student | Minor | S2.1 — Pull-to-refresh gesture support | 🔲 TODO |
| FIX-15 | Student | Minor | S2.2 — Slide-in animation for lesson view | 🔲 TODO |
| FIX-16 | Student | Minor | S2.2 — Flag icon routed to A1.5 reporting path | 🔲 TODO |
| FIX-17 | Student | Minor | S2.3 — Enforce 4-option guarantee in question API | 🔲 TODO |
| FIX-18 | Student | Minor | S2.4 — Study Buddy illustration in Freemium Wall modal | 🔲 TODO |
| FIX-19 | Student | Minor | S2.4 — Exact copy match with 🏆 emoji | 🔲 TODO |
| FIX-20 | Student | Minor | S2.4 — Exact copy match for AI Tutor/Chapter Quiz variants | 🔲 TODO |
| S0.2 | Student | P1 | Over-18 Student — Direct Learning Map Access | 🔲 TODO |
| S0.4 | Student | P1 | Student Re-Sends or Changes Consent Request | 🔲 TODO |
| S1.2 | Student | P1 | Student Selects Study Buddy Avatar | 🔲 TODO |

**Sprint 17 Total: 10 stories**

---

## Grand Total: All Stories Across All Phases

| Phase | Sprints | P0 | P1 | P2 | Minor | Total |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **MVP** | 1–8 | 45 | 3 | 0 | 0 | **48** |
| **Sprint 5.5** | 5.5 | 0 | 0 | 0 | 13 fixes | **13** |
| **Post-MVP Phase 1** | 9–12 | 0 | 44 | 4 | 0 | **48** |
| **Post-MVP Phase 2** | 13–17 | 0 | 9 | 30 | 7 | **46** |
| **TOTAL** | — | **45** | **56** | **34** | **20** | **155** |

---

This master sprint plan now reflects the complete product roadmap: MVP through post-launch polish, with the newly added Prompt Engineering domain integrated alongside Student, Parent, Admin, Backend, and Landing Page tracks. Sprint 6 can begin immediately with S3.1, S3.2, A1.1, A1.2, and A4.1.