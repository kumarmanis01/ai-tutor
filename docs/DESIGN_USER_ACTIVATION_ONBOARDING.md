<!--
FILE OBJECTIVE:
- Design document: unified user activation, onboarding completion, and parent contact verification.
  Covers requirements 1-10 from product input and audit findings from 2026-05-11.

LINKED UNIT TEST:
- tests/unit/docs/design_user_activation.spec.ts (to be created on implementation)

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/ENGINEERING_PRACTICES.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-11T00:00:00Z | copilot | initial design document, audit + product requirements synthesis
- 2026-05-11T12:00:00Z | copilot | resolved all 5 open questions per product owner input
- 2026-05-12T00:00:00Z | copilot | implementation completed in ordered sequence; status updated from draft to implemented
-->

# Design: User Activation & Onboarding Completion

**Status:** IMPLEMENTED — completed on 2026-05-12  
**Author:** GitHub Copilot (architecture audit)  
**Date:** 2026-05-11  
**Scope:** Onboarding form, parent OTP verification, accountStatus lifecycle,
middleware active-user guard, removal of phone/SMS scope.

---

## 1. Problem Summary

The system currently has four interconnected issues uncovered by the audit:

| # | Problem | Impact |
|---|---------|--------|
| A | `parent_whatsapp` submitted by the onboarding form is silently dropped — only `whatsapp_phone` (student's own number) is persisted. | Parent WhatsApp OTP can never be sent to the parent. |
| B | `onboardingComplete` is computed in the JWT callback from academic fields only (grade, board, language, subjects). Parent contact verification is not part of this signal. | A user whose OTP was never verified can appear `onboardingComplete = true`. |
| C | `accountStatus` defaults to `active` in the database schema, so every new user is born active regardless of whether they submitted the onboarding form. | Users can bypass the onboarding form entirely and reach protected pages. |
| D | There is no single utility that answers "is this user fully allowed to use the app?" — middleware checks only token presence, layout checks profile completeness with partial coverage, and a few pages check `onboardingComplete && accountStatus === 'active'` in ad-hoc conditions. | Route protection is fragmented and easy to leak. |

---

## 2. Requirements (Product Input)

| # | Requirement | Analysis |
|---|-------------|----------|
| 1 | Parent WhatsApp MUST NOT be dropped; must be persisted and OTP-verified separately. | Requires a dedicated `parentWhatsappPhone` DB column distinct from the student's `whatsappPhone`. The onboarding API must read `parent_whatsapp` from the request body and write it to `parentWhatsappPhone`. |
| 2 | Students **below DPDP age** (13) MUST verify at least one parent contact (WhatsApp OR email) via OTP before their account is activated. | This is a hard gate. `accountStatus` stays `pending_parent_verification` until at least one OTP verification succeeds. |
| 3 | Students **at or above DPDP age** can optionally provide parent WhatsApp or email. | No OTP gate enforced for adults. They pass through to active on form submit. |
| 4 | OTP channels (email and WhatsApp) are **independent**: each gets its own code, both can be verified simultaneously, one verified channel is sufficient for activation. | The `channelOtpKeyByType` helper in `lib/parent/contactLinking.ts` already supports per-channel keys. The current `send-otp` route must be rewritten to send to each channel independently rather than using a single derived key. |
| 5 | Phone number (SMS) is **out of scope** and must be removed. | `parentPhone` field exists in schema and is referenced in `send-otp`, `verify-otp`, `contactLinking`, and `profileGuard`. All references must be removed. The `parentPhone` column can be nulled/deprecated via an additive migration (not dropped immediately — see §5.5). |
| 6 | A student below DPDP age is only marked `active` once at least one parent OTP channel is verified. | `accountStatus` transitions: `pending_onboarding` → (form submit) → `pending_parent_verification` → (OTP verified) → `active`. |
| 7 | `onboardingComplete` as a concept: the product is fine with `accountStatus = active` as the single source of truth. No separate boolean flag is needed for "onboarding done" downstream. | See §3.3 — `onboardingComplete` in the JWT/session is kept as a derived convenience signal but must be computed from `accountStatus === 'active'`, not independently from profile fields. |
| 8 | Middleware MUST add an active-user flag to protect student and parent paths. | Middleware has access to the JWT token which carries `accountStatus`. It can enforce `accountStatus === 'active'` for protected prefixes and redirect to `/student/onboarding` otherwise. |
| 9 | Until the onboarding form is submitted, the user MUST be marked inactive (not active). | `accountStatus` default in schema must change from `active` to `pending_onboarding`. New users start inactive. |
| 10 | `user.active` (i.e. `accountStatus === 'active'`) is the **only** logical check to allow access to protected pages. No additional completeness computed fields. | All route guards simplify to one check: `accountStatus === 'active'`. ProfileGuard and `isProfileComplete()` are decommissioned from gating; they exist only to guide the user within the onboarding form itself. |

---

## 3. Proposed Design

### 3.1 Database Schema Changes

```
User model changes (additive):

  parentWhatsappPhone  String?    -- parent's WhatsApp; distinct from whatsappPhone (student's)
  parentEmailVerifiedAt DateTime? -- timestamp when parent email OTP was consumed
  -- parentWhatsappVerifiedAt is already called parentPhoneVerifiedAt (repurpose, rename below)
  parentWhatsappVerifiedAt DateTime? -- rename parentPhoneVerifiedAt to this (additive migration)

AccountStatus enum:
  ADD:    pending_onboarding          -- new default; user registered but form not submitted
  KEEP:   pending_parent_verification -- under-DPDP, form submitted, OTP not yet verified
  KEEP:   active                      -- fully activated
  KEEP:   suspended
  KEEP:   deletion_pending
  CHANGE: default from `active` to `pending_onboarding`

parentPhone column:
  Retain in schema for now (additive-only rule). Stop writing to it.
  Stop reading from it in OTP/verification logic. Mark with a deprecation comment.
  Remove in a later cleanup migration after old data is migrated.
```

**Migration sequence (additive):**
1. Add `parentWhatsappPhone String?`
2. Add `parentEmailVerifiedAt DateTime?`
3. Add `parentWhatsappVerifiedAt DateTime?`
4. Add `pending_onboarding` to `AccountStatus` enum
5. Change default on `accountStatus` to `pending_onboarding` (safe: does not affect existing rows)
6. Backfill: set all existing users where academic fields are filled to `active` (one-time data migration in the migration script — preserves current behaviour for live users)

### 3.2 Onboarding API Changes (`app/api/user/onboarding/route.ts`)

**On successful form submit:**

```
Read from body (add):
  parent_whatsapp → write to parentWhatsappPhone (when not already set)
  Keep: parent_email → write to parentEmail

On DB update success:
  For ALL students (any age):
    Set accountStatus = 'pending_parent_verification'   ← replaces current logic which only did this for under-13
    (Rationale: user submitted the form; they are no longer pending_onboarding)

  For students AT or ABOVE DPDP age:
    Immediately also set accountStatus = 'active'
    (No OTP gate required for adults)

  For students BELOW DPDP age:
    Leave accountStatus = 'pending_parent_verification'
    Trigger OTP dispatch to all configured parent channels

Return:
  { ok: true, requiresOtp: boolean }
  Client navigates to OTP view if requiresOtp, else to exam-date step.
```

**Why unified:** Previously the status was only set for under-13. Adults were left at the
schema default (`active`), which is changing. Every submit must now explicitly resolve to
either `active` (adult) or `pending_parent_verification` (minor).

### 3.3 Unified accountStatus Lifecycle

```
                 ┌──────────────────┐
  Registration   │ pending_onboarding│  <-- new default
                 └────────┬─────────┘
                           │ form submitted (any age)
                 ┌─────────▼──────────────┐
  Adult          │ active                  │
  (age ≥ 13)     │                         │  <-- immediate on submit
                 └─────────────────────────┘

  Minor          ┌─────────────────────────┐
  (age < 13)     │ pending_parent_          │
                 │ verification             │  <-- awaiting OTP
                 └─────────┬───────────────┘
                            │ ≥1 parent channel OTP verified
                 ┌──────────▼──────────────┐
                 │ active                  │  <-- fully activated
                 └─────────────────────────┘
```

### 3.4 Parent OTP Changes

**Two separate send paths (both trigger on form submit for minors):**

```
POST /api/auth/parent/send-otp/email    -- sends email OTP to parentEmail
POST /api/auth/parent/send-otp/whatsapp -- sends WhatsApp OTP to parentWhatsappPhone
(Or: keep single route, add channel param: POST /api/auth/parent/send-otp { channel: 'email' | 'whatsapp' })
keep single route, use channel
```

Each channel gets its own `PhoneOtp` record using `channelOtpKeyByType` (already exists in
`lib/parent/contactLinking.ts` — currently underused by the send-otp route).

**Verification (POST /api/auth/parent/verify-otp):**
- Accept `{ code, channel }` body — channel can be `'email'` or `'whatsapp'`
- On success for either channel:
  - Set `accountStatus = 'active'`
  - Set the channel-specific verified timestamp:
    - `channel = 'email'` → set `parentEmailVerifiedAt`
    - `channel = 'whatsapp'` → set `parentWhatsappVerifiedAt`
  - If `parentVerifiedAt` is not already set, set it now (OQ-2: first verified channel wins)
- Remove all `parentPhone`/`parentPhoneVerifiedAt` references
- Return `{ ok: true, channel, verification: { email: {...}, whatsapp: {...} } }`

**`/api/student/verify-parent/confirm-otp` (to be deleted):**
This endpoint is a duplicate. It will be deleted. All OTP verification goes through
`/api/auth/parent/verify-otp` with a `channel` param (OQ-1 resolved).

### 3.5 Session / JWT Changes (`lib/auth.ts`)

```typescript
// jwt callback — currently:
token.onboardingComplete = !!(dbUser.grade && dbUser.board && dbUser.language && subjectCount > 0)

// After change:
token.onboardingComplete = dbUser.accountStatus === 'active'
// ↑ single source of truth; matches requirement 7 and 10
```

`session.user.onboardingComplete` stays in the session shape for backward compatibility with
any client code that reads it, but its derivation simplifies to one field check.

**`requireActiveSession()` hardening (OQ-4 resolved):**
```typescript
// Currently: checks token exists + DB user exists
// After: also checks accountStatus === 'active'
export async function requireActiveSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { accountStatus: true },
  })
  if (!dbUser || dbUser.accountStatus !== 'active') return null
  return session
}
```
This makes it safe to call from any API route or server component that needs to know
the caller is fully activated, not just authenticated.

### 3.6 Middleware Changes (`middleware.ts`)

**Add active-user guard for student and parent paths:**

```typescript
// In the protected prefix loop, for /student/* and /parent/* paths:
if (token.accountStatus !== 'active') {
  // Token exists (authenticated) but user is not yet active
  if (pathname.startsWith('/student/onboarding')) return NextResponse.next() // allow
  if (pathname.startsWith('/api/user/onboarding')) return NextResponse.next() // allow submit
  if (pathname.startsWith('/api/auth/parent')) return NextResponse.next()    // allow OTP flow
  return NextResponse.redirect(new URL('/student/onboarding', request.url))
}
```

This is the **only** active-user check needed at the routing level. It does not need to know
about profile fields, subjects, age or any other logic — `accountStatus === 'active'` is the
complete contract (Requirement 10).

### 3.7 Student Layout Simplification (`app/(student)/layout.tsx`)

After middleware enforces the active check, the layout no longer needs to:
- Call `checkProfileCompleteness(userId)`
- Call `isProfileComplete(...)` as a gate
- Redirect to `/student/onboarding` if profile is incomplete

It still needs to:
- Call `requiresParentOTPGate` / `checkParentGate` only to show the overlay modal (not to gate routing — that's handled by middleware)

**The layout becomes simpler:**
```
if session missing → redirect / (handled by middleware before layout runs)
if accountStatus != active → redirect /student/onboarding (handled by middleware before layout runs)
layout renders → optionally shows ParentOTPGate modal if still pending (edge case: user navigated directly)
```

### 3.8 Onboarding Form Changes (`app/(student)/student/onboarding/page.tsx`)

1. Add parent WhatsApp field label change: "Parent WhatsApp number" (currently present, good)
2. Validation for minors: require parentEmail OR parentWhatsapp (already done, good)
3. Submit payload must include `parent_whatsapp` (currently `form.parentWhatsapp` is sent as
   `parent_whatsapp` on line 302 — **form is already correct; only the API needs to consume it**)
4. After successful submit:
   - If `requiresOtp: true` → show OTP view
   - If `requiresOtp: false` → navigate to `/student/onboarding/exam-date`

### 3.9 ProfileGuard Role Reduction

`lib/student/profileGuard.ts` is demoted from a **routing gate** to a **form validation helper**:
- `isProfileComplete()` used only within the onboarding form to show inline field errors
- `checkProfileCompleteness()` used only for admin/debug tooling
- `parentPhone` references removed from both functions
- `parentPhoneVerified` in `StudentProfileData` renamed to `parentChannelVerified` (any channel)

---

## 4. Field Naming Clarification

The current schema is ambiguous. This table shows the proposed clear mapping:

| DB Field | Who it belongs to | Purpose | Status |
|---|---|---|---|
| `User.whatsappPhone` | Student | Student's own WhatsApp for reminders/alerts | Keep, no change |
| `User.parentEmail` | Parent contact | Parent email for OTP + notifications | Keep, no change |
| `User.parentWhatsappPhone` | Parent contact | Parent WhatsApp for OTP + notifications. **Not self-service editable** (support-only). | **ADD** |
| `User.parentPhone` | Parent contact | Legacy SMS (out of scope) | Deprecate — stop writing, keep column for now |
| `User.parentEmailVerifiedAt` | Verification | Timestamp email OTP was consumed | **ADD** |
| `User.parentWhatsappVerifiedAt` | Verification | Timestamp WhatsApp OTP was consumed | **ADD** (rename `parentPhoneVerifiedAt` via additive migration) |
| `User.parentVerifiedAt` | Verification | **Keep.** Set when first OTP of any channel is verified (OQ-2). | Keep, populate on first verification |
| `User.parentPhoneVerifiedAt` | Verification | Superseded by `parentWhatsappVerifiedAt` — stop writing after migration | Deprecate |

---

## 5. What Changes Versus What Stays the Same

### Changes required

| Component | Change |
|-----------|--------|
| `prisma/schema.prisma` | Add `parentWhatsappPhone`, `parentEmailVerifiedAt`, `parentWhatsappVerifiedAt`; add `pending_onboarding` enum value; change default `accountStatus` |
| `app/api/user/onboarding/route.ts` | Read `parent_whatsapp`, persist to `parentWhatsappPhone`; set `active` or `pending_parent_verification` on every submit |
| `app/api/auth/parent/send-otp/route.ts` | Use `channelOtpKeyByType` per channel; remove `parentPhone`/SMS fallback; send independently to email and WhatsApp |
| `app/api/auth/parent/verify-otp/route.ts` | Accept `channel` param; set channel-specific verified timestamp; set `accountStatus = 'active'` |
| `lib/auth.ts` | Compute `token.onboardingComplete` from `accountStatus === 'active'` only |
| `middleware.ts` | Add active-user guard redirecting inactive users to `/student/onboarding` |
| `lib/student/profileGuard.ts` | Remove `parentPhone` references; demote from gate to form helper |
| `app/(student)/layout.tsx` | Remove profile gate redirect logic; keep parent OTP modal overlay |
| `lib/student/accountStatus.ts` | Update `requiresParentOTPGate` to also check `pending_onboarding` state |

### Stays the same

| Component | Why |
|-----------|-----|
| `lib/parent/contactLinking.ts` | `channelOtpKeyByType` and `resolveParentChannels` are already correct; only callers change |
| `app/(student)/student/onboarding/page.tsx` | Form already sends `parent_whatsapp`; validation for minors is already correct; only response handling changes |
| OTP countdown/resend UI | No change needed |
| `lib/student/parentGate.ts` | `checkParentGate` still used to show the modal overlay in the layout |
| `PhoneOtp` model | No schema change needed; already stores per-key OTPs |

---

## 6. Open Questions — RESOLVED

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | Two OTP verify endpoints exist: `/api/auth/parent/verify-otp` and `/api/student/verify-parent/confirm-otp`. | **One route, one UI screen.** Keep `/api/auth/parent/verify-otp`. Accept `{ code, channel }` body so email and WhatsApp OTPs are verified via the same endpoint but can be verified separately and independently. Delete `/api/student/verify-parent/confirm-otp`. |
| OQ-2 | Retire `parentVerifiedAt`? | **Keep it.** Set `parentVerifiedAt` when the **first** OTP of any channel is successfully consumed. It acts as the "parent has been verified at least once" timestamp. Channel-specific timestamps (`parentEmailVerifiedAt`, `parentWhatsappVerifiedAt`) remain for per-channel audit. |
| OQ-3 | Is parent contact required for adults? | **Optional for adults.** Parent contact (email or WhatsApp) is only useful for adults to receive progress updates. No validation error if omitted. No OTP step for adults. |
| OQ-4 | Should `requireActiveSession()` also check `accountStatus`? | **Yes.** `requireActiveSession()` must verify: (1) valid JWT token exists, AND (2) `accountStatus === 'active'`. Returns `null` for unauthenticated OR inactive users. This makes it safe to call from API routes and server components outside the middleware-protected layout. |
| OQ-5 | Is `parentWhatsappPhone` immutable after first save? | **Not self-service immutable.** Students cannot change it themselves. Can only be updated via a support flow (admin/back-office). Not immutable at the schema level — just no self-service update endpoint. |

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Schema default change (`active` → `pending_onboarding`) breaking existing live users | High | Backfill migration: set `accountStatus = 'active'` for all users where `grade IS NOT NULL AND board IS NOT NULL`. Run in the same migration. |
| JWT token cached in browser still showing old `accountStatus` after migration | Medium | Token is refreshed on every request from DB (current `jwt` callback fetches DB user). No action needed beyond ensuring the callback runs. |
| Middleware redirect loop if onboarding page itself is not excluded from guard | High | Explicitly allowlist `/student/onboarding`, `/api/user/onboarding`, and `/api/auth/parent/*` in the middleware guard. These are already partially exempted in the layout via `skipOnboarding` flags. |
| Removing `parentPhone` from send-otp breaks users who had `parentPhone` set and no `whatsappPhone` | Low | `parentPhone` was SMS-only and out of scope. Existing users with a `parentPhone` and no `parentWhatsappPhone` will simply have no WhatsApp channel. If they have `parentEmail` they can still verify via email. |
| Duplicate OTP endpoint (`confirm-otp`) continues to diverge in parallel | Medium | Consolidate as part of this change (OQ-1). Otherwise, any fix to the primary endpoint must be mirrored. |

---

## 8. Implementation Order (Executed)

Implemented in this order:

1. [x] **Schema migration** — added new columns, added `pending_onboarding`, changed default, backfill included.
2. [x] **lib/auth.ts** — `onboardingComplete` now derives from `accountStatus === 'active'`.
3. [x] **middleware.ts** — active-user guard added for student/parent paths.
4. [x] **`/api/user/onboarding`** — consumes `parent_whatsapp`, sets accountStatus on submit.
5. [x] **`/api/auth/parent/send-otp`** — channel-specific keys, phone/SMS fallback removed.
6. [x] **`/api/auth/parent/verify-otp`** — channel param + channel-specific verified timestamps.
7. [x] **Consolidate/remove `/api/student/verify-parent/confirm-otp`** (OQ-1 decision).
8. [x] **Layout** — profile gate redirect removed.
9. [x] **ProfileGuard** — parentPhone logic removed; helper demoted to form/readiness checks.
10. [x] **Tests** — unit/targeted regression tests updated and passing.

---

## 9. Files Affected (Summary)

```
Modified:
  prisma/schema.prisma
  lib/auth.ts
  middleware.ts
  lib/student/profileGuard.ts
  lib/student/accountStatus.ts
  app/(student)/layout.tsx
  app/api/user/onboarding/route.ts
  app/api/auth/parent/send-otp/route.ts
  app/api/auth/parent/verify-otp/route.ts

Deleted (OQ-1 resolved — one route is canonical):
  app/api/student/verify-parent/confirm-otp/route.ts

Tests to update:
  tests/unit/lib/auth.spec.ts
  tests/unit/lib/profileGuard.spec.ts (if exists)
  tests/unit/lib/parent/contactLinking.spec.ts
  tests/unit/api/onboarding.grade-immutability.test.ts
  __tests__/middleware.ts.test.ts
  __tests__/app/student/onboarding/page.spec.tsx
```

---

*End of design document — awaiting review before any implementation.*
