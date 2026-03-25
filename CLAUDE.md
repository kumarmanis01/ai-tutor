# Spinzy AI Tutor — Claude Code Instructions
# Read this file fully before starting any task.
# Last updated: 2026-03-15

---

## PROJECT CONTEXT

AI-powered home tutoring platform for Indian students (CBSE/ICSE Grades 6–12).
AI tutor persona: Vidya. Price point: ₹99/month.
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

2. **Prisma is locked to v6.19.1.**
   Never upgrade to v7. If drift occurs:
   npm install prisma@6.19.1 @prisma/client@6.19.1 --save-exact

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
