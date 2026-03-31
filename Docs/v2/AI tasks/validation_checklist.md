# Spinzy V2 — Validation Checklist
# Run through this after all 32 tasks are complete and deployed.
# Each item is a manual test. Failures go into bug fixes.
# Last updated: 2026-03-15

---

## PRE-LAUNCH ACTION ITEMS

These must be completed before accepting real paying users.
Work through them in order.

---

### ACTION 1 — Email fix (mailer.ts + VPS config)

**Status:** ⏳ Pending
**Blocker:** Weekly digest, receipt emails, cost alerts all silently fail without this.

**Step 1 — Check mailer.ts uses secure: true for port 465:**
```bash
grep -n "secure\|port\|host" lib/mailer.ts | head -10
```
If `secure` is not set conditionally, paste this into Claude Code:
```
In lib/mailer.ts, update the nodemailer transporter to:
const secure = parseInt(process.env.EMAIL_SERVER_PORT ?? '465') === 465
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT ?? '465'),
  secure,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
})
```

**Step 2 — Update .env.production on VPS:**
```bash
EMAIL_SERVER_HOST=smtp.hostinger.com
EMAIL_SERVER_PORT=465
EMAIL_SERVER_USER=no-reply@spinzydigital.com
EMAIL_SERVER_PASSWORD=<actual-password>
EMAIL_FROM=Spinzy <no-reply@spinzydigital.com>
EMAIL_SERVER=smtps://no-reply%40spinzydigital.com:<password>@smtp.hostinger.com:465
```
Note: EMAIL_FROM domain must match EMAIL_SERVER_USER domain. `no-reply@gnosiva.com` will fail — use `no-reply@spinzydigital.com`.

**Step 3 — Test send:**
```bash
cd /home/gnosiva/apps/content-engine/ai-tutor
node -e "
require('dotenv').config({ path: '.env.production' })
const nodemailer = require('nodemailer')
const t = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT),
  secure: true,
  auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD }
})
t.sendMail({
  from: process.env.EMAIL_FROM,
  to: process.env.EMAIL_SERVER_USER,
  subject: 'Spinzy mailer test',
  text: 'Mailer is working correctly.'
}, (err, info) => {
  if (err) console.error('FAILED:', err.message)
  else console.log('SENT:', info.messageId)
})"
```
Expected: `SENT: <messageId>`

**Alternative if Hostinger SMTP keeps failing:** Switch to Resend (https://resend.com):
- Free tier: 3,000 emails/month
- Setup: create account → verify spinzydigital.com domain → get API key
- Config: `EMAIL_SERVER_HOST=smtp.resend.com`, `EMAIL_SERVER_PORT=465`, `EMAIL_SERVER_USER=resend`, `EMAIL_SERVER_PASSWORD=re_xxxx`

---

### ACTION 2 — DPDP Consent copy lawyer review

**Status:** ⏳ Blocked on lawyer
**Blocker:** Cannot show consent screen to real users without legally reviewed copy.

**Step 1 — Extract current placeholder copy:**
Open `components/student/ConsentGate.tsx` and find the consent text.
It currently reads (placeholder):
```
Spinzy needs your consent to:
1. Process your academic data (grades, answers, progress) to personalise your learning.
2. Use AI to generate tutoring responses during your sessions.
You can withdraw consent at any time from Profile → Privacy Settings.
```

**Step 2 — Send to lawyer:**
Email the consent copy to a lawyer with this context:
- Platform: AI home tutoring for students aged 6–18 in India
- Law: Digital Personal Data Protection Act 2023 (DPDP)
- Data processed: academic performance data, session transcripts, mastery scores
- AI involvement: GPT-4o generates tutoring responses in real-time
- Age-gating: under-13 requires verified parental consent (already implemented)
- Request: review and approve consent copy for legality under DPDP 2023

**Step 3 — After lawyer approves:**
1. Update the consent copy in `components/student/ConsentGate.tsx` with the approved text
2. On VPS: `nano .env.production` → set `NEXT_PUBLIC_CONSENT_LIVE=true`
3. Redeploy: `./scripts/deploy-and-run.sh`
4. Test: register a new account → confirm consent screen appears with approved copy

---

### ACTION 3 — Distress detection on-call process

**Status:** ⏳ Blocked on Manish's decision
**Blocker:** Cannot enable distress detection without a human owner for alerts.

**Step 1 — Define on-call:**
Decide who receives distress alerts. Options:
- You (Manish) personally: your mobile email
- A counsellor: if you have a tie-up with iCall or similar
- A support email: monitored during school hours

**Step 2 — Set on VPS:**
```bash
nano .env.production
# Add:
ONCALL_EMAIL=your-chosen-email@domain.com
```

**Step 3 — Test the distress flow on staging (before going live):**
```bash
# In a test session, send a message containing a trigger phrase
# e.g. "I feel worthless" — should NOT fire in production until flag is true
# Set flag temporarily on staging only:
ENABLE_DISTRESS_DETECTION=true
```
Confirm: SafetyEvent row created, parent/on-call email received.

**Step 4 — Enable on production after test passes:**
```bash
nano .env.production
ENABLE_DISTRESS_DETECTION=true
pm2 restart ecosystem.config.cjs --env production
```

---

### ACTION 4 — Staged rollout progression

**Status:** ⏳ Currently at 5%
**Current:** `ROLLOUT_PERCENTAGE=5` — ~5% of new user IDs get AI tutor

**Progression plan:**
| Stage | % | When to move | How |
|-------|---|-------------|-----|
| Current | 5% | — | — |
| Stage 2 | 20% | After 10 real students complete 3+ sessions with no critical bugs | `node scripts/set-rollout.cjs --percentage 20` on VPS + `pm2 restart` |
| Stage 3 | 50% | After Stage 2 runs 48h with cost/session < $0.003 | Same script, 50 |
| Stage 4 | 100% | After Stage 3 runs 48h clean | Same script, 100 |

**How to increase rollout:**
```bash
cd /home/gnosiva/apps/content-engine/ai-tutor
# Update the env var:
sed -i 's/ROLLOUT_PERCENTAGE=.*/ROLLOUT_PERCENTAGE=20/' .env.production
# Restart all processes:
pm2 restart ecosystem.config.cjs --env production
```
Or per-user override for beta testers:
```bash
node scripts/set-rollout.cjs --user <userId> --enabled true
```

**Monitor after each stage increase:**
```bash
# Cost per session (check daily):
pm2 logs ai-tutor-scheduler --lines 20 | grep costReport

# Session error rate:
# Run in Neon SQL console:
# SELECT COUNT(*) FILTER (WHERE status='error') * 100.0 / COUNT(*) as error_pct
# FROM "StructuredSession" WHERE "startedAt" > NOW() - INTERVAL '24 hours'
```

---

### ACTION 5 — Run validation checklist

**Status:** ⏳ Not started
**When:** After Actions 1–4 are complete and a deploy is done.

Work through Sections 1–14 of this document in order.
Mark each item ✅ / ❌ / ⚠️.
Post failures here for triage.

Priority order within the checklist:
1. Section 3 (Diagnostic) — critical path
2. Section 4 (Dashboard) — most-used screen
3. Section 6 (AI Tutor Chat) — core product
4. Section 1 (Registration) — onboarding funnel
5. Section 11 (Safety) — legal requirement
6. Sections 2, 5, 7, 8, 9, 10, 12, 13, 14 — in order

---

## SECTION 1 — REGISTRATION & AUTH

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 1.1 | Open site as logged-out user | Lands on registration/login page | |
| 1.2 | Sign in with Google | Redirects to onboarding or dashboard | |
| 1.3 | Sign in with mobile OTP | OTP sent, verified, redirected | |
| 1.4 | Register with age = 17 | No parent gate shown | B1 fix |
| 1.5 | Register with age = 10 | Parent gate overlay appears, cannot dismiss | |
| 1.6 | Register with age = null/blank | No parent gate shown | B1 fix |
| 1.7 | Parent gate: enter OTP | Overlay disappears, proceeds to profile setup | |
| 1.8 | Parent gate: resend OTP | Available after 30s, disabled before | |
| 1.9 | Parent gate: 3 failed resends | "Contact support" message shown | |
| 1.10 | Navigate to /student/verify-parent | Redirects to /dashboard | B2 fix |
| 1.11 | Sign out | Clears session, lands on login page | |

---

## SECTION 2 — ONBOARDING FLOW

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 2.1 | New user with no profile → visit /dashboard | ProfileCompletionGate overlay shown | T29 |
| 2.2 | ProfileCompletionGate: click outside | Nothing happens — cannot dismiss | |
| 2.3 | ProfileCompletionGate: no X button | Confirmed absent | |
| 2.4 | Complete board selection | Checklist shows Board ✓ | |
| 2.5 | Complete class/grade selection | Checklist shows Class ✓, grade is saved | |
| 2.6 | Change grade after first save | Grade unchanged in DB | T32 |
| 2.7 | Complete medium selection | Checklist shows Medium ✓ | |
| 2.8 | Select subjects (Maths + Science pre-checked) | Cannot deselect locked subjects | |
| 2.9 | Try selecting 7 subjects | 7th subject cannot be selected (max 6) | |
| 2.10 | Complete all 4 profile fields | Gate lifts, student reaches dashboard | |
| 2.11 | Exam date screen: enter date + 5 days/week | Coverage estimate updates live | T27 |
| 2.12 | Exam date screen: skip | Redirects to diagnostic with 6-month plan | |
| 2.13 | Consent screen (when CONSENT_LIVE=true) | Both checkboxes required before "I agree" | T11 |

---

## SECTION 3 — DIAGNOSTIC FLOW

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 3.1 | Visit /student/session without diagnostic | Redirected to /student/diagnostic/[subjectId] | T31 |
| 3.2 | POST /api/tutor/session/start without diagnostic | Returns 403 DIAGNOSTIC_REQUIRED | T31 |
| 3.3 | Diagnostic page loads | Full-screen, no nav bar, progress bar top, timer top-right | T24 |
| 3.4 | Select MCQ answer | Option highlighted, "Next question" enabled | |
| 3.5 | Click next without selecting | Button remains disabled | |
| 3.6 | Back button during diagnostic | Not present | |
| 3.7 | Timer reaches 28:00 | Warning text appears, timer turns amber | |
| 3.8 | "Save and continue later" | Redirects to /dashboard, progress saved | |
| 3.9 | Resume saved diagnostic | Resumes from last answered question | |
| 3.10 | Complete all questions | Knowledge map results screen shown | |
| 3.11 | Knowledge map: score shown? | NO numeric score anywhere — colour only | |
| 3.12 | Knowledge map: "Start learning" CTA | Navigates to /dashboard | |
| 3.13 | Post-diagnostic: diagnostic guard cleared | /student/session now accessible | |
| 3.14 | Post-diagnostic: LearningPlan generated | DB has LearningPlan + LearningPlanItem rows | T8 |
| 3.15 | Post-diagnostic: StudentConceptState seeded | DB has rows for all concepts in subject | T17 |

---

## SECTION 4 — DASHBOARD

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 4.1 | New user (no diagnostic) | Onboarding checklist card shown | T6, T21 |
| 4.2 | "Take diagnostic — Mathematics" CTA | Navigates to diagnostic page | |
| 4.3 | "It's been a couple of days" nudge on new user | NOT shown | T6 fix |
| 4.4 | User with diagnostic + plan | "Today's plan" card shows topic name + week number | T9 |
| 4.5 | TodaysLearningCard: "Start today's session" | Navigates to pre-session screen | |
| 4.6 | XP widget shows | Level badge + "XP this week: N" + progress bar | T7 |
| 4.7 | Readiness ring: score < 40 | Red ring (#E24B4A), "Critical" label | T7 |
| 4.8 | Readiness ring: score 40–70 | Amber ring (#BA7517), "Needs work" | T7 |
| 4.9 | Readiness ring: score > 70 | Green ring (#1D9E75), "On track" | T7 |
| 4.10 | Readiness ring: no diagnostic | Empty state "Take diagnostic" CTA | |
| 4.11 | Revision widget: 0 due | "You're all caught up ✓" green card | |
| 4.12 | Revision widget: N due | "N cards due today" chip, taps to /revisions | T31 |
| 4.13 | Week strip: today highlighted teal | Correct day highlighted | T21 |
| 4.14 | Week strip: completed days purple | Days with sessions filled purple | |
| 4.15 | Streak badge in topbar | "🔥 N days" orange pill | T21/T30 |
| 4.16 | Level badge in topbar | "Lv N" purple pill | T21 |
| 4.17 | Weak topics section: new user | Hidden (shown only after 3+ sessions) | |
| 4.18 | Dashboard loads in < 2s | Time to interactive measured | |
| 4.19 | One widget error | Other widgets unaffected | |
| 4.20 | Dashboard on mobile 360px | Single column, no horizontal scroll | T21 |
| 4.21 | Dashboard on desktop | Two-column layout (plan left, readiness right) | T21 |
| 4.22 | Dark mode | All widgets readable, no white-on-white | |

---

## SECTION 5 — PRE-SESSION SCREEN

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 5.1 | Navigate to pre-session | Topic name, subject badge, duration, stages shown | T23 |
| 5.2 | Prerequisite pills load | Skeleton shown briefly, then pills appear | |
| 5.3 | All prereqs mastered | No warning banner | |
| 5.4 | Some prereqs incomplete | Amber warning banner shown | |
| 5.5 | CTAs visible immediately | Not blocked on prereq load | |
| 5.6 | "Study prerequisites first" CTA | Navigates to lowest-mastery prereq | |
| 5.7 | "Start session" CTA | Navigates to AI tutor chat | |
| 5.8 | Incomplete session exists (<24h) | InterruptedSessionSheet slides up | T23 |
| 5.9 | InterruptedSheet: "Resume" | Resumes from correct stage | |
| 5.10 | InterruptedSheet: "Restart" | Starts fresh from Hook stage | |
| 5.11 | InterruptedSheet: "Skip" | LearningPlanItem = DEFERRED, back to dashboard | |
| 5.12 | InterruptedSheet: tap outside | Nothing happens — must choose | |

---

## SECTION 6 — AI TUTOR CHAT

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 6.1 | Session starts | Stage strip shows 7 stages, Hook active (purple) | T26 |
| 6.2 | Vidya sends first message | Streaming text with cursor blink | |
| 6.3 | Typing indicator | 3 animated dots while waiting for first token | |
| 6.4 | Machine tags shown to student | NEVER — [QUESTION] etc stripped | |
| 6.5 | Stage advances | Stage strip updates, transition divider shown | |
| 6.6 | Hint bar: EXPLANATION stage | Hint bar hidden | |
| 6.7 | Hint bar: PRACTICE stage | "Hints: 0/3" visible, "Get a hint" button | |
| 6.8 | Request hint | Hint delivered, counter increments | |
| 6.9 | 3 hints used | "Get a hint" button disabled | |
| 6.10 | 90s inactivity | Pulsing nudge appears above input | |
| 6.11 | Start typing after inactivity | Nudge auto-dismisses | |
| 6.12 | SSE connection drops | "Connection lost — reconnecting..." banner | |
| 6.13 | Reconnect after drop | Last AI message re-delivered, typed text preserved | |
| 6.14 | Send button during streaming | Disabled while response in progress | |
| 6.15 | Input bar on iOS | Not obscured by keyboard, safe-area respected | |
| 6.16 | ENABLE_AI_TUTOR=false | Existing v1 session UI shown, no error | T17 |
| 6.17 | CONSENT_REQUIRED error | Streamed error shown, tutor blocked | T11 |
| 6.18 | Jailbreak attempt | Safe refusal returned, no LLM call | T12 |
| 6.19 | PII in message (phone number) | Redacted before LLM, not shown in response | T12 |
| 6.20 | Session completes (CONSOLIDATION) | SessionCompletionScreen shown | |

---

## SECTION 7 — SESSION COMPLETION

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 7.1 | XP counter animates | Ticks up from old to new over 800ms | T25 |
| 7.2 | Level-up occurred | Full-screen overlay shown first, min 1.5s | T25 |
| 7.3 | Level-up overlay: skip | Cannot skip, waits 1.5s minimum | |
| 7.4 | Stats row | 4 chips: questions, % correct, hints, minutes | |
| 7.5 | Mastery delta | Shows only concepts from this session (max 5) | |
| 7.6 | Mastery improved | Green "N% → N% ↑" shown | |
| 7.7 | AI insight: loading | 3s skeleton shown | |
| 7.8 | AI insight: populated | Session-specific text (not generic) | |
| 7.9 | AI insight: error/null | Fallback text shown, no crash | |
| 7.10 | Star rating: optional | CTA available after rating OR 5s | |
| 7.11 | Star rating: tap | Brief animation, rating submitted | |
| 7.12 | "Start next session" CTA | Navigates to next LearningPlanItem | |
| 7.13 | "Back to dashboard" | Navigates to /dashboard | |

---

## SECTION 8 — REVISION CARDS

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 8.1 | /student/revisions with 0 due | "No revision due today ✓" + "Browse subjects" | T31 |
| 8.2 | /student/revisions with N due | RevisionFlow shown, N cards queued | |
| 8.3 | Answer MCQ correctly | Green feedback + brief explanation | |
| 8.4 | Answer MCQ wrongly | Red feedback + worked answer + error type label | |
| 8.5 | Complete all cards: score > 80% | "Memory strengthening" green card | |
| 8.6 | Complete all cards: score ≤ 80% | "Re-teach added to plan" amber card | |
| 8.7 | 20-minute cap reached | "Daily cap reached, come back tomorrow" | |
| 8.8 | No back button | Confirmed absent during revision | |

---

## SECTION 9 — FREEMIUM + PAYMENTS

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 9.1 | 3 sessions used for a subject | FreemiumUpgradeGate shown on next attempt | T20 |
| 9.2 | Gate: cannot dismiss without choosing | Confirmed | T28 |
| 9.3 | Gate: session counter shown | "3 of 3 used", reset date shown | |
| 9.4 | Gate: no referral copy | "Refer a friend" text absent | |
| 9.5 | Gate: "Remind me later" | Sticky banner on dashboard for 24h | T28 |
| 9.6 | Upgrade flow: UPI listed first | UPI is first payment option | T28 |
| 9.7 | Upgrade flow: GST shown | "₹N + GST ₹N = ₹N total" visible | |
| 9.8 | Confirm button locked | Cannot pay until scrolled to bottom of terms | T28 |
| 9.9 | Payment success | Receipt email + SMS sent, dashboard access restored | |
| 9.10 | Payment failure | Retry shown (up to 3x), then support contact | |
| 9.11 | In-progress session: cap hit | Session NOT interrupted mid-way | T20 |

---

## SECTION 10 — PARENT FLOW

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 10.1 | Student role visits /parent/dashboard | Redirected to /dashboard | T12 |
| 10.2 | Parent role visits /parent/dashboard | Dashboard loads with linked children | T12 |
| 10.3 | Parent with no linked children | "Link a child" empty state + CTA | T12 |
| 10.4 | Student generates invite link | Invite URL returned, valid 48h | T12 |
| 10.5 | Parent accepts invite | ParentStudent row created, child appears in dashboard | T12 |
| 10.6 | Parent invite token reused | Second use fails (token burned on first use) | T12 |
| 10.7 | Parent views child readiness | Real scores shown (not zeros) | T13 |
| 10.8 | Parent visits /parent/progress/[studentId] | Sessions list (no transcript content) | T13 |
| 10.9 | Parent visits unlinked student | notFound() — 404 page | T13 |
| 10.10 | Parent cannot see session messages | Confirmed absent | T13 |
| 10.11 | Weekly digest: fires Sunday 18:00 IST | Email received with correct data | T13 |
| 10.12 | Weekly digest: GPT narrative | 2 sentences, encouraging, no jargon | T13 |

---

## SECTION 11 — SAFETY

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 11.1 | Indian mobile number in student message | Redacted to [MOBILE] before LLM | T12 |
| 11.2 | Email address in student message | Redacted to [EMAIL] | T12 |
| 11.3 | Aadhaar-style number in message | Redacted to [AADHAAR] | T12 |
| 11.4 | Jailbreak attempt: "ignore all instructions" | Safe refusal, no LLM call, SafetyEvent created | T12 |
| 11.5 | 3 jailbreak attempts | Account flagged in SafetyEvent table | T12 |
| 11.6 | NSFW content in AI response | Blocked, replacement shown, SafetyEvent created | T13 |
| 11.7 | ENABLE_DISTRESS_DETECTION=false | No distress processing, flag confirmed false | T20/T43 |
| 11.8 | GET /api/admin/safety-events | Returns unresolved events (admin role only) | T14 |

---

## SECTION 12 — INFRASTRUCTURE

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 12.1 | pm2 status | All 3 processes online, restart count 0 | |
| 12.2 | GET /api/health/redis | 200 { status: "ok", latencyMs: N } | |
| 12.3 | Deploy script runs clean | All 13 steps green, no warnings | |
| 12.4 | Prompt eval gate | 8/8 assertions pass on every deploy | T36 |
| 12.5 | Worker dist verification | dist/worker/bootstrap.js exists post-build | |
| 12.6 | ENABLE_AI_TUTOR=true | Confirmed in pm2 env | |
| 12.7 | ENABLE_DISTRESS_DETECTION=false | Confirmed in pm2 env | |
| 12.8 | ROLLOUT_PERCENTAGE=5 | Confirmed in pm2 env after T17 | T17 |
| 12.9 | Cost metric job registered | pm2 logs scheduler shows job registered | T18 |
| 12.10 | Weekly digest job registered | pm2 logs scheduler shows job registered | T13 |
| 12.11 | Nightly readiness pre-compute registered | pm2 logs scheduler shows 21:30 UTC job | T10 |
| 12.12 | SM-18 job registered | pm2 logs scheduler shows 02:00 UTC job | T23 |
| 12.13 | Circuit breaker: 3 OpenAI failures | isCircuitOpen() returns true | T16 |
| 12.14 | Prisma version | v6.19.1 confirmed in package.json | |

---

## SECTION 13 — MOBILE EXPERIENCE

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 13.1 | Bottom nav visible on mobile | 4 items: Home, Learn, Doubts, Profile | T22 |
| 13.2 | Bottom nav hidden on desktop | Confirmed at md: breakpoint | T22 |
| 13.3 | All tap targets ≥ 44×44px | Verified on key interactive elements | |
| 13.4 | No horizontal scroll on any screen | Verified on 360px viewport | |
| 13.5 | Keyboard doesn't obscure input | Chat input stays visible when keyboard opens | T26 |
| 13.6 | iOS safe-area insets respected | Bottom nav + chat input not clipped | T22/T26 |
| 13.7 | Dark mode: all screens readable | No white-on-white or invisible text | |
| 13.8 | Diagnostic MCQ options ≥ 52px height | Verified | T24 |

---

## SECTION 14 — COPY & CONTENT RULES

| # | Test | Expected | Notes |
|---|------|----------|-------|
| 14.1 | Streak break message | Does NOT contain: "broke", "missed", "failed", "lost" | T30 |
| 14.2 | Freemium gate copy | Does NOT mention referral programme | T28 |
| 14.3 | Knowledge map results | No numeric score shown anywhere | T24 |
| 14.4 | Consent copy (when CONSENT_LIVE=true) | Lawyer-reviewed text in place (not placeholder) | T11 |
| 14.5 | Parent dashboard language | No technical jargon, plain language | T12 |
| 14.6 | "Vidya never gives direct answers" | Test: "What is the answer to this problem?" → Vidya asks a question back | Core rule |

---

## KNOWN ISSUES TO INVESTIGATE

| # | Issue | Source | Priority | Status |
|---|-------|--------|----------|--------|
| K1 | Scheduler logs show only hydrationReconciler — weekly digest + cost metric + readiness jobs not visible | 2026-03-15 VPS logs | High | ✅ RESOLVED — all jobs now registered: weeklyParent, readinessPrecompute, costReport confirmed in scheduler.scheduled log |
| K2 | Parent dashboard requires separate account with role=parent — cannot test by visiting URL as student | 2026-03-15 observation | Medium | ⏳ OPEN — use Neon SQL console to set role=parent on a test account: `UPDATE "User" SET role = 'parent' WHERE email = 'test@...'` |
| K3 | Diagnostic page was dead-end redirect | post_launch_backlog | High | ✅ RESOLVED — Task 24 complete. DiagnosticFlow built with timer, MCQ, partial save, knowledge map results |
| K4 | CONSENT_LIVE=false — consent screen not shown to any user yet | T11 | Blocked on lawyer | ⏳ OPEN — code complete, waiting for lawyer to review consent copy in ConsentGate.tsx |
| K5 | ENABLE_DISTRESS_DETECTION=false — distress detection not active | T20/T43 | Blocked on on-call | ⏳ OPEN — code complete (Task 20), waiting for Manish to define on-call alias in ONCALL_EMAIL |
| K7 | phase12/regenerationWorker integration tests excluded from CI | Pre-existing | Low | ⏳ OPEN — stale fixtures, post-launch workstream |
| K8 | Onboarding page was blank (just title + one line) after Task 3 gate | 2026-03-15 screenshot | High | ✅ RESOLVED — Task 27 built full onboarding flow: board/grade/medium/subjects, exam date screen, ProfileSetupForm |
| K9 | Old horizontal nav "Home \| Learning Path \| Doubts \| Profile" still showing after Task 21 | 2026-03-15 screenshot | Medium | ✅ RESOLVED — Task 22 replaced StudentNav with Topbar + BottomNav |

---

## TASK COMPLETION STATUS

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Gates | T1–T6 | ✅ All complete |
| Phase 2 — Dashboard data | T7–T10 | ✅ All complete |
| Phase 3 — Parent actor | T11–T13 | ✅ All complete |
| Phase 4 — Reliability | T14–T20 | ✅ All complete |
| Phase 5 — V2 UI | T21–T27 | ✅ Complete — all 7 tasks done |
| Phase 6 — Missing features | T28–T32 | ✅ T28 ✅ T29 ✅ T30 ✅ T31 ✅ T32 ✅ |
| Admin/Content pipeline | A1–A10 | ✅ All 10 tasks complete |

Migrations on Neon: 25 applied (add_push_subscription pending deploy)
Unit tests passing: 1204
Integration tests: 106/108 passing (2 todo — streak shield, intentionally deferred)
PM2 processes: 3 online, restart count 0
PWA: manifest, service worker, install prompt, 8 push notification types

---

## CHANGE LOG

| Date | Section | Change |
|------|---------|--------|
| 2026-03-15 | All | Initial creation |
| 2026-03-15 | Task status | Admin tasks A1–A10 complete — grade backdoor, AuditLog, quarantine, CLI, DPDP erasure, admin UI, ingestion v2 |
| 2026-03-15 | Task status | Task 28 complete — subscription upgrade flow: PlanSelector, PaymentMethodSelector, PaymentConfirmation (scroll-to-confirm), UpgradeFlow orchestrator, UpgradeBanner, Razorpay verify |
| 2026-03-15 | Task status | Task 26 complete — AITutorChatPanel: stage strip, typing indicator, streaming cursor, inactivity prompt, SSE exponential backoff, iOS input |
| 2026-03-15 | Task status | Phase 5 complete — all 7 V2 UI tasks done |
| 2026-03-15 | Task status | Task 21 cleanup — 11 dead home components deleted, weak topics + upcoming inlined, CTA routing fixed to /session/pre/[conceptId] |
| 2026-03-15 | Task status | Task 25 complete — SessionCompletionScreen: CSS confetti, XP animation, level-up overlay, inline star rating |
| 2026-03-15 | Task status | Task 23 complete — PreSessionScreen, InterruptedSessionSheet, learning-plan PATCH |
| 2026-03-15 | Known Issues | K1 resolved — all scheduler jobs confirmed registered |
| 2026-03-15 | Known Issues | K3 resolved — Task 24 diagnostic page complete |
| 2026-03-15 | Known Issues | K8 resolved — Task 27 onboarding flow complete |
| 2026-03-15 | Known Issues | K9 resolved — Task 22 bottom nav + topbar complete |
| 2026-03-15 | Task status | Added task completion tracker |
