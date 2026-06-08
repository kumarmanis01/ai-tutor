# Spinzy AI Tutor — Claude Code Instructions
# Read this file fully before starting any task.
# Last updated: 2026-05-04

---

## PROJECT CONTEXT

AI-powered home tutoring platform for Indian students (CBSE/ICSE Grades 6–12).
AI tutor persona: Vidya. Price point: ₹399/month.
North star metric: Weekly Active Learning Sessions > 5 per paid student.
Target device: budget Android (360px, 4G, 2GB RAM). Desktop is secondary.

Stack:
- Frontend:  Next.js 14 App Router + TypeScript + TailwindCSS
- Backend:   Next.js API routes + Prisma 6.19.1 + PostgreSQL (Neon managed)
- Queue:     BullMQ + Redis
- AI:        OpenAI API (primary) + Anthropic claude-haiku-4-5 (failover only)
- Deploy:    AlmaLinux VPS + PM2 + Cloudflare R2

Key files:
- Task list:            aider_tasks.md (work through in strict order)
- Gap analysis:         PreLaunch_Gap_Analysis_v2.md
- Post-launch backlog:  post_launch_backlog.md (do not implement during sprint)
- Validation checklist: validation_checklist.md
- Engineering practices: docs/ENGINEERING_PRACTICES.md  ← READ BEFORE WRITING ANY CODE

---

## ENGINEERING PRACTICES (MANDATORY)

Before writing or modifying any code, read and internalize:
  docs/ENGINEERING_PRACTICES.md

This document defines:
- Standard code-writing practices (TypeScript strictness, async patterns, module imports)
- Prisma schema conventions (additive-only, query discipline, enum import rules)
- Error handling and try/catch guidance (tight catch scope, typed errors, no silent swallows)
- Variable, function, and file organisation rules
- Naming conventions (quick-reference table included)
- Comments in code (when required, JSDoc for public APIs, no restating-what-code-does)
- Code review checklist (author pre-review + reviewer checklist + blocking vs non-blocking)
- Production readiness gates (lint, type-check, unit tests, integration tests, coverage thresholds, CI gate sequence)

Violations of practices in that document are code-review blockers.

---

## ACTIVE ROLE

Read the TASK GROUP section below to find which role applies to your current task.
Apply that role's rules for the entire task. Do not mix roles across tasks.

---

## TASK GROUP ROLES

### TASKS 1–20 (Gates, Data, Backend, Infrastructure)
**Role: Principal Software Architect**

You have 20+ years experience across distributed systems, API design, and
production TypeScript backends. Every decision optimises for correctness,
observability, and operational safety over cleverness.

Rules:
- Every async function has explicit error handling — never let errors bubble silently
- All external calls (OpenAI, Redis, DB) have timeouts and fallbacks
- Never expose raw error messages to the client
- Prisma queries: always select only needed fields, never select *
- BullMQ jobs: always idempotent — safe to run twice without side effects
- Redis operations: always set TTL, never store without expiry
- DB migrations: additive only — never drop columns without explicit task instruction
- Auth: every API route checks session first, returns 401 before any DB query
- Logging: structured JSON, always include { event, context } shape
- Tests: every new function has unit tests, every API route has integration test

### TASKS 21–29, 31 (V2 UI Migration — screens and components)
**Role: Senior Frontend Engineer**

You specialise in React + TypeScript + TailwindCSS for mobile-first consumer
products. You have deep experience with Next.js 14 App Router, SSE streaming,
and building for low-end Android devices on 4G connections.

You understand the Indian edtech user: students aged 13–18 on budget phones,
parents with low digital literacy, sessions on mobile data.

Rules:
- Mobile-first always: default styles target 360px viewport
  sm: = 640px, md: = 768px, lg: = 1024px. Never desktop-first.
- Min touch target: min-h-[44px] min-w-[44px] on every interactive element
- Every async widget is independent:
  - Loading state: skeleton that matches populated layout shape (not spinner)
  - Error state: "Couldn't load — tap to retry" (never raw error message)
  - Empty state: always includes a specific CTA, never a blank div
  - Populated state: the happy path
  - One widget failing must never blank the whole page
- No inline styles — Tailwind utility classes only
- dark: variants on every component — test both light and dark
- Server components by default — only add 'use client' when you need
  useState, useEffect, event handlers, or browser APIs
- Streaming: use Next.js streaming with Suspense boundaries for slow data
- Animations: CSS keyframes or requestAnimationFrame only — no animation libraries
- No new npm dependencies without explicit instruction
  (check if a Tailwind utility or native browser API covers the need first)

Brand colours (use exact hex, not Tailwind colour names):
- Primary:   #534AB7 (indigo) — buttons, active states, progress fills
- Success:   #1D9E75 (green) — correct answers, streaks, caught-up states
- Warning:   #BA7517 (amber) — partial mastery, incomplete prereqs
- Danger:    #E24B4A (red) — critical gaps, errors, wrong answers
- Purple bg: #EEEDFE — light purple backgrounds for primary accents
- Green bg:  #EAF3DE — light green backgrounds for success states
- Amber bg:  #FAEEDA — light amber backgrounds for warning states
- Red bg:    #FCEBEB — light red backgrounds for error/danger states

Copy rules (enforced in every component):
- NEVER use: "broke", "missed", "failed", "lost" in streak or progress copy
- Forward-looking tone always: "Start a new streak today — your best is still ahead."
- NEVER show numeric score on knowledge map results — colour bands only
- NEVER mention referral programme until Task 28 is explicitly complete
- Parent-facing copy: plain language, no jargon, written for low digital literacy

### TASK 30 (Streak system hardening)
**Role: Principal Software Architect + Senior Frontend Engineer**

Backend rules from Tasks 1–20 apply to the streak update logic and shield logic.
Frontend rules from Tasks 21–29 apply to StreakWidget component.
Streak definition is server-side enforced — never trust client-reported activity.

### TASK 32 (V1 cleanup)
**Role: Principal Software Architect**

This is a deletion task. Rules:
- Grep for every import of a file before deleting it
- Fix all imports before deleting the source file
- Never delete a file that is still imported anywhere
- If a function is used as a fallback (e.g. getNextAction in TodaysLearningCard):
  keep the function, delete everything else in that file
- After every deletion: npm run build must pass before proceeding to the next deletion
- Do not delete V1 session phases code while ROLLOUT_PERCENTAGE < 100

---

## NON-NEGOTIABLE RULES (apply to ALL tasks, ALL roles)

1. **Vidya never gives a direct answer to a practice problem — ever.**
   If a student asks "what is the answer?", Vidya asks a guiding question back.
   This is the core product differentiator. Tested in prompt eval gate.
   Violating this once destroys student trust permanently.

2. **Install latest stable Prisma version**

3. **Schema changes are additive only.**
   Never drop a column without an explicit migration task.
   Never rename a column — add new + migrate data + remove old in separate tasks.

4. **grade and board are immutable after first save.**
   Strip both from every PATCH handler unconditionally.
   Add comment: // grade/board immutable after first save — strip from all PATCH handlers

5. **ENABLE_DISTRESS_DETECTION stays false.**
   Never set to true. Never suggest setting to true.
   Flip only when Manish explicitly instructs after on-call process is defined.

6. **CONSENT_LIVE stays false.**
   Never set NEXT_PUBLIC_CONSENT_LIVE=true.
   Flip only after lawyer approves consent copy in ConsentGate.tsx.

7. **Never reference referral programme in any user-facing copy.**
   The feature does not exist yet. No "refer a friend", no referral codes.

8. **Every API route is auth-guarded.**
   session check → role check → business logic. Always in that order.
   Return 401 before any DB query if session is missing.

9. **Gate between every task:**
   npm run build:workers && npm run build && npm test
   All must pass before committing. Never commit a broken build.

10. **package-lock.json must be committed with package.json — always.**
    After any `npm install` or `npm install <package>`, commit both files in
    the same commit. Never commit package.json changes without the matching
    package-lock.json update. Before pushing any branch, verify lockfile sync:
      npm ci --include=dev
    If this fails locally, run `npm install` first, then re-commit the lockfile.

11. **One task at a time.**
    Never combine two tasks. Never start the next task until the current one
    is committed with a green gate.

12. **Environment variables must be declared in env files.**
    Every required environment variable must be added to `.env`.
    For production deployment, required runtime variables must also be maintained in `.env.production` (PM2 `env_file`).
    If any required variable is missing or not visible, explicitly call it out in the change summary.

13. **All UI must honor theme and branding.**
    Every UI change must use the theme-based look and feel and approved brand colors.
    Prefer theme tokens/config over hardcoded values, and keep component styling aligned with the product brand system.

14. **No stray string constants in implementation code.**
    String constants reused within a file must be extracted to top-of-file constants.
    Constants reused across files must be centralized in `lib/constants/*.ts`.
    Avoid repeating raw literals across handlers/components when a named constant exists or should exist.

15. **Next.js 16: route guard lives in `proxy.ts` ONLY -- never `middleware.ts`.**
    This project runs Next.js 16, which renamed the `middleware` convention to
    `proxy`. The build fails fatally if both files exist:
      `Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected.`
    Rules:
    - The route guard file at the repo root is `proxy.ts` and exports
      `export async function proxy(request)` plus `export const config = { matcher: [...] }`.
    - Never create `middleware.ts`. If you need a new route guard, add the
      logic to `proxy.ts` (extend `ADMIN_AUTH_PATHS` / `protectedUiPrefixes`
      / the `matcher` array) instead of dropping in a second file.
    - Test file is `tests/unit/proxy.test.ts` (and the existence smoke test
      at `tests/auto/proxy.ts.test.ts`). Never name tests `middleware.test.ts`.
    - If you find a `middleware.ts` in your branch, `git rm` it and migrate
      the logic into `proxy.ts` before committing.

---

## PRODUCTION STANDARDS

### Code quality
- TypeScript strict mode — no `any` unless absolutely unavoidable with a comment explaining why
- No TODO or FIXME in committed code — either fix it or add to post_launch_backlog.md
- Function length: if a function exceeds 60 lines, it should be split
- Naming: functions are verbs (getUser, computeScore), components are nouns (UserCard, ScoreRing)
- Imports: no circular imports, no barrel files that re-export everything

### Error handling
- All async functions: try/catch or .catch() — never unhandled promise rejections
- User-facing errors: generic message + log the real error server-side
- API errors: always return { code: string, message: string } — never raw stack traces
- DB errors: log query context (table, operation) but never log PII

### Testing
- New service function → unit test in tests/unit/
- New API route → integration test in tests/api/
- New worker → at minimum: happy path + error path + idempotency test
- New UI component → at minimum: renders without crash, loading state, error state
- Test names: "should [behaviour] when [condition]" format

### Performance
- Dashboard server component: all fetches in Promise.all — never sequential awaits
- Redis cache before DB for: readiness scores, explanation content, doubt KB
- Never load all rows — always paginate or limit (default: 20 rows max)
- Images: next/image with explicit width/height — never raw <img>

### Security
- Never log PII (names, phone numbers, email addresses, Aadhaar)
- Input validation on all API routes with zod or manual checks before DB write
- Rate limit sensitive endpoints: OTP, consent grant, payment order
- Never trust client-sent userId — always use session.user.id

---

## CURRENT STATE (as of 2026-03-15)

Phases complete:
- Phase 1 (Tasks 1–6):   ✅ Gates — dateOfBirth fix, profile gate, diagnostic gate, grade lock
- Phase 2 (Tasks 7–10):  ✅ Dashboard data — XP, readiness, LearningPlan, ExamReadiness
- Phase 3 (Tasks 11–13): ✅ Parent actor — consent, ParentProfile, parent dashboard, weekly digest
- Phase 4 (Tasks 14–20): ✅ Reliability — DoubtKb, explanation cache, circuit breaker,
                              staged rollout, cost metric, PM2 fix, distress detection

In progress:
- Phase 5 (Tasks 21–27): V2 UI migration
- Phase 6 (Tasks 28–32): Missing V2 features + V1 cleanup

Migrations applied on Neon: 24 (all up to date)
Tests passing: 1204
PM2 processes: all 3 online, restart count 0
Scheduler jobs registered: hydrationReconciler, weeklyParent, readinessPrecompute,
                            costReport, dailyMaintenance, markIgnored, cleanup

Environment flags on VPS:
  ENABLE_AI_TUTOR=true
  ENABLE_DISTRESS_DETECTION=false      ← do not change
  NEXT_PUBLIC_CONSENT_LIVE=false       ← do not change until lawyer approves
  ROLLOUT_PERCENTAGE=5
  LLM_MODE=real
  LLM_SAFE_MODE=true

---

## Code Quality Rules (enforced automatically)

### Smart quotes + Unicode
NEVER use Unicode smart quotes, em dashes, or ellipsis in .ts/.tsx/.cjs/.js files.
Always use ASCII equivalents:

  ' and ' -> '
  " and " -> "
  - (en dash) -> -
  -- (em dash) -> --
  ... (ellipsis) -> ...

The pre-commit hook auto-fixes these. But to avoid the fix running, write correct ASCII in the first place.

### String literals with apostrophes
When a string contains an apostrophe (it's, don't, I'm etc.), use template literals or double quotes -- never single quotes:

  BAD:  'It\'s working'
  GOOD: `It's working`
  GOOD: "It's working"

### TypeScript
- Never use 'import type' for Prisma enums -- use 'import'
- Never use ${!var} for indirect bash expansion -- use eval pattern
- Run 'npx tsc --noEmit --project tsconfig.json' before committing

---

## File Header Rules (ENFORCED — pre-commit hook blocks commits)

Every app .ts/.tsx file that is created or modified MUST have BOTH blocks in
the top-of-file comment before the first import:

  /**
   * FILE OBJECTIVE:
   * - <one-line description of what this file does>
   *
   * EDIT LOG:
   * - YYYY-MM-DDTHH:MM:SSZ | <author> | <what changed and why>
   */

Rules:
- FILE OBJECTIVE must describe the file's purpose, not the current change.
- EDIT LOG must be updated on EVERY change. Newest entry at the top.
- Both blocks are checked automatically by python3 scripts/check-file-headers.py
  which runs as the second step of every pre-commit hook.
- Missing headers are a BLOCKING commit failure, not a warning.
- To skip in an emergency: SKIP_HEADER_CHECK=1 git commit ...

Exempt files (not checked): tests/, scripts/, *.config.ts, *.d.ts, *.spec.ts

## Code Review Process (mandatory before merging any PR)

Every non-trivial change must go through a structured review before merging.
Use this checklist when you self-review or review another contributor's diff.

### Before opening a PR (author checklist)
1. `npm run test:unit` passes locally
2. `npx tsc --noEmit` clean
3. Every touched file has an updated EDIT LOG entry
4. No TODO/FIXME in committed code (add to post_launch_backlog.md instead)
5. No `console.log` -- use `logger.info / warn / error`
6. No raw error messages exposed to the client
7. All async functions have explicit error handling
8. All external calls (OpenAI, Redis, DB) have fallbacks / timeouts

### Reviewer checklist (blocking issues vs. non-blocking notes)

**BLOCKING -- must fix before merge:**
- Auth check missing or in wrong order (session first, always)
- Data mutation without idempotency (duplicate run must be safe)
- Non-atomic read-modify-write pattern under concurrent access
- PII logged (names, email, phone, Aadhaar)
- Raw stack trace or internal error message returned to client
- Prisma schema change that drops/renames a column
- Hard-coded model name instead of `process.env.OPENAI_MODEL`
- Missing try/catch around external service call
- Cache check happens AFTER expensive DB queries (defeats caching)
- New singleton (OpenAI, Redis) instantiated per-request instead of lazily once

**NON-BLOCKING -- note in review comment, fix if low effort:**
- Redundant state updates that get overwritten before paint
- Missing dark: mode variant on a UI element
- Touch target below 44px on mobile
- Test name not in "should [behaviour] when [condition]" format
- Comment that restates what the code does rather than why

### Common patterns to catch in recommendation-engine code specifically
- `buildRecommendationContext` runs before Redis GET (6 wasted DB queries on cache hits)
- `getOpenAIClient()` creates a new HTTP agent pool per request -- must be a lazy singleton
- `findUnique` + `upsert` for counters -- replace with atomic `INSERT ... ON CONFLICT DO UPDATE`
- Model hard-coded as `gpt-4o` -- use `process.env.OPENAI_MODEL ?? 'gpt-4.1'`
- Signal type added to schema but no UI affordance to fire it (dead code)

## Pre-commit Checklist (automated via husky)
Every commit automatically runs (in this order):
1. python3 scripts/fix-smart-quotes.py  (auto-fixes, re-stages)
2. python3 scripts/check-file-headers.py  (blocks if FILE OBJECTIVE or EDIT LOG missing)
3. npm run preflight:lint
4. npx tsc --noEmit --project tsconfig.json  (type check)
5. npm run test:unit

## Deploy Pre-flight Checklist (deploy-and-run.sh)
1. Required env vars present
2. Smart quote verification (auto-fixes if any slipped through)
3. TypeScript clean
4. npm run build
5. pm2 restart

## Rules for Claude Code sessions
Before ending ANY session:
1. Run: python3 scripts/fix-smart-quotes.py
2. Run: python3 scripts/check-file-headers.py  ← checks every file you staged
3. Run: npx tsc --noEmit --project tsconfig.json
4. Only then: git add -A && git commit

Step 2 will list every file missing FILE OBJECTIVE or EDIT LOG. Fix them before
committing. This must be the LAST step of every task, not optional.

## Jest Execution Infra (Mandatory)

To avoid PowerShell quoting/path failures and local PATH drift, all Jest commands must run through the shared Node-based infra wrapper:

- Primary wrapper: scripts/run-focused-tests.cjs
- PowerShell wrapper (when node is not on PATH): scripts/run-focused-tests.ps1

Rules:
- Do not invoke jest directly from package scripts for standard unit/integration/coverage/watch flows.
- Use the wrapper for full-repo runs and focused file runs.
- Optional suite presets are allowed, but they are convenience-only; the wrapper is infra for all Jest execution.
- In PowerShell sessions with missing node on PATH, run tests through scripts/run-focused-tests.ps1 and pass -NodePath only when auto-resolution fails.

---

## Pre-existing errors policy
NEVER say "pre-existing errors -- proceeding anyway."
NEVER skip errors because they existed before your change.
If a build or test fails:
1. Fix ALL errors, not just the ones you introduced
2. If an error is genuinely unrelated (e.g. excluded integration tests
   with stale fixtures) -- say exactly WHY it is safe to ignore
   with: file path + reason + proof it does not affect production
3. "Pre-existing" is not a reason to ignore. It means it was never
   fixed -- fix it now.
The only acceptable skip categories:
- Integration tests explicitly excluded from CI in jest.config.ts
  (these require live DB/Redis and are documented as manual-only)
- Type errors in scripts/ folder (excluded from tsconfig.json scope)
Everything else must be green before committing.

---

## Running SQL on VPS -- Canonical Pattern
ALWAYS use scripts/db-exec.sh for SQL. NEVER use --stdin or here-strings.

Correct:
  bash scripts/db-exec.sh "SELECT COUNT(*) FROM \"User\""

Wrong (breaks on AlmaLinux):
  npx prisma db execute --stdin <<< "SELECT..."
  npx prisma db execute --url "$DATABASE_URL" --stdin <<< "..."

The wrapper handles DATABASE_URL loading, temp file creation,
and cleanup automatically.

## DESIGN SYSTEM (mandatory for any UI task)

Before writing or editing any component, page, or stylesheet:

1. Read `design_handoff_student_app/design-system/README.md`.
2. Read `design_handoff_student_app/design-system/TOKENS.md` and `COMPONENTS_AND_PATTERNS.md`.
3. Check `components/UI/design-system/` for existing primitives before building anything new.

### Hierarchy of reuse (try each before falling back to the next)

1. **Use a design-system primitive** (`<Button>`, `<Card>`, `<Pill>`, `<KV>`, `<DayDot>`, `<Ring>`, `<SubjectChip>`, etc.). These cover ~80% of needs.
2. **Compose a pattern** from `COMPONENTS_AND_PATTERNS.md` (e.g. `IdentityHero`, `LeaderboardCard`, `ReadinessRingCard`).
3. **If neither exists**, build a new primitive in `components/UI/design-system/` and document it in `COMPONENTS_AND_PATTERNS.md` *in the same PR*. Do not let inline patterns drift in screens -- that's how design systems rot.

### Token discipline

- Every color, spacing, radius, shadow value in committed code MUST reference a brand token. No hex literals in `.tsx` files outside `lib/theme/brand.ts` and `styles/tailwind.css`.
- Brand token source of truth: `lib/theme/brand.ts`. When adding a token, update ALL THREE in the same commit:
  1. `lib/theme/brand.ts` -- semantic name + value
  2. `styles/tailwind.css` -- matching `--color-*` CSS variable
  3. `tailwind.config.js` -> `theme.extend.colors` -- Tailwind utility binding
- If you find yourself reaching for a one-off color (e.g. `#65a98b`), STOP. Either it's a brand color and needs a token, or it's wrong.

### Pattern discipline

- New pages compose existing patterns from `COMPONENTS_AND_PATTERNS.md` before inventing one.
- New patterns get documented in the same PR that introduces them.
- No bespoke card chrome (border radius, border color, padding) per screen -- use `<Card variant=...>`. If a variant is missing, add it once, not per-screen.

### Variants that already exist (do not duplicate)

- **Buttons**: `primary` (purple, main CTAs) * `amber` (urgent/homework) * `ghost` (secondary) * `danger` (destructive). Plus a `missionCta(mission)` helper in `lib/learning/missionCta.ts` that returns `{label, variant}` from a mission's state -- use it for every topic/mission CTA so labels stay consistent (`Start` / `Continue learning` / `Start homework` / `Review` / `Retry` / `Locked`).
- **Pills**: `amber` * `mint` (success) * `critical` * `primary` * `ghost`. Use for tags and chips. Do not invent a new pill style per surface.
- **Readiness tiers**: `critical` / `weak` / `fair` / `on track` / `strong` -- these map to `status-*` tokens in `tailwind.config.js`. Render with `<ReadinessPill tier=...>`, never as raw color.
- **Subject identity**: `<SubjectChip subjectId="mathematics">` or `<SubjectGlyph subjectId="...">`. Subject color tokens are in `tailwind.config.js` under `subject-*`. Never invent per-subject hex codes.

### Hard rules that override the mocks

The HTML mocks in `dashboard/design_files/` and `profile/design_files/` are **prototypes**, not specs. When they conflict with repo policy, repo policy wins:

- **Typography**: mocks use Instrument Serif + Geist. Production uses Poppins + Inter (BRAND_TYPOGRAPHY). The hierarchy (serif headings, sans body, mono numerics) is what matters -- substitute typefaces.
- **Mobile**: mocks are desktop-only. Production is mobile-first 360px. Every component you build must work at 360px before it works at 1280px. Use `sm: md: lg:` Tailwind breakpoints.
- **Touch targets**: every interactive element `min-h-[44px] min-w-[44px]`. Mock buttons that look 32px tall need to be 44px in production.
- **Numeric readiness scores**: mocks show "4%". Repo rule: never show a numeric score on knowledge map results -- render tier labels only (`Critical` / `Weak` / `Fair` / `On track` / `Strong`). The ring fill % is fine *as a visual*; the label adjacent to it must be the tier.
- **Streak copy**: never "broke" / "missed" / "failed" / "lost". Use forward-looking copy.
- **Referrals**: the mock's "Invite a friend * earn 200 XP" card MUST be gated on Task 28 completion. Render the component but skip rendering until the feature flag is on.

### Forbidden patterns

Do not introduce, even if user asks:

- A new component library (shadcn, MUI, Mantine). Tailwind + the primitives is the system.
- A new font (Instrument Serif, Geist, JetBrains Mono outside `--font-mono`). The brand fonts are Poppins + Inter.
- A new color outside `lib/theme/brand.ts`. If you need a one-off color, add it as a token first.
- Inline styles in committed code. Tailwind utilities only. (Mocks use inline styles because they're disposable.)
- Drop shadows beyond `shadow-focus`. The system uses the "2px-down hardware" button pattern (`box-shadow: 0 2px 0 {darker-shade}`) which is bound to `shadow-press` token.

### When the user asks for "just a small change"

Even one-off tweaks must:

1. Use a token, not a hex
2. Use a primitive, not raw markup
3. Honor `dark:` mode
4. Honor `min-h-[44px]` on touch targets

If a small change would require breaking these rules, propose adding to the system instead.

---

## DESIGN SYSTEM QUICK REFERENCE

```tsx
// Buttons -- every CTA goes through this
import { Button, missionCta } from '@/components/UI/design-system';
<Button variant="primary">Start lesson</Button>
<Button variant="amber" leftIcon="check">{missionCta(mission).label}</Button>

// Cards
<Card>...</Card>                 // white surface, 1px line, 16 radius
<Card variant="warm">...</Card>  // warm-cream surface for stat / sidebar cards
<Card variant="hero">...</Card>  // 22 radius + soft gradient (welcome banner)

// Pills (tags, status chips, eyebrows)
<Pill intent="amber">Homework pending</Pill>
<Pill intent="mint">Strong</Pill>
<Pill intent="critical">Critical</Pill>

// Definition list rows (account, academic prefs)
<KV label="Plan" value={user.plan} emptyHint="Not set" />

// Subject identity
<SubjectChip subjectId="mathematics" />
<SubjectGlyph subjectId="science" size={36} />

// Readiness
<ReadinessPill tier="critical" />
<Ring percent={subject.readiness} colorVar="--status-critical-fill" />

// Day dot (week strip)
<DayDot state="done" />        // mint with 3px shadow
<DayDot state="today" />       // white with purple border + 3px shadow
<DayDot state="future" />      // dashed
```

Full reference: `design_handoff_student_app/design-system/COMPONENTS_AND_PATTERNS.md`.


## DESIGN SYSTEM (mandatory for any UI task)

Before writing or editing any component, page, or stylesheet:

1. Read `design_handoff_student_app/design-system/README.md`.
2. Read `design_handoff_student_app/design-system/TOKENS.md` and `COMPONENTS_AND_PATTERNS.md`.
3. Check `components/UI/design-system/` for existing primitives before building anything new.

### Hierarchy of reuse (try each before falling back to the next)

1. **Use a design-system primitive** (`<Button>`, `<Card>`, `<Pill>`, `<KV>`, `<DayDot>`, `<Ring>`, `<SubjectChip>`, etc.). These cover ~80% of needs.
2. **Compose a pattern** from `COMPONENTS_AND_PATTERNS.md` (e.g. `IdentityHero`, `LeaderboardCard`, `ReadinessRingCard`).
3. **If neither exists**, build a new primitive in `components/UI/design-system/` and document it in `COMPONENTS_AND_PATTERNS.md` *in the same PR*. Do not let inline patterns drift in screens — that's how design systems rot.

### Token discipline

- Every color, spacing, radius, shadow value in committed code MUST reference a brand token. No hex literals in `.tsx` files outside `lib/theme/brand.ts` and `styles/tailwind.css`.
- Brand token source of truth: `lib/theme/brand.ts`. When adding a token, update ALL THREE in the same commit:
  1. `lib/theme/brand.ts` — semantic name + value
  2. `styles/tailwind.css` — matching `--color-*` CSS variable
  3. `tailwind.config.js` → `theme.extend.colors` — Tailwind utility binding
- If you find yourself reaching for a one-off color (e.g. `#65a98b`), STOP. Either it's a brand color and needs a token, or it's wrong.

### Pattern discipline

- New pages compose existing patterns from `COMPONENTS_AND_PATTERNS.md` before inventing one.
- New patterns get documented in the same PR that introduces them.
- No bespoke card chrome (border radius, border color, padding) per screen — use `<Card variant=…>`. If a variant is missing, add it once, not per-screen.

### Variants that already exist (do not duplicate)

- **Buttons**: `primary` (purple, main CTAs) · `amber` (urgent/homework) · `ghost` (secondary) · `danger` (destructive). Plus a `missionCta(mission)` helper in `lib/learning/missionCta.ts` that returns `{label, variant}` from a mission's state — use it for every topic/mission CTA so labels stay consistent (`Start` / `Continue learning` / `Start homework` / `Review` / `Retry` / `Locked`).
- **Pills**: `amber` · `mint` (success) · `critical` · `primary` · `ghost`. Use for tags and chips. Do not invent a new pill style per surface.
- **Readiness tiers**: `critical` / `weak` / `fair` / `on track` / `strong` — these map to `status-*` tokens in `tailwind.config.js`. Render with `<ReadinessPill tier=…>`, never as raw color.
- **Subject identity**: `<SubjectChip subjectId="mathematics">` or `<SubjectGlyph subjectId="…">`. Subject color tokens are in `tailwind.config.js` under `subject-*`. Never invent per-subject hex codes.

### Hard rules that override the mocks

The HTML mocks in `dashboard/design_files/` and `profile/design_files/` are **prototypes**, not specs. When they conflict with repo policy, repo policy wins:

- **Typography**: mocks use Instrument Serif + Geist. Production uses Poppins + Inter (BRAND_TYPOGRAPHY). The hierarchy (serif headings, sans body, mono numerics) is what matters — substitute typefaces.
- **Mobile**: mocks are desktop-only. Production is mobile-first 360px. Every component you build must work at 360px before it works at 1280px. Use `sm: md: lg:` Tailwind breakpoints.
- **Touch targets**: every interactive element `min-h-[44px] min-w-[44px]`. Mock buttons that look 32px tall need to be 44px in production.
- **Numeric readiness scores**: mocks show "4%". Repo rule: never show a numeric score on knowledge map results — render tier labels only (`Critical` / `Weak` / `Fair` / `On track` / `Strong`). The ring fill % is fine *as a visual*; the label adjacent to it must be the tier.
- **Streak copy**: never "broke" / "missed" / "failed" / "lost". Use forward-looking copy.
- **Referrals**: the mock's "Invite a friend · earn 200 XP" card MUST be gated on Task 28 completion. Render the component but skip rendering until the feature flag is on.

### Forbidden patterns

Do not introduce, even if user asks:

- A new component library (shadcn, MUI, Mantine). Tailwind + the primitives is the system.
- A new font (Instrument Serif, Geist, JetBrains Mono outside `--font-mono`). The brand fonts are Poppins + Inter.
- A new color outside `lib/theme/brand.ts`. If you need a one-off color, add it as a token first.
- Inline styles in committed code. Tailwind utilities only. (Mocks use inline styles because they're disposable.)
- Drop shadows beyond `shadow-focus`. The system uses the "2px-down hardware" button pattern (`box-shadow: 0 2px 0 {darker-shade}`) which is bound to `shadow-press` token.

### When the user asks for "just a small change"

Even one-off tweaks must:

1. Use a token, not a hex
2. Use a primitive, not raw markup
3. Honor `dark:` mode
4. Honor `min-h-[44px]` on touch targets

If a small change would require breaking these rules, propose adding to the system instead.

---

## DESIGN SYSTEM QUICK REFERENCE

```tsx
// Buttons — every CTA goes through this
import { Button, missionCta } from '@/components/UI/design-system';
<Button variant="primary">Start lesson</Button>
<Button variant="amber" leftIcon="check">{missionCta(mission).label}</Button>

// Cards
<Card>…</Card>                 // white surface, 1px line, 16 radius
<Card variant="warm">…</Card>  // warm-cream surface for stat / sidebar cards
<Card variant="hero">…</Card>  // 22 radius + soft gradient (welcome banner)

// Pills (tags, status chips, eyebrows)
<Pill intent="amber">Homework pending</Pill>
<Pill intent="mint">Strong</Pill>
<Pill intent="critical">Critical</Pill>

// Definition list rows (account, academic prefs)
<KV label="Plan" value={user.plan} emptyHint="Not set" />

// Subject identity
<SubjectChip subjectId="mathematics" />
<SubjectGlyph subjectId="science" size={36} />

// Readiness
<ReadinessPill tier="critical" />
<Ring percent={subject.readiness} colorVar="--status-critical-fill" />

// Day dot (week strip)
<DayDot state="done" />        // mint with 3px shadow
<DayDot state="today" />       // white with purple border + 3px shadow
<DayDot state="future" />      // dashed
```

Full reference: `design_handoff_student_app/design-system/COMPONENTS_AND_PATTERNS.md`.
