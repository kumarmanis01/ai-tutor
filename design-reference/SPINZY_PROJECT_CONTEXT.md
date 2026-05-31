# Spinzy Academy — Project Context for Claude Code
> Principal Software Architect handoff document. Read fully before writing a single line of code.

---

## Tech Stack

- **Frontend**: Next.js (App Router) + React + TypeScript + TailwindCSS
- **Backend**: Node.js + TypeScript + Prisma + PostgreSQL
- **Queue**: BullMQ + Redis
- **AI**: OpenAI API
- **Auth**: NextAuth (Google OAuth + MSG91 Phone OTP)
- **Payments**: Razorpay
- **Deployment**: AlmaLinux (prod), Docker (local validation)
- **Fonts**: Plus Jakarta Sans (sans), JetBrains Mono (mono)

---

## User Roles

- **Student** — Grades 6–12, Indian board exams (CBSE/ICSE/State)
- **Parent** — monitors child progress, manages billing
- **Admin** — internal only, NOT in rewrite scope

---

## Directory Structure (post-archive state)

```
OLD_student/          ← archived old student pages, REFERENCE ONLY, never import
OLD_parent/           ← archived old parent pages, REFERENCE ONLY, never import
app/
  (auth)/
    login/
      student/page.tsx
      parent/page.tsx
  (student)/
    layout.tsx
    student/
      dashboard/page.tsx       [S3]
      onboarding/page.tsx      [S1]
      diagnostic/page.tsx      [S2]
      tutor/page.tsx           [S4 Vidya]
      path/page.tsx            [S5]
      progress/page.tsx        [S6]
      revise/page.tsx          [S7]
      tests/page.tsx           [S8]
      upgrade/page.tsx         [S9]
      profile/page.tsx
    session/
      [topicId]/page.tsx       [S4 Learning Session]
  (parent)/
    layout.tsx
    parent/
      dashboard/page.tsx       [P1]
      progress/page.tsx        [P2]
      schedule/page.tsx        [P3]
      payments/page.tsx        [P4]
      profile/page.tsx         [P5]
components/
  ui/                          ← NEW shared component library (from design system)
    Btn.tsx
    TierPill.tsx
    SubjectChip.tsx
    Ring.tsx
    Card.tsx
    SectionTitle.tsx
    SessionCard.tsx
    EmptyState.tsx
    Skeleton.tsx
    ErrorState.tsx
    Bar.tsx
    Avatar.tsx
    BottomNav.tsx
    AppHeader.tsx
    Segmented.tsx
    Mono.tsx
    Icons.tsx
    index.ts                   ← barrel export
lib/
  constants/
    readiness.ts               ← EXISTING — getReadinessTier(), 5-tier scale
    freemium.ts                ← EXISTING — FREE_TIER_SESSION_LIMIT=3, FREE_TIER_CHAPTER_TEST_LIMIT=1
    tiers.ts                   ← NEW — TIERS map with CSS var refs
    subjects.ts                ← NEW — SUBJECTS map with CSS var refs
  features/
    rollout.ts                 ← EXISTING — feature flags
  freemium.ts                  ← EXISTING — freemium logic
design-reference/              ← Claude Design output, READ ONLY
  styles/tokens.css
  src/*.jsx
  screenshots/*.png
prisma/                        ← untouched
```

---

## Business Rules (NON-NEGOTIABLE)

### Readiness / Tiers
- **5 tiers only**: critical | weak | fair | ontrack | strong
- **Students NEVER see readiness as numbers** — TierPill labels only, always
- Tier color map (fixed, never deviate):
  - critical → red `var(--tier-critical)`
  - weak → amber `var(--tier-weak)`
  - fair → warm-yellow `var(--tier-fair)`
  - ontrack → indigo `var(--tier-ontrack)`
  - strong → green `var(--tier-strong)`
- Indigo is reserved EXCLUSIVELY for the ontrack tier — never use for brand or UI chrome
- Canonical logic lives in `lib/constants/readiness.ts` — always use `getReadinessTier()`

### Brand Colors
- **Brand = Teal** (`var(--brand-500)` ≈ #0d9488)
- Teal is intentionally distinct from all 5 tier colors
- All token values defined in `design-reference/styles/tokens.css` — CSS custom properties

### Freemium Gates
- Free tier: **3 sessions/month**, **1 chapter test/period**
- Constants from `lib/constants/freemium.ts`:
  - `FREE_TIER_SESSION_LIMIT = 3`
  - `FREE_TIER_CHAPTER_TEST_LIMIT = 1`
- Never hardcode these values inline

### Crunch Mode
- Activates when exam ≤ **14 days** away
- Dashboard layout changes dramatically in crunch mode (see `student-dashboard.jsx` crunch variant)
- The countdown becomes the hero element with red gradient banner

### DPDP Minor Gate
- Age < 13 requires **parent OTP** inline during onboarding — do not skip or defer
- This is a legal compliance requirement (India DPDP Act)

### Grade & Board Immutability
- Grade and board are **immutable after first save** — UI must reflect this (no edit affordance post-save)

### Diagnostic Requirement
- Diagnostic assessment is **required before any learning session can begin**
- Gate this at session start — redirect to diagnostic if not completed

### AI Tutor (Vidya)
- Gated behind: (1) diagnostic complete AND (2) rollout hash check (5% rollout)
- Use `lib/features/rollout.ts` for the hash check
- Never show Vidya entry points to users outside rollout

### Deferred Features (do NOT build)
- Rooms feature — descoped
- Referral UI — suppressed until Task 28
- Weekly Challenge — descoped from this release

---

## Design System Rules

### Tokens
- `design-reference/styles/tokens.css` is the **single source of truth** for all tokens
- Never hardcode colors, spacing, radii, or shadows
- Always use `var(--token-name)` — Tailwind config extends via CSS var references
- Dark mode: set `data-theme="dark"` on `<html>` — tokens.css handles the rest automatically

### Typography
- Sans: `var(--font-sans)` → Plus Jakarta Sans
- Mono: `var(--font-mono)` → JetBrains Mono (use for numbers, codes, countdowns)
- Type scale (px, mobile-first):
  - display: 30px | h1: 24px | h2: 20px | h3: 17px
  - body: 15px | sm: 13px | xs: 11.5px | micro: 10.5px

### Spacing
- 4pt base grid: `--s-1: 4px` through `--s-9: 56px`

### Layout
- **Mobile-first, 390px base width** — all screens designed for 390px
- Bottom nav bar on student screens (home/path/tests/progress) — not on tutor/whiteboard
- PWA shell — `overflow: hidden` on root, scroll within screen containers

### Animations
- Use keyframes from `tokens.css` only: `spz-shimmer`, `spz-spin`, `spz-pulse`, `spz-fade-up`, `spz-pop`, `spz-dot`, `spz-ring-fill`, `spz-confetti`
- No Framer Motion, no external animation libraries

---

## Component API Reference (from design-reference/src/components.jsx)

All components live in `components/ui/`. Match props exactly:

| Component | Key Props |
|-----------|-----------|
| `Btn` | `variant`: primary\|secondary\|ghost\|outline\|danger; `size`: sm\|md\|lg; `full`, `icon`, `iconRight`, `disabled` |
| `TierPill` | `tier`: TierKey; `size`: sm\|md; `showDot` |
| `SubjectChip` | `subject`: SubjectKey; `size`: sm\|md; `filled` |
| `Ring` | `tier`, `size`, `stroke`, `children`, `animate` — NO numbers inside for students |
| `Card` | `pad`, `onClick`, `glow`, `accent` |
| `SessionCard` | `concept`, `subject`, `status`: UPCOMING\|IN_PROGRESS\|COMPLETED; `mastery`, `onClick`, `cta` |
| `EmptyState` | `icon`, `title`, `body`, `action`, `onAction` |
| `Skel` | `w`, `h`, `r` — shimmer skeleton |
| `ErrorState` | `title`, `body`, `onRetry` |
| `Bar` | `value`, `max`, `color`, `h`, `track` |
| `Avatar` | `letter`, `hue`, `size`, `ring` |
| `BottomNav` | `active`: home\|path\|tutor\|tests\|progress; `onChange` |
| `AppHeader` | `title`, `sub`, `back`, `onBack`, `right`, `large` |
| `Segmented` | `options`, `value`, `onChange`, `full` |

---

## Screen Inventory

### Student Screens (map from design-reference)

| Screen | Design File | Route | Scenario States |
|--------|-------------|-------|-----------------|
| S1 Onboarding | student-onboarding.jsx | /student/onboarding | default, consent (DPDP minor gate) |
| S2 Diagnostic | student-diagnostic.jsx | /student/diagnostic | default, error |
| S3 Dashboard | student-dashboard.jsx | /student/dashboard | default, premium, crunch, freemium, loading, error |
| S4 Learning Session | student-lesson.jsx | /session/[topicId] | default, question, no-content, loading |
| S4 Vidya Chat | student-tutor.jsx | /student/tutor | default, loading, complete |
| S5 Learning Path | student-learn.jsx | /student/path | default, empty, loading |
| S6 Progress | (in app.jsx) | /student/progress | default, empty, loading |
| S7 Revisions | (in app.jsx) | /student/revise | default, empty |
| S8 Tests | student-tests.jsx | /student/tests | default, running, results, loading |
| S9 Upgrade | student-upgrade.jsx | /student/upgrade | default, locked, success |

### Parent Screens

| Screen | Design File | Route | Scenario States |
|--------|-------------|-------|-----------------|
| P1 Dashboard | parent-core.jsx | /parent/dashboard | default, empty, loading |
| P2 Progress | parent-core.jsx | /parent/progress | default, empty |
| P3 Schedule | parent-core.jsx | /parent/schedule | default |
| P4 Payments | parent-billing.jsx | /parent/payments | default, emi-failed |
| P5 Profile/Settings | parent-core.jsx | /parent/profile | default |

### Auth Screens

| Screen | Design File | Route |
|--------|-------------|-------|
| Student Login | auth.jsx | /login/student |
| Parent Login | auth.jsx | /login/parent |

---

## Key Existing File Locations

```
lib/constants/readiness.ts        ← getReadinessTier(), 5-tier scale — USE THIS
lib/constants/freemium.ts         ← FREE_TIER_SESSION_LIMIT, FREE_TIER_CHAPTER_TEST_LIMIT — USE THIS
lib/features/rollout.ts           ← Vidya rollout hash check — USE THIS
lib/freemium.ts                   ← freemium gate logic
app/(student)/student/onboarding/page.tsx  ← canonical onboarding (now in OLD_student after archive)
components/student/session/AITutorSessionShell/  ← session shell components
```

---

## Coding Standards

1. **TypeScript strict** — zero `any`, zero `@ts-ignore`
2. **Token-only styling** — every color/shadow/radius uses CSS vars
3. **No inline styles** except unavoidable dynamic CSS-var values (e.g., dynamic hue on Avatar)
4. **No imports from OLD_student/ or OLD_parent/** — ever
5. **No hardcoded freemium limits** — always from `lib/constants/freemium.ts`
6. **No hardcoded tier labels or colors** — always from `lib/constants/tiers.ts`
7. **No external animation libs** — tokens.css keyframes only
8. **Each screen = Client Component** (`'use client'`) with server component parent for data fetching
9. All screens must implement: loading state, empty state, error state (with retry)
10. After each major task: `pnpm tsc --noEmit` must pass before proceeding

---

## Known Issues — Do NOT Fix in This Rewrite

These are tracked separately and must not be touched:

- `ParentDashboardClient.tsx` V1 (986 lines) — will be deleted when OLD_parent move is confirmed
- `ExamReadinessSection` still uses `ReadinessTag` alias — cosmetic, TSC passes, fix deferred
- 28 email call sites not using `sendEmailUnified` — separate email-consolidation workstream
- Rooms feature — descoped from this release
- Referral UI — suppressed until Task 28

---

## Execution Order for Claude Code

```
TASK 0  → Copy design assets to design-reference/
TASK 1  → Install + wire fonts (Plus Jakarta Sans, JetBrains Mono)
TASK 2  → Wire tokens.css into globals.css
TASK 3  → Extend tailwind.config.ts with CSS var references
TASK 4  → Build components/ui/ library (16 components + barrel export)
TASK 5  → Build components/ui/Icons.tsx (full icon set)
TASK 6  → Create lib/constants/tiers.ts + lib/constants/subjects.ts
          → pnpm build must pass here before proceeding
TASK 7  → Implement student screens S1–S9 (in order)
TASK 8  → Implement parent screens P1–P5 (in order)
TASK 9  → Dark mode (ThemeContext, localStorage persistence, html[data-theme])
TASK 10 → Auth screens (UI only, wire to existing NextAuth)
```

After Tasks 0–6: `pnpm build` must pass cleanly.
After each screen task: `pnpm tsc --noEmit` must pass.
Report after each task: files created, line count, deviations if any.

---

## Pre-flight Checklist Before Starting

- [ ] OLD_student/ and OLD_parent/ folders exist (archive complete)
- [ ] design-reference/ folder exists with all 44 files from zip
- [ ] pnpm build passes on current codebase (admin/auth routes only active)
- [ ] No imports of app/(student) or app/(parent) exist in lib/ or components/

---

*Document version: 2026-05-31. Authoritative for this rewrite cycle.*
