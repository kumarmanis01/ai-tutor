# Spinzy AI Tutor — Claude Code Implementation Tasks
# v2 Launch Sprint — 20 tasks in execution order
#
# HOW TO USE:
# 1. Open Claude Code in your repo root
# 2. Paste one task at a time — do NOT combine tasks
# 3. After each task: npm run build && npm test — must be green before next task
# 4. Commit after each passing task: git add -A && git commit -m "..."
# 5. Push to master when all tasks in a phase are green
#
# NEVER skip the build+test gate between tasks.
# If a task fails, paste the error back to Claude Code in the same session.

---

## PHASE 1 — UNBLOCK EVERY USER (do these first, in order)

---

### TASK 1 — Fix B1: Drop dateOfBirth, use integer age for parent gate

**Context:**
The `dateOfBirth` field on the `User` model is never collected anywhere in the UI.
Its null value causes `isUnder18(null)` to return `true`, which triggers the parent
gate for every single user regardless of their actual age. This is a showstopper
blocking 100% of signups.

**What to do:**
1. Run this grep first and show me all results before changing anything:
   ```
   grep -rn "dateOfBirth\|isUnder18\|requiresParentVerification" \
     lib/ app/ components/ prisma/schema.prisma \
     --include="*.ts" --include="*.tsx" --include="*.prisma" \
     | grep -v node_modules | grep -v .next
   ```

2. Create a new Prisma migration that:
   - Drops `dateOfBirth DateTime?` from the `User` model in `prisma/schema.prisma`
   - Migration name: `drop_date_of_birth_use_age_integer`
   - Run: `npx prisma migrate dev --name drop_date_of_birth_use_age_integer`

3. Replace every `isUnder18(user.dateOfBirth)` call with:
   ```typescript
   const requiredByAge = user.age !== null && user.age < 13
   ```

4. In `lib/student/accountStatus.ts`, update `requiresParentOTPGate`:
   - Remove all references to `dateOfBirth`
   - The check must be: `accountStatus === 'pending_parent_verification' && age !== null && age < 13`
   - If age is null (not yet collected) → return `false` (no gate — we don't gate on missing data)

5. Remove `dateOfBirth` from every Prisma `select` clause where it appears.

6. Remove `dateOfBirth` from any NextAuth session type, `lib/auth.ts` callbacks,
   and any API response shapes that include it.

**Acceptance criteria:**
- `npx prisma migrate status` shows migration applied
- `npm run build` passes with 0 errors
- `npm test` passes — no regressions
- A user with `age = 17` and `accountStatus = active` gets `requiresParentOTPGate = false`
- A user with `age = null` gets `requiresParentOTPGate = false`
- A user with `age = 10` and `accountStatus = pending_parent_verification` gets `requiresParentOTPGate = true`
- Report: every file changed + exact before/after for each change

---

### TASK 2 — Fix B2: Convert /student/verify-parent page to redirect

**Context:**
`/student/verify-parent` is a full-page route that conflicts with the mobile-first
bottom-sheet/overlay architecture. The `ParentOTPGate` overlay (already built in
`components/student/ParentOTPGate.tsx`) renders over the dashboard when
`requiresParentOTPGate = true`. The full page is redundant and causes UX loops.

**What to do:**
1. Open `app/(student)/verify-parent/page.tsx` (or wherever this route lives — find it first)

2. Replace the entire page content with a simple server redirect:
   ```typescript
   import { redirect } from 'next/navigation'
   export default function VerifyParentPage() {
     redirect('/dashboard')
   }
   ```

3. The `ParentOTPGate` overlay in `StudentLayoutShell` already handles the
   verification flow over the dashboard. No other changes needed.

**Acceptance criteria:**
- Navigating to `/student/verify-parent` redirects to `/dashboard`
- The `ParentOTPGate` overlay still appears on dashboard when `requiresParentOTPGate = true`
- `npm run build` passes

---

### TASK 3 — T29: Wire ProfileCompletionGate into student layout

**Context:**
`lib/student/profileGuard.ts` exists but `ProfileCompletionGate` is not wired
into `app/(student)/layout.tsx`. A student with no board/grade/subjects can
reach session routes. This must be blocked.

**What to do:**
1. First read these files completely:
   - `app/(student)/layout.tsx`
   - `lib/student/profileGuard.ts`
   - Any existing `ProfileCompletionGate` component (search `components/` for it)

2. In `lib/student/profileGuard.ts`, ensure `isProfileComplete(user)` returns `true`
   only when ALL of these are non-null/non-empty:
   - `user.board`
   - `user.grade`
   - `user.language`
   - `Array.isArray(user.subjects) && user.subjects.length > 0`

3. In `app/(student)/layout.tsx`:
   - After the existing `requiresParentOTPGate` check, add:
   ```typescript
   const profileComplete = isProfileComplete(studentProfile)
   ```
   - Pass `showProfileGate={!profileComplete}` to `StudentLayoutShell`

4. In `components/student/StudentLayoutShell.tsx`:
   - Accept `showProfileGate?: boolean` prop
   - If `showProfileGate` is true AND `showParentGate` is false:
     render `<ProfileCompletionGate />` overlay (z-index below parent gate)

5. `ProfileCompletionGate` component must:
   - Be full-screen overlay (not modal)
   - Show checklist: Board ✓/✗, Grade ✓/✗, Medium ✓/✗, Subjects ✓/✗
   - Progress bar: N of 4 complete
   - CTA: "Complete your profile" → navigates to `/profile/setup` or equivalent
   - No X button, no click-outside dismiss
   - Gate lifts only when server-side `isProfileComplete` returns true (via router.refresh())

6. Skip this gate on: `/student/api/**`, `/student/verify-parent`, `/student/onboarding`

**Acceptance criteria:**
- Student with no board/grade hits overlay immediately on any `/dashboard` visit
- Student with complete profile sees no overlay
- Overlay has no dismiss mechanism
- `npm run build && npm test` green

---

### TASK 4 — T31: Diagnostic hard gate on all session entrypoints

**Context:**
A student can start an AI tutor session without completing the diagnostic first.
This means the IRT bootstrap never fires, Vidya has no baseline mastery data,
and the first session is pedagogically meaningless.

**What to do:**
1. Create or update `lib/student/diagnosticGuard.ts`:
   ```typescript
   export async function hasDiagnosticForSubject(
     studentId: string,
     subjectId: string
   ): Promise<boolean>
   ```
   - Query: check if a `StructuredSession` or `DiagnosticResult` exists for this
     student + subject with status `COMPLETE`
   - If no diagnostic model exists yet, check `StudentConceptState` count for
     this student's concepts in this subject — if count > 0, bootstrap happened
   - Never throws — returns `false` on any DB error

2. In every server component under `app/(student)/session/**`:
   - Add a check at the top: if `!await hasDiagnosticForSubject(userId, subjectId)`
     → `redirect('/student/diagnostic/[subjectId]')` or the diagnostic start route

3. Also gate `POST /api/tutor/session/start` — if no diagnostic completed for
   the requested subject → return 403 with `{ code: 'DIAGNOSTIC_REQUIRED', subjectId }`

4. Find the diagnostic start route (search `app/` for diagnostic routes) and
   confirm it does NOT require a completed diagnostic to load (circular dependency check)

**Acceptance criteria:**
- Attempting to start a session for a subject with no diagnostic → redirects to diagnostic
- Student with completed diagnostic → session starts normally
- `npm run build && npm test` green

---

### TASK 5 — T32: Grade immutability — server-side strip

**Context:**
Grade must be immutable after first save. Currently a student can change their
grade via `PATCH /api/student/profile` or `POST /api/user/onboarding`.

**What to do:**
1. Find all API routes that accept grade in the request body:
   ```
   grep -rn "grade" app/api/ --include="*.ts" | grep -i "body\|input\|data\|update"
   ```

2. In `app/api/student/profile/route.ts` (PATCH handler):
   - After parsing the request body, unconditionally delete `grade` before any DB write:
   ```typescript
   const { grade: _stripped, ...safeUpdate } = parsedBody
   ```
   - Never write `grade` from this endpoint regardless of what the client sends

3. In `app/api/user/onboarding/route.ts` (POST handler):
   - Only write `grade` if the user's current `grade` is `null` (first-time setup)
   - If `grade` is already set, strip it from the update:
   ```typescript
   if (existingUser.grade !== null) {
     delete updateData.grade
   }
   ```

4. Add a comment on both routes: `// grade is immutable after first save — never accept from client`

**Acceptance criteria:**
- PATCH /api/student/profile with `{ grade: 9 }` does not change grade in DB
- First-time onboarding with grade → sets grade correctly
- Second onboarding call with different grade → grade unchanged
- `npm run build && npm test` green

---

### TASK 6 — Fix B2 + new-user dashboard empty state

**Context:**
New users with no diagnostic see "Your tutor is picking your first topic. Refresh
in a moment." — a loading fallback that is wrong and confusing. The v2 spec
requires an onboarding checklist card showing progress toward first session.

**What to do:**
1. Read `components/home/PrimaryActionCard.tsx` fully

2. The component currently shows a loading/pending state when `recommendation` is null.
   Replace this with an onboarding checklist state:

   When `recommendation === null` AND `type === 'start'`:
   - Show a checklist card (not a loading spinner)
   - Title: "Welcome! Let's get you started."
   - Checklist items (check each from props or passed data):
     - ✓ Create your account
     - ✓ Complete your profile (show complete/incomplete based on `isProfileComplete`)
     - → Take your diagnostic test (highlight as current step, show subject name)
     - ○ Start your first session (greyed out)
   - Primary CTA: "Take diagnostic — [Subject name]" → navigates to diagnostic route
   - Sub-text: "~15 minutes · tells Vidya where to start"

3. The dashboard page must pass the necessary props to `PrimaryActionCard` to
   enable this state — add `hasCompletedDiagnostic: boolean` and `subjectForDiagnostic: string`
   to the component props

4. Also fix the nudge bug in `lib/dashboard/nudgeMessage.ts` (or wherever it lives):
   - If `daysSinceLastSession === 99` or `lastSessionDate === null` → return `null` (no nudge)
   - The "It's been a couple of days" nudge must only fire if at least 1 session exists

**Acceptance criteria:**
- New user with profile but no diagnostic sees onboarding checklist card
- CTA says "Take diagnostic — Mathematics" (or relevant subject)
- No "Refresh in a moment" text anywhere
- "It's been a couple of days" nudge does NOT appear for new users
- `npm run build && npm test` green

---

## PHASE 2 — DASHBOARD V2 (after Phase 1 is green and deployed)

---

### TASK 7 — Dashboard: XP widget + readiness rings

**Context:**
The v2 dashboard spec requires: (1) XP this week with level progress bar, and
(2) subject readiness rings with score and colour coding. Both are currently
absent. The data already exists in the DB — just not surfaced.

**What to do:**
1. In `app/(student)/dashboard/page.tsx`, add two new parallel fetches:

   **XP fetch:**
   ```typescript
   prisma.studentXP.findFirst({
     where: { studentId: userId },
     select: { totalXp: true, level: true, xpThisWeek: true }
   })
   // fallback: { totalXp: 0, level: 1, xpThisWeek: 0 }
   ```
   If `StudentXP` model doesn't exist yet, use `user.totalXp` and `user.level`
   from the existing `User` select (these fields should already be in the schema).

   **Readiness fetch per subject:**
   ```typescript
   // For each subject in studentProfile.subjects:
   // Compute weighted mastery average from StudentConceptState
   prisma.studentConceptState.findMany({
     where: { studentId: userId, concept: { subjectId: subjectId } },
     select: { masteryScore: true, concept: { select: { subjectId: true } } }
   })
   ```
   Readiness score = average of masteryScore × 100, rounded to integer.
   Fallback = 0 if no states exist.

2. Create `components/student/dashboard/XPWidget.tsx`:
   - Shows: "XP this week: NNN" label
   - Level badge: "Level N"
   - Progress bar from current XP to next level threshold: `(N-1)² × 50`
   - "NNN XP to level N+1" sub-text
   - Loading skeleton: matches populated layout shape
   - Error state: "Couldn't load — tap to retry"

3. Create `components/student/dashboard/SubjectReadinessCard.tsx`:
   - One card per subject
   - Score ring: circular border, colour-coded:
     - red `<40` → `border-[#E24B4A]`, score text `#E24B4A`
     - amber `40–70` → `border-[#BA7517]`, score text `#BA7517`
     - green `>70` → `border-[#1D9E75]`, score text `#1D9E75`
   - Progress bar below ring, same colour
   - Label: subject name + status text ("Critical" / "Needs work" / "On track" / "Ready")
   - Tap → navigates to `/student/progress/[subjectId]`
   - Loading skeleton, error state, empty state ("Take diagnostic to see readiness")

4. Wire both components into the dashboard page between the week strip and weak topics.

**Acceptance criteria:**
- XP widget renders with real data from DB
- Readiness rings show correct colour for score ranges
- Both handle loading/error/empty states independently
- Zero readiness (no diagnostic) shows empty state CTA, not 0%
- `npm run build && npm test` green

---

### TASK 8 — T33: LearningPlan + LearningPlanItem schema and generator

**Context:**
The `LearningPlan` and `LearningPlanItem` models don't exist yet. Without them,
the dashboard CTA is driven by `getNextAction` which has no exam-date awareness,
no weak-first ordering, and no weekly structure.

**What to do:**
1. Add to `prisma/schema.prisma`:

```prisma
model LearningPlan {
  id          String            @id @default(cuid())
  studentId   String
  subjectId   String
  examDate    DateTime?
  weeklyGoal  Int               @default(5)
  generatedAt DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  student     User              @relation(fields: [studentId], references: [id])
  items       LearningPlanItem[]
  @@unique([studentId, subjectId])
}

model LearningPlanItem {
  id          String     @id @default(cuid())
  planId      String
  conceptId   String
  weekNumber  Int
  orderInWeek Int
  status      PlanItemStatus @default(UPCOMING)
  deferredAt  DateTime?
  completedAt DateTime?
  plan        LearningPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  concept     Concept      @relation(fields: [conceptId], references: [id])
  @@index([planId, weekNumber, status])
}

enum PlanItemStatus {
  UPCOMING
  IN_PROGRESS
  COMPLETED
  DEFERRED
}
```

2. Run: `npx prisma migrate dev --name add_learning_plan`

3. Create `lib/ai/learningPlan.ts` — `generateLearningPlan(studentId, subjectId, options)`:
   - Load all concepts for the subject ordered by chapter
   - Load `StudentConceptState` for each concept (masteryScore)
   - Sort concepts: lowest masteryScore first (weak-first ordering)
   - Distribute concepts across weeks based on `weeklyGoal`
   - Upsert `LearningPlan` + delete old items + create new `LearningPlanItem` rows
   - If `examDate` provided: cap total weeks to fit before exam
   - Never throws — log errors and return null on failure

4. Wire `generateLearningPlan` into the diagnostic bootstrap worker
   (`worker/services/diagnosticBootstrapWorker.ts`) — call it after mastery seeding

5. Create `GET /api/student/learning-plan/today` per the Domain 7 §7.5 contract:
   ```typescript
   // Returns the current week's first UPCOMING item
   // Falls back to getNextAction if no plan exists
   {
     item: LearningPlanItem | null,
     fallback: boolean
   }
   ```

**Acceptance criteria:**
- Migration applied cleanly
- After diagnostic bootstrap runs, `LearningPlan` and `LearningPlanItem` rows exist
- Items are ordered weakest concept first
- API returns today's item or fallback
- `npm run build && npm test` green

---

### TASK 9 — T34: Wire TodaysLearningCard to LearningPlanItem

**Context:**
`PrimaryActionCard` / `TodaysLearningCard` currently reads from `getNextAction`.
It must read from `GET /api/student/learning-plan/today` as the primary source,
with `getNextAction` as fallback only when no plan exists.

**What to do:**
1. In `app/(student)/dashboard/page.tsx`, replace the `getNextAction` call with
   `GET /api/student/learning-plan/today`:
   ```typescript
   // Replace:
   getNextAction(userId)
   // With:
   fetch('/api/student/learning-plan/today') // or direct service call
   ```

2. Update `PrimaryActionCard` props to accept the new shape from the plan API
   (conceptId, conceptName, subjectName, estimatedMinutes, weekNumber)

3. When `fallback: true` in the API response, show a subtle "Personalised plan
   coming soon" sub-text under the CTA (not a warning — friendly)

4. When `item === null` AND `fallback === false` (plan exists but no item today):
   - Show: "You're ahead of your plan this week! 🎉"
   - Secondary CTA: "Study an extra topic" → navigates to subject browse

**Acceptance criteria:**
- Dashboard CTA reads from LearningPlanItem when plan exists
- Fallback to getNextAction when no plan
- Plan-driven topic shown with week context
- `npm run build` green

---

### TASK 10 — T35: ExamReadinessScore computation + dashboard rings

**Context:**
Subject readiness rings on the dashboard need real scores. The formula at launch
is a simplified proxy: weighted average of chapter mastery scores using
`BoardChapterWeight.weightMarks`.

**What to do:**
1. Create `lib/student/examReadiness.ts` — `computeReadinessScore(studentId, subjectId)`:
   ```typescript
   // 1. Load all chapters for subject with their BoardChapterWeight
   // 2. Load StudentConceptState for all concepts in each chapter
   // 3. Per chapter: avgMastery = mean(masteryScore) for concepts in that chapter
   //    If no states: avgMastery = 0
   // 4. weightedContribution = avgMastery × (weightMarks / totalMarks)
   // 5. readinessScore = sum(weightedContribution) × 100 → integer 0–100
   // totalMarks = sum of all weightMarks for this subject
   // Returns: { score: number, chapters: ChapterReadiness[] }
   ```

2. Create `GET /api/student/readiness/[subjectId]` per Domain 7 §7.8 contract:
   - Auth-guarded
   - Calls `computeReadinessScore`
   - Returns the full response shape from the spec
   - Cache in Redis for 1 hour: `readiness:{studentId}:{subjectId}`

3. In `SubjectReadinessCard` (created in Task 7) — wire to this API instead
   of the inline computation from Task 7

4. Add a nightly BullMQ job to pre-compute and cache readiness scores for all
   active students — add to scheduler, run at 3:00 AM IST

**Acceptance criteria:**
- Readiness score reflects actual chapter mastery with board weights
- Score 0 for student with no study data
- API responds in < 500ms (Redis cache hit after first call)
- `npm run build && npm test` green

---

## PHASE 3 — PARENT ACTOR (after Phase 2 is green and deployed)

---

### TASK 11 — T37: DPDP Consent record

**Context:**
The Indian Digital Personal Data Protection Act 2023 requires explicit, recorded
consent before processing personal data or enabling AI interaction for students.
No consent model currently exists. This is a legal requirement — you cannot
legally operate without it.

**NOTE FOR MANISH:** The `consentCopy` text in this task is a placeholder.
You MUST have a lawyer review and approve the actual consent language before
flipping this live. The code can be shipped but the consent flow must not be
shown to real users until the copy is legally approved.

**What to do:**
1. Add to `prisma/schema.prisma`:
```prisma
model Consent {
  id          String   @id @default(cuid())
  userId      String
  scope       ConsentScope
  givenAt     DateTime @default(now())
  ipAddress   String?
  userAgent   String?
  withdrawnAt DateTime?
  version     String   @default("1.0")
  user        User     @relation(fields: [userId], references: [id])
  @@index([userId, scope])
}

enum ConsentScope {
  DATA_PROCESSING
  AI_INTERACTION
  PARENT_NOTIFICATION
  MARKETING
}
```

2. Run: `npx prisma migrate dev --name add_consent_record`

3. Create `app/api/consent/grant/route.ts` — POST:
   - Body: `{ scopes: ConsentScope[], version: string }`
   - Creates Consent rows for each scope
   - Captures IP from request headers
   - Returns `{ granted: true, scopes }`

4. Create `app/api/consent/withdraw/route.ts` — POST:
   - Body: `{ scope: ConsentScope }`
   - Sets `withdrawnAt = now()` on matching Consent row
   - Returns `{ withdrawn: true }`

5. Create `lib/consent/check.ts` — `hasConsented(userId, scope)`:
   - Returns true if a non-withdrawn Consent row exists for user + scope
   - Never throws, returns false on error

6. Wire consent collection into the signup/onboarding flow:
   - After profile setup completes (all 4 fields done), show a consent screen
   - Must collect: `DATA_PROCESSING` + `AI_INTERACTION` as minimum
   - Cannot proceed to diagnostic without granting these two
   - Show the consent copy clearly — do not hide behind a link

7. Gate `POST /api/tutor/turn`: if `!await hasConsented(userId, 'AI_INTERACTION')`
   → return 403 `{ code: 'CONSENT_REQUIRED' }`

**Consent copy placeholder (replace with lawyer-reviewed text):**
```
By clicking "I agree", you consent to:
1. Spinzy processing your academic data (grades, answers, progress) to personalise
   your learning experience, as described in our Privacy Policy.
2. Spinzy using AI to generate tutoring responses during your learning sessions.
You can withdraw consent at any time from your Profile settings.
```

**Acceptance criteria:**
- Consent rows created on signup with IP captured
- Tutor turn blocked if AI_INTERACTION consent not given
- Withdraw endpoint sets withdrawnAt correctly
- `npm run build && npm test` green

---

### TASK 12 — T38: Parent as distinct actor

**Context:**
Parents need their own auth, their own data model, and a separate route group.
Currently parent data is just fields on the `User` model. Parents of under-13
students need to link their children, and parents of older students need to be
invited.

**What to do:**
1. Add to `prisma/schema.prisma`:
```prisma
model ParentProfile {
  id        String         @id @default(cuid())
  userId    String         @unique
  createdAt DateTime       @default(now())
  user      User           @relation(fields: [userId], references: [id])
  children  ParentStudent[]
}
```
   Note: `ParentStudent` model likely already exists — verify before adding.

2. Run: `npx prisma migrate dev --name add_parent_profile`

3. Create `app/(parent)/` route group with its own layout:
   - `app/(parent)/layout.tsx` — server component
   - Requires `session.user.role === 'parent'`
   - If not parent role → redirect to `/dashboard`
   - No student session routes accessible from this layout

4. Create `app/(parent)/dashboard/page.tsx`:
   - Server component
   - Loads all linked children via `ParentStudent` relation
   - For each child: loads sessions this week, streak, readiness scores
   - Renders `ParentDashboard` component

5. Create `components/parent/ParentDashboard.tsx`:
   - Per the Domain 5 §5.1 spec exactly
   - One card per child
   - Name, grade, board, sessions this week, streak
   - Readiness rings per subject (same SubjectReadinessCard as student dashboard)
   - "View full progress report" → `/parent/progress/[studentId]`
   - No edit controls anywhere
   - Empty state: "Link your child's account to start monitoring"
   - Language: simplified, no jargon (written for low-digital-literacy parents)

6. Child linking routes:
   - `POST /api/parent/link-child` — accepts invite token, links child to parent
   - `POST /api/student/invite-parent` — student generates invite link (for age ≥13)

**Acceptance criteria:**
- Parent with role='parent' sees their dashboard at `/parent/dashboard`
- Student routes inaccessible from parent layout
- Child cards show real data
- `npm run build && npm test` green

---

### TASK 13 — T39: Parent progress detail + weekly digest

**Context:**
Parents need a detailed child progress view and a weekly email digest.
The `GET /api/parent/progress` endpoint is defined in Domain 7 §7.10 but not built.

**What to do:**
1. Create `GET /api/parent/progress` per Domain 7 §7.10 contract exactly:
   ```typescript
   // Returns all linked children with:
   // - streakDays, sessionsThisWeek, studyTimeThisWeekMinutes
   // - per-subject: readinessScore, daysToExam, recentMasteryChange (last 7 days)
   // - recentAlerts: readiness_drop | streak_break | milestone
   ```

2. Create `app/(parent)/progress/[studentId]/page.tsx`:
   - Sessions list (last 7 days)
   - Chapter mastery bars per subject (reuse `SubjectReadinessCard`)
   - Recent test scores
   - No session transcript access — server-side enforced

3. Create `worker/services/weeklyDigestWorker.ts`:
   - BullMQ repeatable job: every Sunday at 18:00 IST (`0 18 * * 0`)
   - For each parent with linked children:
     - Compile: sessions completed, mastery change, readiness, streak
     - Generate AI narrative (GPT-4o-mini, 2 sentences max)
     - Send email via existing `lib/mailer.ts`
   - Register in scheduler

4. Email template (plain text + HTML):
   - Subject: "Manish's learning update — week of [date]"
   - Body: sessions count, streak, readiness change, AI insight
   - CTA: "View full report" → deep link to `/parent/dashboard`

**Acceptance criteria:**
- API returns correct shape for all linked children
- Progress detail page loads and is read-only
- Weekly digest job registered and would fire on Sunday
- `npm run build && npm test` green

---

## PHASE 4 — RELIABILITY + ROLLOUT (after Phase 3 is green and deployed)

---

### TASK 14 — T26: DoubtKb table + dedup write

**Context:**
The `DoubtKb` schema is defined in `prisma/schema.prisma` but the migration was
never run. Doubt deduplication is not wired. Every repeated doubt triggers a
fresh LLM call — wasting tokens.

**What to do:**
1. Check if `DoubtKb` model exists in schema. If yes: run the migration.
   If not: add it first:
```prisma
model DoubtKb {
  id                String   @id @default(cuid())
  subjectId         String
  conceptId         String?
  questionText      String
  answerText        String
  embedding         Unsupported("vector(1536)")?
  timesServed       Int      @default(1)
  alternatePhrasings String[] @default([])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```
   Migration name: `add_doubt_kb`

2. Create `lib/ai/tutor/doubtKb.ts`:
   - `lookupDoubt(questionText, subjectId)`:
     - Embed query → pgvector similarity search at threshold 0.92
     - Returns cached answer or null
   - `recordDoubt(questionText, answerText, subjectId, conceptId?)`:
     - First check similarity at 0.88 — if near-duplicate exists: update `timesServed++`
       and append to `alternatePhrasings[]`
     - If novel: insert new row with embedding
     - Never throws

3. Wire into orchestrator (`services/tutor/turn.ts`):
   - Before LLM call for doubt-type turns: check `lookupDoubt`
   - If hit: serve cached answer (mark `cached: true` in `AITutorTurnLog`)
   - After LLM call on miss: call `recordDoubt` async (non-blocking)

**Acceptance criteria:**
- Migration applied
- Repeated identical doubt returns cached answer
- Near-duplicate doubt (same question different wording) updates `timesServed`
- Novel doubt is stored with embedding
- `npm run build && npm test` green

---

### TASK 15 — T28: Explanation cache

**Context:**
Every EXPLANATION and WORKED_EXAMPLE stage makes a fresh LLM call for the same
concept. With 243 concepts, the same explanations are regenerated repeatedly.
A 7-day Redis cache eliminates most of this cost.

**What to do:**
1. Check if `lib/ai/tutor/explanationCache.ts` exists. If yes: verify it's wired.
   If not: create it:
   ```typescript
   // Key: cache:exp:{conceptId}:{lang}:{modality}
   // TTL: 604800 seconds (7 days)
   export async function getCachedExplanation(
     conceptId: string, lang: string, modality: string
   ): Promise<string | null>  // null on miss or error, never throws

   export async function setCachedExplanation(
     conceptId: string, lang: string, modality: string, content: string
   ): Promise<void>  // silently no-ops on Redis error, never throws
   ```

2. Wire into orchestrator in `services/tutor/turn.ts`:
   - For `CORE_EXPLANATION` stage: modality = `'text'`
   - For `WORKED_EXAMPLE` stage: modality = `'worked_example'`
   - Before LLM call: check cache
   - After LLM call (on miss): store in cache
   - Safety replacements (outputSafety triggered) must NOT be cached
   - Set `AITutorTurnLog.cached = true/false` accordingly

3. Add `invalidateExplanation(conceptId)` — called when concept content is updated

**Acceptance criteria:**
- Second call for same concept/lang/modality returns cached response
- Safety replacements never cached
- Cache miss → LLM call proceeds normally
- `npm run build && npm test` green

---

### TASK 16 — T40: Redis-backed LLM circuit breaker

**Context:**
The current circuit breaker in `lib/redis.ts` is in-memory. Under PM2 with
multiple processes, each process has its own state — the breaker never actually
trips across the whole app. It must be Redis-backed.

**What to do:**
1. Create `lib/ai/tutor/circuitBreaker.ts`:
   ```typescript
   // Redis keys:
   //   cb:llm:failures   → integer count, TTL 30s
   //   cb:llm:open       → '1' when circuit is open, TTL 60s
   //
   // Logic:
   // - isCircuitOpen(): check cb:llm:open key exists in Redis
   // - recordFailure(): INCR cb:llm:failures with 30s TTL
   //   if count >= 3: SET cb:llm:open '1' EX 60
   // - recordSuccess(): DEL cb:llm:failures, DEL cb:llm:open
   //
   // All operations: never throw, return safe defaults on Redis error
   ```

2. Wire into `lib/callLLM.ts`:
   - Before OpenAI call: if `await isCircuitOpen()` → throw `LLMError('AI_UNAVAILABLE')`
   - On OpenAI error: `await recordFailure()`
   - On OpenAI success: `await recordSuccess()`

3. Anthropic failover — in `lib/callLLM.ts`:
   - If circuit is open AND `ANTHROPIC_API_KEY` is set:
     → attempt Anthropic call with equivalent prompt
   - If Anthropic also fails: throw `LLMError('AI_UNAVAILABLE')`

4. Remove the in-memory circuit breaker from `lib/redis.ts` (leave the null-safe
   `getRedis()` pattern but remove the in-memory breaker state)

**Acceptance criteria:**
- 3 OpenAI failures within 30s → circuit opens across all PM2 processes
- Circuit auto-closes after 60s
- Anthropic failover fires when circuit is open and ANTHROPIC_API_KEY is set
- `npm run build && npm test` green

---

### TASK 17 — T41: Staged rollout via StudentFeatureFlag

**Context:**
`StudentFeatureFlag` model exists. The global `ENABLE_AI_TUTOR` kill switch works.
But there's no cohort-based staged rollout — it's all-or-nothing. For launch,
we need to roll out to 5% first to catch issues before full rollout.

**What to do:**
1. Create `lib/features/rollout.ts`:
   ```typescript
   export async function isInAITutorRollout(userId: string): Promise<boolean> {
     // 1. If ENABLE_AI_TUTOR=false globally → return false
     // 2. Check StudentFeatureFlag for this user — if explicit flag set → use it
     // 3. Otherwise: hash userId to a number 0–99
     //    If hash < ROLLOUT_PERCENTAGE (default 5) → return true
     //    else → return false
     // ROLLOUT_PERCENTAGE read from env var, default 5
   }
   ```
   Use a stable hash: `crc32(userId) % 100` (install `crc-32` or use a simple djb2)

2. Create `scripts/set-rollout.ts`:
   ```typescript
   // Usage: npx tsx scripts/set-rollout.ts --percentage 5
   // Sets ROLLOUT_PERCENTAGE in a DB config table or updates an env var
   // Also: npx tsx scripts/set-rollout.ts --user userId --enabled true/false
   // For per-user overrides
   ```

3. Replace `isAiTutorGloballyEnabled()` calls in:
   - `app/api/tutor/turn/route.ts`
   - `app/api/tutor/session/start/route.ts`
   - Student layout / dashboard
   With: `isInAITutorRollout(userId)` — falls back correctly for users not in rollout

4. When `isInAITutorRollout = false`: render the existing v1 session UI (no change for student, no error)

**Acceptance criteria:**
- At 5% rollout: approximately 5 out of 100 new user IDs get AI tutor
- ENABLE_AI_TUTOR=false still kills everything regardless of rollout %
- Per-user override via StudentFeatureFlag still works
- `npm run build && npm test` green

---

### TASK 18 — T42: Daily cost metric + alert

**Context:**
We need to know daily cost per session. The threshold is ₹0.25/session (~$0.003).
`AITutorTurnLog.costUsd` is populated per turn. We need a daily aggregate and alert.

**What to do:**
1. Create `worker/services/costReportingWorker.ts`:
   ```typescript
   // Runs daily at 6:00 AM IST (cron: 0 6 * * *)
   // Query:
   //   SELECT DATE(createdAt) as date,
   //          COUNT(DISTINCT sessionId) as sessions,
   //          SUM(costUsd) as totalCostUsd,
   //          SUM(costUsd)/COUNT(DISTINCT sessionId) as costPerSession
   //   FROM AITutorTurnLog
   //   WHERE createdAt >= yesterday 00:00 IST
   //   GROUP BY DATE(createdAt)
   //
   // If costPerSession > 0.003 (USD) → log WARN + send alert email
   // Store result in a simple DailyCostMetric table (or just log)
   ```

2. Add `DailyCostMetric` model to schema (simple):
```prisma
model DailyCostMetric {
  id              String   @id @default(cuid())
  date            DateTime @unique
  sessions        Int
  totalCostUsd    Float
  costPerSession  Float
  createdAt       DateTime @default(now())
}
```
   Migration name: `add_daily_cost_metric`

3. Alert: if `costPerSession > 0.003` → send email via `lib/mailer.ts` to the
   on-call alias defined in `ONCALL_EMAIL` env var

4. Register in scheduler

**Acceptance criteria:**
- Daily job runs and inserts `DailyCostMetric` row
- Alert email fires when threshold exceeded
- `npm run build && npm test` green

---

### TASK 19 — B4: Fix PM2 env_production warning (cosmetic)

**Context:**
PM2 warns `Environment [production] is not defined in process file` on every
deploy. Cosmetic but noisy in logs.

**What to do:**
1. Open `ecosystem.config.cjs`
2. For each app (`ai-tutor-web`, `content-engine-worker`, `ai-tutor-scheduler`),
   add an empty `env_production` block that mirrors the `env` block:
   ```javascript
   env_production: {
     NODE_ENV: 'production',
     // same vars as env block
   }
   ```
3. The deploy script should then use `--env production` flag:
   Change `pm2 start ecosystem.config.cjs` to `pm2 start ecosystem.config.cjs --env production`

**Acceptance criteria:**
- No `[PM2][WARN] Environment [production] is not defined` on deploy
- All 3 processes still start correctly
- `npm run build` green

---

### TASK 20 — T43 prep: Distress detection wiring (code-only, flag stays false)

**Context:**
T15 (distress detection) is gated on counsellor sign-off (T43). The flag
`ENABLE_DISTRESS_DETECTION` must stay `false` until you have a named on-call
human. This task prepares the code so flipping the flag is a one-line change.

**NOTE FOR MANISH:** After this task, you must:
1. Define who receives distress alerts (you, a counsellor, a support email)
2. Set `ONCALL_EMAIL` in `.env.production`
3. Test the distress flow end-to-end on staging
4. Only then set `ENABLE_DISTRESS_DETECTION=true` in PM2

**What to do:**
1. Create `lib/ai/tutor/distress.ts` (if not exists):
   ```typescript
   export interface DistressResult {
     detected: boolean
     severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
     triggerPhrases: string[]
     suggestedResponse: string
   }

   export function detectDistress(studentMessage: string): DistressResult
   // Pure function, no I/O
   // Keywords: self-harm, worthless, hopeless, can't do anything right,
   //           nobody cares, want to disappear, hate myself, give up on life
   // Severity: CRITICAL for self-harm/disappear, HIGH for worthless/hopeless,
   //           MEDIUM for give up/hate myself
   // suggestedResponse: warm, supportive, not dismissive
   // Never emits DISTRESSED EmotionalState (handled separately)
   ```

2. Create `worker/services/distressNotificationWorker.ts`:
   - BullMQ job: `distress-notification` queue
   - Job payload: `{ studentId, sessionId, severity, triggerPhrases, studentMessage }`
   - If `ENABLE_DISTRESS_DETECTION=false` → log and return (no-op)
   - If `ENABLE_DISTRESS_DETECTION=true`:
     - Look up parent contact for student
     - If no parent: log as CRITICAL safety event for admin review, return
     - If parent: send email/SMS via `lib/mailer.ts` + `lib/sms.ts`
     - Always: create `SafetyEvent` row

3. Wire into orchestrator (only fires when flag is true):
   ```typescript
   if (process.env.ENABLE_DISTRESS_DETECTION === 'true') {
     const distressResult = detectDistress(studentMessage)
     if (distressResult.detected) {
       enqueueDistressNotification({ studentId, sessionId, ...distressResult })
     }
   }
   ```

4. Write 10 unit tests for `detectDistress`:
   - True positives for each severity level
   - False positives for normal study frustration ("this is so hard")
   - Never throws on empty string

**Acceptance criteria:**
- `detectDistress` returns correct severity for each keyword category
- Worker no-ops when flag is false
- All 10 tests pass
- `npm run build && npm test` green
- Flag remains `false` in `.env.production` until you define on-call

---

## EXECUTION ORDER SUMMARY

```
Phase 1 (Week 1) — Run in strict order, deploy after each:
  Task 1  → B1: dateOfBirth fix (migration required)
  Task 2  → B2: verify-parent page redirect
  Task 3  → T29: ProfileCompletionGate wired
  Task 4  → T31: Diagnostic hard gate
  Task 5  → T32: Grade immutability
  Task 6  → B2+B3: New-user dashboard empty state + nudge bug

Phase 2 (Week 2–3) — Deploy as a batch after all pass:
  Task 7  → Dashboard: XP widget + readiness rings
  Task 8  → T33: LearningPlan schema + generator
  Task 9  → T34: TodaysLearningCard wired to plan
  Task 10 → T35: ExamReadinessScore

Phase 3 (Week 3–4) — Deploy as a batch:
  Task 11 → T37: DPDP consent (do NOT go live until lawyer reviews copy)
  Task 12 → T38: Parent actor schema + routing
  Task 13 → T39: Parent dashboard + weekly digest

Phase 4 (Week 4–5) — Deploy as a batch:
  Task 14 → T26: DoubtKb + dedup
  Task 15 → T28: Explanation cache
  Task 16 → T40: Redis-backed circuit breaker
  Task 17 → T41: Staged rollout (start at 5%)
  Task 18 → T42: Daily cost metric
  Task 19 → B4: PM2 env warning (cosmetic, any time)
  Task 20 → T43 prep: Distress detection code (flag stays false)
```

## GATE BETWEEN EVERY TASK
```bash
npm run build:workers && npm run build && npm test
# All must pass before committing
# If any fail: fix before moving to next task
```

## DEPLOY AFTER EACH PHASE
```bash
git add -A && git commit -m "phase N: [description]"
git push origin master
# On VPS:
./scripts/deploy-and-run.sh
```
