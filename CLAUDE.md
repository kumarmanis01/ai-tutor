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

## Middleware

The Next.js middleware for this project lives in **`proxy.ts`** (NOT `middleware.ts`).
This is the single, canonical middleware file. Do not create `middleware.ts` -- Next.js
will pick up both files if both exist, causing double-execution bugs.

`proxy.ts` responsibilities:
- JWT token extraction and session validation via `getToken()` from `next-auth/jwt`
- Route protection (auth guards per role: admin, parent, student)
- `accountStatus` guard: redirects users with `accountStatus !== 'active'` to their
  respective onboarding routes -- `/student/onboarding` for students,
  `/parent/onboarding` for parents
- **IMPORTANT**: The `accountStatus` guard is BYPASSED for users who already carry
  `role='parent'` in their JWT on `/parent/*` routes. Parents activate via a different
  flow (set-role API + child linking) and the `accountStatus` field is not a reliable
  signal for parent readiness (the JWT cookie lags the DB write by one request cycle).
- Sets `x-pathname` header so server components can read the current path

When adding new route protection logic, always edit `proxy.ts`. Never create or
reference `middleware.ts`.

---

## Tech Stack

### Runtime & Framework
- Next.js 14+ (App Router) -- TypeScript
- Node.js backend via Next.js API routes

### Auth
- NextAuth.js -- JWT strategy (not database sessions)
- Session shape: `{ user: { id, email, role, accountStatus } }`
- Role values: `'user' | 'student' | 'parent' | 'admin'`
- `accountStatus` values: `'pending_onboarding' | 'active' | 'suspended'`
- Session is updated via `updateSession()` (client) which calls `/api/auth/session`
  and issues a new Set-Cookie. This is async and can lag behind DB state -- do not
  assume the JWT reflects DB state immediately after a write.

### Database
- PostgreSQL (Neon serverless) via Prisma ORM
- Prisma client: imported from `lib/prisma` (singleton -- do not reinstantiate)
- Neon query latency is typically 1.5--2.8 s in production. Never put sequential
  Prisma awaits where `Promise.all` would work. Never put Prisma calls in middleware.

### Cache / Queue
- Redis -- used for: session cache (5-min TTL keyed by `session:user:<email>`),
  OTP storage, rate limiting, BullMQ job queues
- Any API route that writes `role`, `accountStatus`, `grade`, `board`, `language`,
  or `subjects` MUST call `invalidateUserSessionCache(email)` after the DB write.

### Frontend
- React 18 + TypeScript
- Tailwind CSS -- utility-first, no CSS modules
- Design system primitives in `components/UI/design-system/` (see DESIGN SYSTEM section)

### Key Conventions
- API routes live in `app/api/`
- Route groups: `(parent-entry)`, `(student)`, `(parent)`, `(public)`, `(admin)`
  -- each has its own root `layout.tsx` exporting `<html>` and `<body>`
- Server components are the default; mark `'use client'` only when necessary
- All Prisma calls must be awaited -- never fire-and-forget
- Error responses: always return `NextResponse.json({ error: string }, { status: N })`
  -- never let an API route fall through without a return statement

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

## PROTECTED CONTRACTS — NEVER BREAK THESE

These are the integration paths that must work end-to-end at all times.
Before marking ANY task complete, verify each contract that your change touches.
If you cannot verify it, say so explicitly — do not silently skip.

### CONTRACT 1: LLM calls only reach OpenAI from the worker process
- `callLLM()` in lib/callLLM.ts must never be called from an API route, server action, or UI component
- The worker PM2 process (content-engine-worker) must have `ALLOW_LLM_CALLS=1` in its env_production block in ecosystem.config.cjs
- VERIFY: grep -n "ALLOW_LLM_CALLS" ecosystem.config.cjs — must appear in content-engine-worker block

### CONTRACT 2: HydrationJob state machine is not left in a broken state
- Every code path in syllabusWorker, notesWorker, questionsWorker must either:
  (a) complete successfully and set status=COMPLETED, OR
  (b) catch all errors and set status=FAILED with a non-null lastError
- A job must NEVER be left in status=RUNNING after the worker function returns
- VERIFY: read the worker file you touched and trace every early-return and catch block

### CONTRACT 3: Language validator threshold is not tightened below 0.35
- lib/content/language-validator.ts default threshold must be >= 0.35
- Rationale: valid Hindi/Marathi/Gujarati LLM output contains English proper nouns (NCERT, CBSE, board names)
- VERIFY: grep "threshold = 0" lib/content/language-validator.ts

### CONTRACT 4: ecosystem.config.cjs worker env_production is complete
- content-engine-worker env_production must have ALL of: DATABASE_URL, REDIS_URL, OPENAI_API_KEY, LLM_MODE, ALLOW_LLM_CALLS
- VERIFY: after any change to ecosystem.config.cjs, grep each of these keys and confirm they appear in the content-engine-worker block

### CONTRACT 5: SystemSetting pauses are not left enabled
- If any code path sets AI_PAUSED or HYDRATION_PAUSED to a truthy value for debugging, it must be reset before the task is closed
- VERIFY: SELECT key, value FROM "SystemSetting" WHERE key IN ('AI_PAUSED', 'HYDRATION_PAUSED')

### CONTRACT 6: Type-check passes after every change
- npm run type-check must exit 0 before any task is considered done
- VERIFY: run it, paste the output, do not skip

---
## SCOPE DISCIPLINE — STOP BREAKING WORKING CODE

### The Prime Directive
If a file is not directly required by the current task, do not touch it.
"Improving" working code during an unrelated task is how bugs are introduced.

### Rules
1. **Read the task description literally.** If the task says "fix the language validator threshold", touch ONLY lib/content/language-validator.ts and its test. Do not refactor callLLM.ts because you noticed something while reading it.

2. **Never modify ecosystem.config.cjs unless the task explicitly says to.** This file controls production process management. A wrong character here takes down the entire VPS.

3. **Never change a function signature that is called in more than 3 places** without explicit instruction. Trace all call sites first. List them in your response before making the change.

4. **Never change threshold values, timeouts, retry counts, or feature flags** without explicit instruction. These are tuned for production. Changing them "to be safe" breaks things.

5. **When fixing a bug, change the minimum possible code.** One bug = one fix = one commit. Do not bundle unrelated improvements.

6. **If you see something broken while working on an unrelated task**, note it in your response as: "OBSERVED BUT NOT FIXED: [description]". Do not fix it unless instructed. Add it to aider_tasks.md instead.

### Before touching any file, ask yourself:
- Is this file in the task description? If no → do not touch it.
- Will changing this break any PROTECTED CONTRACT? If yes → stop and ask.
- Am I changing this because it's required, or because it looks improvable? If the latter → do not touch it.

---

### MANDATORY TASK COMPLETION CHECKLIST
Every task must end with this block in your response:

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

## Known Architectural Decisions / Gotchas

### JWT cookie lags DB writes
After any write that changes `role` or `accountStatus` in the DB, the JWT cookie is
NOT automatically updated. The client must call `updateSession()` (`useSession` hook)
or the user must trigger a full session refresh. Always account for this lag in
middleware and layout guards -- read from the JWT for routing decisions, not from a
fresh DB query, unless you are in a server component that can afford the latency.

### updateSession() can hang
`updateSession()` from `next-auth/react` makes a network call to `/api/auth/session`.
On Neon it involves 1--2 DB round-trips and can take 3--6 s or time out silently.
Always wrap it in a `Promise.race` with a timeout (5--6 s) and log failures with
`logger.warn`. Do not gate critical navigation on `updateSession()` completing
successfully -- the middleware and layout guards must be resilient to a stale JWT.

### proxy.ts is middleware -- not middleware.ts
The file is `proxy.ts`. If you create `middleware.ts` you will have two active
middlewares. Next.js only supports one. The existing one will be shadowed
unpredictably. Always edit `proxy.ts` for route guard changes.

### accountStatus guard does not apply to parent-role users on /parent/*
Once the JWT carries `role='parent'`, `proxy.ts` bypasses the `accountStatus` check
for all `/parent/*` routes. The `set-role` API sets `accountStatus='active'` in the
DB, but the cookie lags. The bypass prevents a redirect loop while the cookie catches
up. Do not remove this bypass without also fixing the cookie lag at source.

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

## Pre-commit Checklist (automated via husky)
Every commit automatically runs:
1. python3 scripts/fix-smart-quotes.py  (auto-fixes, re-stages)
2. npx tsc --noEmit --project tsconfig.json  (type check)

## Deploy Pre-flight Checklist (deploy-and-run.sh)
1. Required env vars present
2. Smart quote verification (auto-fixes if any slipped through)
3. TypeScript clean
4. npm run build
5. pm2 restart

## Rules for Claude Code sessions
Before ending ANY session:
1. Run: python3 scripts/fix-smart-quotes.py
2. Run: npx tsc --noEmit --project tsconfig.json
3. Only then: git add -A && git commit

This must be the LAST step of every task, not optional.

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

Before closing any task, run: npm run verify:contracts. Do not mark a task done if this fails.
