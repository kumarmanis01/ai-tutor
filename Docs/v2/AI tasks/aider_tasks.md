# Spinzy — Aider Task Prompts
# 20 self-contained prompts. Paste one at a time into Aider.
# Aider finds its own files via /run commands. No manual /add needed.
#
# BETWEEN EVERY TASK:
#   npm run build:workers && npm run build && npm test
#   All green → git add -A && git commit -m "task N: description"
#   Red → paste the error back into Aider in the same session
#
# DO NOT paste the next task until the current one is green and committed.

---

## TASK 1 — Fix B1: Drop dateOfBirth, use integer age for parent gate

```
/run grep -rn "dateOfBirth\|isUnder18" lib/ app/ components/ prisma/schema.prisma --include="*.ts" --include="*.tsx" --include="*.prisma" 2>/dev/null | grep -v node_modules | grep -v ".next"
```

Read every file path that appears in that output and add them all to context. Then do the following:

1. In `prisma/schema.prisma`, remove the line `dateOfBirth  DateTime?` from the User model entirely. Do not rename it, do not keep it nullable — delete it.

2. Run the migration:
```
/run npx prisma migrate dev --name drop_date_of_birth_use_age_integer
```

3. In every file that references `dateOfBirth`, remove all references. Replace any logic of the form `isUnder18(user.dateOfBirth)` or `user.dateOfBirth !== null` with this exact check:
```typescript
const requiredByAge = user.age !== null && user.age < 13
```

4. In `lib/student/accountStatus.ts`, update `requiresParentOTPGate` so the final gate condition is:
```typescript
return (
  user.accountStatus === 'pending_parent_verification' &&
  user.age !== null &&
  user.age < 13
)
```
If `user.age` is null → return `false`. If `accountStatus` is anything other than `pending_parent_verification` → return `false`. Never gate on missing data.

5. Remove `dateOfBirth` from every Prisma `select: {}` clause across all files.

6. Remove `dateOfBirth` from any NextAuth session type definitions, `lib/auth.ts` JWT/session callbacks, and any TypeScript interface or type that includes it.

7. Run:
```
/run npx prisma generate
```

Verify the build compiles and the three gate behaviours are correct:
- age=17, accountStatus=active → requiresParentOTPGate = false
- age=null, accountStatus=pending_parent_verification → false  
- age=10, accountStatus=pending_parent_verification → true

Report every file changed with the exact lines removed/added.
```

---

## TASK 2 — Fix B2: Convert /student/verify-parent to redirect

```
/run find app -type f -name "*.tsx" -o -name "*.ts" | xargs grep -l "verify-parent" 2>/dev/null | grep -v node_modules
```

Add all files found. Then:

1. Find the page file for the `/student/verify-parent` route (it will be something like `app/(student)/verify-parent/page.tsx`).

2. Replace the entire contents of that file with:
```typescript
import { redirect } from 'next/navigation'

export default function VerifyParentPage() {
  redirect('/dashboard')
}
```

Nothing else in that file. No imports other than redirect. No layout. No client components.

3. The `ParentOTPGate` overlay in `StudentLayoutShell` already handles verification over the dashboard — do not touch it.

Verify: navigating to `/student/verify-parent` redirects to `/dashboard`. Build must pass.
```

---

## TASK 3 — T29: Wire ProfileCompletionGate into student layout

```
/run find app components lib -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs grep -l "ProfileCompletion\|profileGuard\|isProfileComplete" 2>/dev/null | grep -v node_modules | grep -v ".next"
/run cat app/\(student\)/layout.tsx 2>/dev/null || find app -path "*/student*/layout.tsx" | head -3
/run cat lib/student/profileGuard.ts 2>/dev/null || find lib -name "profileGuard.ts" | head -3
```

Add all files found by these commands. Then:

1. In `lib/student/profileGuard.ts` (create it if missing), ensure `isProfileComplete(user)` returns `true` only when ALL four fields are present:
```typescript
export function isProfileComplete(user: {
  board: string | null
  grade: number | null
  language: string | null
  subjects: unknown
}): boolean {
  return (
    !!user.board &&
    user.grade !== null &&
    !!user.language &&
    Array.isArray(user.subjects) &&
    (user.subjects as unknown[]).length > 0
  )
}
```

2. In `app/(student)/layout.tsx`:
   - Import `isProfileComplete` from `lib/student/profileGuard`
   - After loading `studentProfile`, compute: `const profileComplete = isProfileComplete(studentProfile)`
   - Pass `showProfileGate={!profileComplete}` to `StudentLayoutShell`
   - Skip the gate on these paths: `/student/onboarding`, `/student/verify-parent`, any path starting with `/student/api`

3. In `components/student/StudentLayoutShell.tsx`:
   - Accept new prop `showProfileGate?: boolean`
   - When `showProfileGate` is true AND `showParentGate` is false: render `<ProfileCompletionGate />` as a full-screen overlay below the parent gate

4. Create `components/student/ProfileCompletionGate.tsx` if it does not exist:
   - Full-screen overlay: `fixed inset-0 z-[9000] bg-white flex flex-col`
   - Title: "Complete your profile"
   - Subtitle: "We need a few details before you can start learning."
   - Show a checklist of 4 items (Board, Class, Medium, Subjects) — each with a green tick or grey circle
   - Progress bar: N of 4 complete
   - Single CTA button: "Complete your profile" — on click navigate to `/student/onboarding` or `/profile/setup` (whichever route exists)
   - NO close button, NO click-outside dismiss
   - Mobile-first: full-screen, large tap targets (min-h-[44px])
   - Must support `dark:` Tailwind variants

Verify: a user with no board/grade/language/subjects hits the overlay on `/dashboard`. A complete user sees nothing.
```

---

## TASK 4 — T31: Diagnostic hard gate on all session entrypoints

```
/run find app -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs grep -l "session\|diagnostic" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "api" | head -20
/run find lib -type f -name "*.ts" | xargs grep -l "diagnostic\|hasDiagnostic" 2>/dev/null | grep -v node_modules
/run find app/api -type f -name "route.ts" | xargs grep -l "tutor\|session/start" 2>/dev/null | grep -v node_modules
```

Add all files found. Then:

1. Create `lib/student/diagnosticGuard.ts`:
```typescript
import { prisma } from '@/lib/prisma'

/**
 * Returns true if the student has a completed diagnostic for this subject.
 * Checks StudentConceptState rows — if any exist for this student+subject,
 * the diagnostic bootstrap has run (which means diagnostic was completed).
 * Never throws — returns false on any error.
 */
export async function hasDiagnosticForSubject(
  studentId: string,
  subjectId: string
): Promise<boolean> {
  try {
    const count = await prisma.studentConceptState.count({
      where: {
        studentId,
        concept: { subjectId },
      },
    })
    return count > 0
  } catch {
    return false
  }
}
```

2. In every server component under `app/(student)/session/` that loads a topic or concept:
   - Add at the top: `const hasDiag = await hasDiagnosticForSubject(userId, subjectId)`
   - If `!hasDiag` → `redirect('/student/diagnostic/' + subjectId)` (or to the diagnostic start route — check what route exists with a `/run find app -path "*diagnostic*"` first)

3. In `app/api/tutor/session/start/route.ts` (if it exists):
   - After auth check, before creating a session:
   ```typescript
   const hasDiag = await hasDiagnosticForSubject(userId, subjectId)
   if (!hasDiag) {
     return Response.json(
       { code: 'DIAGNOSTIC_REQUIRED', subjectId },
       { status: 403 }
     )
   }
   ```

4. The diagnostic start/resume page itself must NOT call `hasDiagnosticForSubject` (would create a circular redirect). Add a comment on those routes: `// diagnostic gate does not apply here`

Verify: attempting to start a session with no diagnostic → redirected or 403. Student with completed diagnostic → unaffected.
```

---

## TASK 5 — T32: Grade immutability — server-side strip

```
/run find app/api -type f -name "route.ts" | xargs grep -l "grade\|onboarding\|profile" 2>/dev/null | grep -v node_modules
/run grep -rn "grade" app/api/ --include="*.ts" | grep -v node_modules | grep -v ".next"
```

Add all files found. Then:

1. In `app/api/student/profile/route.ts` (PATCH handler) — after parsing the request body, before any DB write, strip `grade` unconditionally:
```typescript
// grade is immutable after first save — strip from all student-facing updates
const { grade: _grade, dateOfBirth: _dob, ...safeUpdate } = parsedBody
// use safeUpdate for the prisma.user.update call, never parsedBody directly
```
Add this exact comment on the line above the strip.

2. In `app/api/user/onboarding/route.ts` (or wherever onboarding data is saved) — only write grade if the user's current grade is null:
```typescript
const existingUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { grade: true }
})
if (existingUser?.grade !== null) {
  delete updateData.grade
}
```

3. Search for any other API routes that accept `grade` in the body and apply the same strip pattern. Add the same comment to each.

Verify:
- PATCH /api/student/profile with `{ grade: 9 }` → DB grade unchanged
- First onboarding with grade=10 → grade=10 saved
- Second onboarding call with grade=9 → grade still 10
```

---

## TASK 6 — Fix new-user dashboard empty state and nudge bug

```
/run find components/home app/\(student\) -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find lib/dashboard lib/home -type f 2>/dev/null | grep -v node_modules
/run grep -rn "nudge\|getNudge\|daysSince\|Ready to start\|picking your first" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next"
```

Add all files found. Then make two fixes:

**Fix 1 — New-user empty state in PrimaryActionCard**

In `components/home/PrimaryActionCard.tsx` (or wherever the "Ready to start? / Your tutor is picking your first topic. Refresh in a moment." text lives):

When `recommendation === null` AND the action type is `'start'` (no session to resume, no homework pending), replace the loading/pending UI with this onboarding checklist:

```tsx
// New-user empty state — shown when recommendation is null and no active session
<div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 px-4 py-5">
  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
    Let's get you started
  </p>
  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
    Complete these steps to begin learning with Vidya.
  </p>

  {/* Checklist rows — pass isProfileComplete and hasCompletedDiagnostic as props */}
  <div className="space-y-2 mb-4">
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <span className="text-green-600">✓</span> Create your account
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <span className="text-green-600">✓</span> Complete your profile
    </div>
    <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-400">
      <span className="text-indigo-500">→</span> Take your diagnostic test
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-300 dark:text-gray-600">
      <span>○</span> Start your first session
    </div>
  </div>

  <a
    href="/student/diagnostic"
    className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white"
  >
    Take diagnostic — Mathematics
  </a>
  <p className="mt-2 text-center text-xs text-gray-400">
    ~15 minutes · tells Vidya where to start
  </p>
</div>
```

The diagnostic link should point to whatever diagnostic start route exists. Use `/run find app -path "*diagnostic*" -name "page.tsx"` to confirm the correct path first.

Remove the "Ready to start? / Refresh in a moment" text entirely — it must not appear anywhere.

**Fix 2 — Nudge fires for new users**

In whatever file contains `getNudgeMessage` or the nudge logic (found by the grep above):

Add this guard at the very top of the nudge function, before any other logic:
```typescript
// Never show nudge to users who have never had a session
if (!lastSessionDate || daysSinceLastSession >= 90) {
  return null
}
```

The "It's been a couple of days" message must only fire when `lastSessionDate` is a real date AND `daysSinceLastSession >= 2 && daysSinceLastSession < 90`.

Verify: a brand-new user with no sessions sees the onboarding checklist, zero nudge banners.
```

---

## TASK 7 — Dashboard: XP widget and subject readiness rings

```
/run find components/student/dashboard components/home app/\(student\)/dashboard -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run cat app/\(student\)/dashboard/page.tsx 2>/dev/null | head -120
/run grep -rn "totalXp\|xpThisWeek\|currentLevel\|level\b" prisma/schema.prisma lib/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -20
/run grep -rn "StudentConceptState\|masteryScore\|readiness" lib/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
```

Add all files found. Then:

**1. XP Widget**

Create `components/student/dashboard/XPWidget.tsx`:
```tsx
'use client'
// Props: totalXp, level, xpThisWeek (all numbers, default 0)
// Shows:
//   - "XP this week: [xpThisWeek]" label top-right
//   - Level badge: "Level [level]" top-left
//   - Progress bar from 0 to next level threshold: (level)^2 * 50
//   - Current: [totalXp % threshold] / [threshold] XP
//   - Sub-text: "[remaining] XP to level [level+1]"
// Loading skeleton: 2 grey bars matching the populated layout shape
// Error state: "Couldn't load XP"
// Mobile-first, dark: variants required
```

**2. Subject Readiness Card**

Create `components/student/dashboard/SubjectReadinessCard.tsx`:
```tsx
'use client'
// Props: subjectName, score (0-100 integer), subjectId
// Score ring: circular div with border, colour-coded:
//   score < 40  → border-[#E24B4A] text-[#E24B4A]  label: "Critical"
//   score 40-70 → border-[#BA7517] text-[#BA7517]  label: "Needs work"
//   score > 70  → border-[#1D9E75] text-[#1D9E75]  label: "On track"
// Progress bar below ring, same colour as ring
// Subject name + status label
// Empty state (score=0, no data): "Take diagnostic to see readiness"
//   with CTA button → /student/diagnostic/[subjectId]
// Loading skeleton matches populated layout
// Mobile-first, dark: variants
```

**3. Wire into dashboard page**

In `app/(student)/dashboard/page.tsx`:

Add these to the parallel fetch array:
```typescript
// XP data — read from User model fields totalXp, level (already selected or add to select)
// Readiness per subject — compute inline:
prisma.studentConceptState.findMany({
  where: { studentId: userId },
  select: {
    masteryScore: true,
    concept: {
      select: {
        subjectId: true,
        topicDef: {
          select: {
            chapterDef: {
              select: {
                boardChapterWeights: {
                  select: { weightMarks: true }
                }
              }
            }
          }
        }
      }
    }
  }
})
```

Compute readiness score per subject:
```typescript
// Group by subjectId, weighted average using boardChapterWeight.weightMarks
// readinessScore = (sum of masteryScore × weightMarks) / totalWeightMarks × 100
// Round to integer. Default 0 if no data.
```

Add `<XPWidget>` and `<SubjectReadinessCard>` to the dashboard JSX between the week strip section and the weak topics section.

Verify: dashboard shows XP progress bar and coloured readiness rings with real DB data.
```

---

## TASK 8 — T33: LearningPlan + LearningPlanItem schema and generator

```
/run cat prisma/schema.prisma | grep -A5 "model LearningPlan\|model Concept\|model User\b" | head -60
/run find worker/services lib/ai -type f -name "*.ts" | xargs grep -l "diagnostic\|bootstrap\|mastery" 2>/dev/null | grep -v node_modules
/run find app/api/student -type f -name "route.ts" 2>/dev/null | grep -v node_modules
```

Add all files found. Then:

**1. Schema**

Add to `prisma/schema.prisma` before the final closing brace:
```prisma
model LearningPlan {
  id          String            @id @default(cuid())
  studentId   String
  subjectId   String
  examDate    DateTime?
  weeklyGoal  Int               @default(5)
  generatedAt DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  student     User              @relation(fields: [studentId], references: [id], onDelete: Cascade)
  items       LearningPlanItem[]
  @@unique([studentId, subjectId])
}

model LearningPlanItem {
  id          String         @id @default(cuid())
  planId      String
  conceptId   String
  weekNumber  Int
  orderInWeek Int
  status      PlanItemStatus @default(UPCOMING)
  deferredAt  DateTime?
  completedAt DateTime?
  plan        LearningPlan   @relation(fields: [planId], references: [id], onDelete: Cascade)
  concept     Concept        @relation(fields: [conceptId], references: [id])
  @@index([planId, weekNumber, status])
}

enum PlanItemStatus {
  UPCOMING
  IN_PROGRESS
  COMPLETED
  DEFERRED
}
```

Also add `learningPlans LearningPlan[]` to the `User` model and `learningPlanItems LearningPlanItem[]` to the `Concept` model.

Run the migration:
```
/run npx prisma migrate dev --name add_learning_plan
/run npx prisma generate
```

**2. Generator**

Create `lib/ai/learningPlan.ts`:
```typescript
// generateLearningPlan(studentId, subjectId, options?)
// 1. Load all concepts for the subject ordered by chapter order, then topic order
// 2. Load StudentConceptState for each concept (masteryScore, default 0 if missing)
// 3. Sort concepts: lowest masteryScore first (weak-first), then by curriculum order
//    for ties — this ensures the weakest chapters come first
// 4. weeklyGoal = options.weeklyGoal ?? 5
// 5. Assign weekNumber and orderInWeek: distribute concepts across weeks
//    conceptsPerWeek = weeklyGoal (one concept per study day, adjust as needed)
// 6. Upsert LearningPlan, delete old LearningPlanItems, create new ones
// 7. Never throws — log error and return null on failure
export async function generateLearningPlan(
  studentId: string,
  subjectId: string,
  options?: { examDate?: Date; weeklyGoal?: number }
): Promise<string | null> // returns planId or null
```

**3. Wire into diagnostic bootstrap**

In `worker/services/diagnosticBootstrapWorker.ts`, after the mastery seeding loop completes, add:
```typescript
import { generateLearningPlan } from '@/lib/ai/learningPlan'
// After mastery seeding:
await generateLearningPlan(job.data.studentId, job.data.subjectId)
```

**4. API endpoint**

Create `app/api/student/learning-plan/today/route.ts`:
```typescript
// GET — auth-guarded
// 1. Find LearningPlan for student + their first subject
// 2. Find first LearningPlanItem where status=UPCOMING for current weekNumber
//    weekNumber = Math.ceil(daysSinceFirstSession / 7) or 1 if no sessions
// 3. If no plan exists → call getNextAction as fallback
// Response matches Domain 7 §7.5 contract:
// { item: LearningPlanItem | null, fallback: boolean }
```

Verify: after diagnostic bootstrap runs for a student, LearningPlan and LearningPlanItem rows exist in DB with weak-first ordering.
```

---

## TASK 9 — T34: Wire TodaysLearningCard to LearningPlan

```
/run grep -rn "getNextAction\|TodaysLearning\|PrimaryAction\|recommendation" app/\(student\)/dashboard/ components/home/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find app/api/student/learning-plan -type f 2>/dev/null
```

Add all files found. Then:

In `app/(student)/dashboard/page.tsx`, replace the `getNextAction(userId)` call with a call to `GET /api/student/learning-plan/today` (or import the service directly). The response shape is `{ item, fallback }`.

Map the response to the `recommendation` prop shape that `PrimaryActionCard` expects:
```typescript
const recommendation = planResult?.item
  ? {
      topicId: planResult.item.conceptId,
      topicTitle: planResult.item.concept?.name ?? planResult.item.conceptId,
      subject: planResult.item.concept?.subjectDef?.name ?? '',
      estimatedTimeMin: 20,
      weekNumber: planResult.item.weekNumber,
    }
  : legacyRecommendation // fallback from getNextAction
```

In `PrimaryActionCard`, when `recommendation` comes from the plan (i.e. `weekNumber` is present), show a subtle context line under the topic name:
```tsx
{recommendation.weekNumber && (
  <p className="text-xs text-gray-400">Week {recommendation.weekNumber} of your plan</p>
)}
```

When the plan exists but returns `{ item: null, fallback: false }` (student is ahead of plan this week), show:
```tsx
<div className="rounded-lg bg-green-50 dark:bg-green-950 px-4 py-3">
  <p className="text-sm font-medium text-green-800 dark:text-green-200">
    You're ahead of your plan this week! 🎉
  </p>
  <a href="/student/subjects" className="mt-2 text-xs text-green-700 underline">
    Study an extra topic
  </a>
</div>
```

Verify: dashboard CTA reads from LearningPlanItem when plan exists, falls back gracefully when no plan.
```

---

## TASK 10 — T35: ExamReadinessScore computation and API

```
/run grep -rn "BoardChapterWeight\|weightMarks\|readiness\|examReadiness" lib/ prisma/schema.prisma --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -30
/run find app/api/student -type d 2>/dev/null
/run find lib/student -type f -name "*.ts" 2>/dev/null | grep -v node_modules
```

Add all files found. Then:

**1. Computation function**

Create `lib/student/examReadiness.ts`:
```typescript
// computeReadinessScore(studentId, subjectId): Promise<ReadinessResult>
//
// Algorithm:
// 1. Load all ChapterDef for the subject, each with their BoardChapterWeight.weightMarks
// 2. Load StudentConceptState for all concepts in those chapters for this student
// 3. Per chapter:
//    - concepts = all concepts in this chapter
//    - conceptStates = states for this student in this chapter
//    - avgMastery = mean(masteryScore) across conceptStates
//      if no states for this chapter → avgMastery = 0
//    - weightedContribution = avgMastery × (chapter.weightMarks / totalWeightMarks)
// 4. readinessScore = Math.round(sum(weightedContribution) × 100)  → integer 0-100
// 5. totalWeightMarks = sum of all weightMarks for this subject
//
// Returns:
// {
//   score: number,           // 0-100 integer
//   label: string,           // 'critical' | 'needs_work' | 'on_track' | 'ready'
//   chapters: Array<{
//     chapterId, chapterName, masteryScore, boardWeightPct, contribution, status
//   }>
// }
// Never throws — returns { score: 0, label: 'critical', chapters: [] } on error
```

**2. API endpoint**

Create `app/api/student/readiness/[subjectId]/route.ts`:
```typescript
// GET — auth-guarded
// 1. Calls computeReadinessScore(userId, subjectId)
// 2. Caches result in Redis: key = `readiness:${userId}:${subjectId}`, TTL = 3600s
// 3. Returns full response per Domain 7 §7.8:
// {
//   subjectId, subjectName, overallScore, isCrunchMode,
//   chapters: [...], lastUpdatedAt
// }
// isCrunchMode = daysToExam <= 14 (get examDate from User or LearningPlan)
```

**3. Wire into SubjectReadinessCard**

In `components/student/dashboard/SubjectReadinessCard.tsx` (created in Task 7):
- Change from inline prop `score` to fetching from this API on mount using `useEffect` + `fetch`
- Or: fetch on the server in the dashboard page and pass as prop — server-side is preferred
- Dashboard page: add `computeReadinessScore` calls (one per subject) to the parallel fetch array

**4. Nightly pre-compute job**

In the scheduler, add a daily job at 3:00 AM IST:
```typescript
// For each student who had a session in the last 7 days:
// - computeReadinessScore for each of their subjects
// - cache result in Redis
// This warms the cache so dashboard loads are fast
```

Verify: readiness score reflects actual weighted chapter mastery. Score 0 for no-data student.
```

---

## TASK 11 — T37: DPDP Consent record

```
/run cat prisma/schema.prisma | grep -A3 "model User\b" | head -20
/run find app/api -type d | grep -v node_modules
/run find lib -type f -name "*.ts" | xargs grep -l "consent\|Consent" 2>/dev/null | grep -v node_modules
/run find app -path "*onboarding*" -o -path "*signup*" -o -path "*register*" 2>/dev/null | grep -v node_modules | grep -v ".next"
```

Add all files found. Then:

**IMPORTANT NOTE:** The consent copy text in this task is a legal placeholder. The code must be built now, but the consent screen must NOT be shown to real users until a lawyer has reviewed and approved the consent language. After implementing this task, set a flag `CONSENT_LIVE=false` in `.env.production` and gate the consent UI behind it. When the lawyer approves the copy, set `CONSENT_LIVE=true`.

**1. Schema**

Add to `prisma/schema.prisma`:
```prisma
model Consent {
  id          String       @id @default(cuid())
  userId      String
  scope       ConsentScope
  givenAt     DateTime     @default(now())
  ipAddress   String?
  userAgent   String?
  withdrawnAt DateTime?
  version     String       @default("1.0")
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, scope])
}

enum ConsentScope {
  DATA_PROCESSING
  AI_INTERACTION
  PARENT_NOTIFICATION
  MARKETING
}
```

Add `consents Consent[]` to the `User` model.

Run:
```
/run npx prisma migrate dev --name add_consent_record
/run npx prisma generate
```

**2. Service**

Create `lib/consent/check.ts`:
```typescript
export async function hasConsented(userId: string, scope: ConsentScope): Promise<boolean>
// Returns true if a non-withdrawn Consent row exists for user + scope
// Never throws — returns false on any error

export async function grantConsent(
  userId: string,
  scopes: ConsentScope[],
  meta: { ipAddress?: string; userAgent?: string; version?: string }
): Promise<void>
// Creates Consent rows for each scope, idempotent (upsert by userId+scope)
```

**3. API endpoints**

Create `app/api/consent/grant/route.ts` (POST):
```typescript
// Body: { scopes: ConsentScope[] }
// Reads IP from x-forwarded-for or request.ip
// Calls grantConsent
// Returns: { granted: true, scopes }
```

Create `app/api/consent/withdraw/route.ts` (POST):
```typescript
// Body: { scope: ConsentScope }
// Sets withdrawnAt = now() on matching row
// Returns: { withdrawn: true }
```

**4. Gate the tutor turn**

In `app/api/tutor/turn/route.ts`, after auth check:
```typescript
const canUseAI = await hasConsented(userId, 'AI_INTERACTION')
if (!canUseAI) {
  // Stream SSE error and return
  return streamError({ code: 'CONSENT_REQUIRED', message: 'AI interaction consent required', retryable: false })
}
```

**5. Consent UI** (gated behind CONSENT_LIVE env var — build it but do not show until lawyer approves)

Create `components/student/ConsentGate.tsx`:
- Full-screen overlay, renders only when `process.env.NEXT_PUBLIC_CONSENT_LIVE === 'true'`
- Shows the consent copy (placeholder below — REPLACE WITH LAWYER-REVIEWED TEXT)
- Two checkboxes, both required:
  - "I consent to Spinzy processing my academic data to personalise my learning"
  - "I consent to AI-generated tutoring responses during my sessions"
- "I agree" button — disabled until both checked
- "Learn more" link → privacy policy
- On agree: POST /api/consent/grant, then router.refresh()

Placeholder consent copy (must be replaced before going live):
```
Spinzy needs your consent to:
1. Process your academic data (grades, answers, progress) to personalise your learning.
2. Use AI to generate tutoring responses during your sessions.
You can withdraw consent at any time from Profile → Privacy Settings.
```

Verify: Consent model exists in DB. Grant endpoint creates rows. Tutor turn returns 403 when consent not given.
```

---

## TASK 12 — T38: Parent as distinct actor

```
/run cat prisma/schema.prisma | grep -A10 "model ParentStudent\|model ParentProfile\|parentId\|ParentLink" | head -40
/run find app -path "*parent*" -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find lib -path "*parent*" -type f 2>/dev/null | grep -v node_modules
/run grep -rn "role.*parent\|parent.*role" prisma/schema.prisma lib/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -10
```

Add all files found. Then:

**1. Schema** — only add `ParentProfile` if it does not already exist:
```prisma
model ParentProfile {
  id        String         @id @default(cuid())
  userId    String         @unique
  createdAt DateTime       @default(now())
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  children  ParentStudent[]
}
```

Add `parentProfile ParentProfile?` to the `User` model if not already there.

Run:
```
/run npx prisma migrate dev --name add_parent_profile
/run npx prisma generate
```

**2. Parent layout**

Create `app/(parent)/layout.tsx`:
```typescript
// Server component
// 1. Get session — if no session → redirect('/login')
// 2. If session.user.role !== 'parent' → redirect('/dashboard')
// 3. Render children — no student routes accessible from here
// Simple nav: logo + "My children" link + logout
```

**3. Parent dashboard page**

Create `app/(parent)/dashboard/page.tsx`:
```typescript
// Server component
// 1. Load all ParentStudent rows for this parent user
// 2. For each linked student: load name, grade, board, streak, sessions this week
// 3. For each student's subjects: compute readiness score (call computeReadinessScore)
// 4. Pass to ParentDashboard component
```

**4. ParentDashboard component**

Create `components/parent/ParentDashboard.tsx`:
```tsx
// One card per linked child showing:
//   - Name, Grade, Board
//   - Sessions this week (number)
//   - Current streak (fire emoji + count)
//   - Readiness rings per subject (reuse SubjectReadinessCard from Task 7)
//   - "View full report" link → /parent/progress/[studentId]
// Empty state: "No children linked yet"
//   CTA: "Link a child" → /parent/link-child
// Language: plain, no jargon, written for low-digital-literacy parent
// Read-only: no edit controls anywhere
// Mobile-first, dark: variants
```

**5. Child linking**

Create `app/api/parent/link-child/route.ts` (POST):
```typescript
// Body: { inviteToken: string }
// Validate token → find the student it belongs to
// Create ParentStudent row linking parent ↔ student
// Return: { linked: true, studentName }
```

Create `app/api/student/invite-parent/route.ts` (POST):
```typescript
// Auth-guarded (student only)
// Generates a short-lived invite token (store in Redis, 48h TTL)
// Returns: { inviteUrl: string }
// inviteUrl = https://[domain]/parent/accept-invite?token=[token]
```

Verify: parent with role='parent' lands on /parent/dashboard. Student routes inaccessible from parent layout.
```

---

## TASK 13 — T39: Parent progress API and weekly digest

```
/run find app/api/parent -type f 2>/dev/null | grep -v node_modules
/run find worker/services -type f -name "*.ts" 2>/dev/null | grep -v node_modules
/run find lib/mailer.ts lib/mailer -type f 2>/dev/null | grep -v node_modules
/run grep -rn "BullMQ\|Queue\|addJob\|scheduler" worker/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10
```

Add all files found. Then:

**1. Parent progress API**

Create `app/api/parent/progress/route.ts`:
```typescript
// GET — auth-guarded (parent role only)
// Returns the Domain 7 §7.10 contract shape exactly:
// {
//   children: Array<{
//     studentId, name, grade, board,
//     streakDays, sessionsThisWeek, studyTimeThisWeekMinutes,
//     subjects: Array<{
//       subjectId, subjectName, readinessScore, daysToExam,
//       recentMasteryChange  // delta over last 7 days — compute from StudentConceptState
//     }>,
//     recentAlerts: Array<{ type, message, occurredAt }>
//   }>
// }
// recentAlerts types: 'readiness_drop' (>10pt drop in 7 days), 'streak_break', 'milestone'
// studyTimeThisWeekMinutes: sum of session durations for this week
```

**2. Progress detail page**

Create `app/(parent)/progress/[studentId]/page.tsx`:
```typescript
// Server component — parent role required
// Verify the requested studentId is actually linked to this parent
//   (query ParentStudent to confirm) → 403 if not linked
// Load: sessions last 7 days, chapter mastery bars, recent test scores
// Render ParentProgressDetail component
// NO session transcript access — do not load any session message content
```

Create `components/parent/ParentProgressDetail.tsx`:
```tsx
// Sessions list: date, topic, duration, % correct — no transcript content
// Chapter mastery bars per subject (reuse SubjectReadinessCard)
// Read-only — no edit, no message, no interaction
```

**3. Weekly digest worker**

Create `worker/services/weeklyDigestWorker.ts`:
```typescript
// BullMQ repeatable job
// Schedule: every Sunday at 18:00 IST = cron '0 18 * * 0' with timezone 'Asia/Kolkata'
// For each parent with at least one linked child:
//   1. Load child data: sessions this week, mastery delta, streak
//   2. Call GPT-4o-mini to generate a 2-sentence AI narrative summary
//      Prompt: "Write a 2-sentence encouraging progress summary for a parent.
//               Student: [name], Sessions: [n], Top improvement: [subject].
//               Tone: warm, specific, no jargon."
//   3. Send email via lib/mailer.ts:
//      Subject: "[childName]'s learning update — week of [date]"
//      Body: sessions count, streak, readiness change, AI narrative
//      CTA link: https://[NEXTAUTH_URL]/parent/dashboard
// Register this job in the scheduler bootstrap
```

Verify: API returns correct shape for all linked children. Weekly job is registered in scheduler.
```

---

## TASK 14 — T26: DoubtKb table and dedup write

```
/run grep -rn "DoubtKb\|doubtKb\|doubt_kb" prisma/schema.prisma lib/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules
/run cat services/tutor/turn.ts 2>/dev/null | head -80 || find . -name "turn.ts" -path "*/tutor/*" | head -3
```

Add all files found. Then:

**1. Schema** — check if DoubtKb already exists in schema. If not, add:
```prisma
model DoubtKb {
  id                 String   @id @default(cuid())
  subjectId          String
  conceptId          String?
  questionText       String
  answerText         String
  embedding          Unsupported("vector(1536)")?
  timesServed        Int      @default(1)
  alternatePhrasings String[] @default([])
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@index([subjectId])
}
```

Run:
```
/run npx prisma migrate dev --name add_doubt_kb
/run npx prisma generate
```

**2. DoubtKb service**

Create `lib/ai/tutor/doubtKb.ts`:
```typescript
// lookupDoubt(questionText, subjectId): Promise<string | null>
//   - Embed questionText via getEmbedding() from lib/ai/embeddings.ts
//   - If embedding fails → return null (graceful)
//   - pgvector similarity search: 1 - (embedding <=> query_vec) > 0.92
//   - If hit: increment timesServed, return answerText
//   - If no hit: return null
//   - Never throws

// recordDoubt(questionText, answerText, subjectId, conceptId?): Promise<void>
//   - First check similarity at 0.88 threshold
//   - If near-duplicate found: update timesServed++, append to alternatePhrasings[]
//   - If novel: create new row with embedding
//   - Never throws — fire and forget (caller should not await this)
```

**3. Wire into orchestrator**

In `services/tutor/turn.ts` (or wherever the tutor turn orchestrator lives):

Before the LLM call, add doubt cache check (only for doubt/question turns — check the current stage/tag context):
```typescript
// Only for turns where student is asking a clarification doubt
// (detect: student message ends with '?' or contains doubt indicators)
const cachedAnswer = await lookupDoubt(studentMessage, subjectId)
if (cachedAnswer) {
  // stream the cached answer, set AITutorTurnLog.cached = true
  // skip LLM call
}
```

After LLM call (when not cached and it was a doubt turn):
```typescript
// Non-blocking — do not await
recordDoubt(studentMessage, llmResponse, subjectId, conceptId).catch(() => {})
```

Verify: repeated identical doubt returns cached answer. Novel doubts are stored.
```

---

## TASK 15 — T28: Explanation cache

```
/run find lib/ai/tutor -type f -name "*.ts" 2>/dev/null | grep -v node_modules
/run grep -rn "explanationCache\|cache:exp\|CORE_EXPLANATION\|WORKED_EXAMPLE" lib/ services/ --include="*.ts" 2>/dev/null | grep -v node_modules
/run cat lib/redis.ts 2>/dev/null | head -30 || find lib -name "redis.ts" | head -3
```

Add all files found. Then:

**1. Cache module** — check if `lib/ai/tutor/explanationCache.ts` exists. If not, create:
```typescript
// Redis key: cache:exp:{conceptId}:{lang}:{modality}
// TTL: 604800 seconds (7 days)

export async function getCachedExplanation(
  conceptId: string, lang: string, modality: string
): Promise<string | null>
// Returns cached content or null on miss/error. Never throws.

export async function setCachedExplanation(
  conceptId: string, lang: string, modality: string, content: string
): Promise<void>
// Silently no-ops on Redis error. Never throws.
// NEVER call this if the content came from outputSafety replacement.

export async function invalidateExplanation(
  conceptId: string, lang?: string, modality?: string
): Promise<void>
// Deletes the specific key or pattern. Never throws.
```

**2. Wire into orchestrator**

In the tutor turn orchestrator, for `CORE_EXPLANATION` and `WORKED_EXAMPLE` stages only:

Before LLM call:
```typescript
const modality = currentStage === 'CORE_EXPLANATION' ? 'text' : 'worked_example'
const lang = redisSessionState.lang ?? 'en'
const cached = await getCachedExplanation(conceptId, lang, modality)
if (cached) {
  // stream cached content
  // set AITutorTurnLog.cached = true
  // skip LLM call entirely
  return
}
```

After LLM call (only if outputSafety did NOT replace the response):
```typescript
if (!safetyTriggered) {
  await setCachedExplanation(conceptId, lang, modality, llmResponse)
}
// set AITutorTurnLog.cached = false
```

Verify: second explanation request for same concept/lang returns from cache. Safety replacements never cached.
```

---

## TASK 16 — T40: Redis-backed LLM circuit breaker

```
/run cat lib/redis.ts 2>/dev/null | grep -A20 "circuit\|failureCount\|circuitOpen" | head -40
/run cat lib/callLLM.ts 2>/dev/null | head -80 || find lib -name "callLLM.ts" | head -3
/run grep -rn "ANTHROPIC_API_KEY\|anthropic\|failover" lib/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10
```

Add all files found. Then:

**1. Redis-backed circuit breaker**

Create `lib/ai/tutor/circuitBreaker.ts`:
```typescript
// Redis keys:
//   cb:llm:failures  → integer count, TTL 30s (auto-expires, resets failure window)
//   cb:llm:open      → '1' when circuit is open, TTL 60s (auto-closes after 60s)
//
// All functions: never throw, return safe defaults on Redis error

export async function isCircuitOpen(): Promise<boolean>
// Returns true if cb:llm:open key exists in Redis

export async function recordFailure(): Promise<void>
// INCR cb:llm:failures with 30s TTL
// If count >= 3: SET cb:llm:open '1' EX 60

export async function recordSuccess(): Promise<void>
// DEL cb:llm:failures, DEL cb:llm:open
```

**2. Wire into callLLM.ts**

In `lib/callLLM.ts`, wrap the OpenAI call:
```typescript
// Before OpenAI call:
if (await isCircuitOpen()) {
  // Try Anthropic failover if key is set
  if (process.env.ANTHROPIC_API_KEY) {
    return await callAnthropic(messages, opts) // see below
  }
  throw new LLMError('AI_UNAVAILABLE', 'LLM circuit open')
}

// After successful OpenAI call:
await recordSuccess()

// In the catch block (OpenAI error):
await recordFailure()
throw err
```

**3. Anthropic failover function**

Add `callAnthropic(messages, opts)` to `lib/callLLM.ts`:
```typescript
// Uses @anthropic-ai/sdk if available, else throws AI_UNAVAILABLE
// Maps OpenAI message format to Anthropic format
// Model: claude-haiku-4-5 (fast, cheap, for failover only)
// Same streaming contract as OpenAI call
// On success: recordSuccess()
// On failure: throw LLMError('AI_UNAVAILABLE')
```

**4. Remove in-memory circuit breaker**

In `lib/redis.ts`, remove the in-memory `failureCount`, `circuitOpenUntil`,
`halfOpenProbeInFlight` variables. Keep the null-safe `getRedis()` function.
The Redis-backed breaker in `lib/ai/tutor/circuitBreaker.ts` replaces it.

Verify: 3 simulated OpenAI failures → `isCircuitOpen()` returns true across multiple calls.
```

---

## TASK 17 — T41: Staged rollout via StudentFeatureFlag

```
/run grep -rn "StudentFeatureFlag\|isAiTutorGlobal\|ENABLE_AI_TUTOR\|rollout" lib/ app/api/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
/run find app/api/tutor -type f -name "route.ts" 2>/dev/null | grep -v node_modules
```

Add all files found. Then:

**1. Rollout function**

Create `lib/features/rollout.ts`:
```typescript
/**
 * Determines if a student should have AI tutor access based on:
 * 1. Global kill switch (ENABLE_AI_TUTOR env var)
 * 2. Per-user StudentFeatureFlag override
 * 3. Percentage-based rollout via stable hash
 */
export async function isInAITutorRollout(userId: string): Promise<boolean> {
  // Step 1: Global kill switch
  if (process.env.ENABLE_AI_TUTOR !== 'true') return false

  // Step 2: Check StudentFeatureFlag for explicit override
  const flag = await prisma.studentFeatureFlag.findUnique({
    where: { studentId_feature: { studentId: userId, feature: 'AI_TUTOR' } }
  }).catch(() => null)
  if (flag !== null) return flag.enabled

  // Step 3: Stable hash-based rollout
  const pct = parseInt(process.env.ROLLOUT_PERCENTAGE ?? '5', 10)
  const hash = djb2Hash(userId) % 100
  return hash < pct
}

// djb2 hash — deterministic, no external deps
function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // convert to 32-bit integer
  }
  return Math.abs(hash)
}
```

**2. Replace isAiTutorGloballyEnabled**

In every file that calls `isAiTutorGloballyEnabled()` or checks `ENABLE_AI_TUTOR` directly:
- Replace with `await isInAITutorRollout(userId)`
- When `isInAITutorRollout` returns false: render the existing v1 session UI silently — no error shown to student

**3. Add ROLLOUT_PERCENTAGE to ecosystem.config.cjs**

In all 3 PM2 app blocks, add:
```javascript
ROLLOUT_PERCENTAGE: process.env.ROLLOUT_PERCENTAGE ?? '5',
```

**4. Script for per-user overrides**

Create `scripts/set-rollout.cjs`:
```javascript
// Usage:
//   node scripts/set-rollout.cjs --user userId --enabled true
//   Sets a StudentFeatureFlag row for that user
// Reads DATABASE_URL from .env.production or env
```

Verify: at ROLLOUT_PERCENTAGE=5, ~5% of random user IDs get true. ENABLE_AI_TUTOR=false still blocks all.
```

---

## TASK 18 — T42: Daily cost metric and alert

```
/run find worker/services -type f -name "*.ts" 2>/dev/null | grep -v node_modules
/run grep -rn "AITutorTurnLog\|costUsd\|reportingWorker" lib/ worker/ prisma/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v node_modules | head -10
/run cat lib/mailer.ts 2>/dev/null | head -30 || find lib -name "mailer.ts" | head -3
/run grep -rn "scheduler\|addRepeat\|cron\|registerJob" worker/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -10
```

Add all files found. Then:

**1. Schema**

Add to `prisma/schema.prisma`:
```prisma
model DailyCostMetric {
  id             String   @id @default(cuid())
  date           DateTime @unique
  sessions       Int
  totalCostUsd   Float
  costPerSession Float
  createdAt      DateTime @default(now())
}
```

Run:
```
/run npx prisma migrate dev --name add_daily_cost_metric
/run npx prisma generate
```

**2. Reporting worker**

Create `worker/services/costReportingWorker.ts`:
```typescript
// BullMQ repeatable job — cron '0 6 * * *' timezone 'Asia/Kolkata' (6:00 AM IST daily)
// 
// Query yesterday's AITutorTurnLog:
//   SELECT DATE(createdAt), COUNT(DISTINCT sessionId), SUM(costUsd)
//   WHERE createdAt >= yesterday 00:00 IST AND createdAt < today 00:00 IST
//
// Compute: costPerSession = totalCostUsd / sessions (0 if sessions = 0)
//
// Upsert DailyCostMetric row for yesterday's date
//
// Alert condition: costPerSession > 0.003 (USD) — this is ~₹0.25
//   Send alert email via lib/mailer.ts to process.env.ONCALL_EMAIL
//   Subject: "⚠️ Spinzy AI cost alert: ₹[X] per session on [date]"
//   Body: date, sessions count, total cost USD, cost per session USD + INR equivalent
//
// Log result regardless: { date, sessions, totalCostUsd, costPerSession }
```

**3. Register in scheduler**

In the worker scheduler bootstrap file, register this job alongside existing scheduled jobs.

Verify: DailyCostMetric model exists. Worker is registered. Alert fires when threshold exceeded.
```

---

## TASK 19 — B4: Fix PM2 env_production warning

```
/run cat ecosystem.config.cjs
```

Add the file. Then:

In `ecosystem.config.cjs`, for each of the 3 app definitions (`ai-tutor-web`, `content-engine-worker`, `ai-tutor-scheduler`):

Add an `env_production` block immediately after the existing `env` block. It must contain the same keys as the `env` block plus `NODE_ENV: 'production'`:

```javascript
env_production: {
  NODE_ENV: 'production',
  // copy all keys from the env block exactly
}
```

Also in `scripts/deploy-and-run.sh`, find the `pm2 start ecosystem.config.cjs` command and change it to:
```bash
pm2 start ecosystem.config.cjs --env production
```

Do the same for any `pm2 reload` or `pm2 restart` commands that reference `ecosystem.config.cjs`.

Verify: no `[PM2][WARN] Environment [production] is not defined` in deploy output.
```

---

## TASK 20 — T43 prep: Distress detection (code only, flag stays false)

```
/run find lib/ai/tutor -type f -name "*.ts" 2>/dev/null | grep -v node_modules
/run find worker/services -type f -name "*.ts" 2>/dev/null | grep -v node_modules
/run grep -rn "ENABLE_DISTRESS\|distress\|SafetyEvent" lib/ app/api/ worker/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20
```

Add all files found. Then:

**CRITICAL:** `ENABLE_DISTRESS_DETECTION` in `.env.production` must remain `false` after this task. This task only prepares the code. The flag is flipped only after: (1) on-call alias is defined in `ONCALL_EMAIL`, (2) the flow is tested end-to-end on staging, (3) Manish personally approves.

**1. Detection function**

Create `lib/ai/tutor/distress.ts` (if it does not exist):
```typescript
export interface DistressResult {
  detected: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  triggerPhrases: string[]
  suggestedResponse: string
}

export function detectDistress(studentMessage: string): DistressResult
// Pure function, no I/O, never throws
//
// Keyword categories (check case-insensitive):
// CRITICAL: 'want to disappear', 'wish i was dead', 'end my life', 'self harm', 'hurt myself'
// HIGH: 'worthless', 'hopeless', 'nobody cares about me', 'no point', 'give up on life'
// MEDIUM: 'hate myself', 'i give up', "can't do anything right", 'always failing'
// LOW: 'so stressed', 'want to cry', 'this is too hard' (normal study frustration — detected but low)
//
// suggestedResponse for CRITICAL/HIGH:
//   "I hear you, and I'm glad you're talking to me. What you're feeling matters.
//    Please talk to someone you trust — a parent, teacher, or counsellor — about this.
//    You don't have to carry this alone. 💙"
//
// suggestedResponse for MEDIUM/LOW:
//   "It sounds like you're having a tough time. That's completely okay —
//    learning is hard sometimes. Want to take a short break and come back to this?"
//
// Write 10 unit tests in tests/unit/lib/ai/tutor/distress.test.ts:
//   - CRITICAL trigger → correct severity
//   - HIGH trigger → correct severity
//   - MEDIUM trigger → correct severity
//   - "this is so hard" → LOW (not CRITICAL — normal frustration)
//   - "what is the answer" → not detected
//   - empty string → not detected, no throw
//   - mixed message with one trigger → detected at correct severity
//   - case insensitive match
//   - message with no keywords → detected=false
//   - suggestedResponse present when detected=true
```

**2. Notification worker**

Create `worker/services/distressNotificationWorker.ts`:
```typescript
// BullMQ job — queue name: 'distress-notification'
// Job payload: { studentId, sessionId, severity, triggerPhrases, studentMessage }
//
// If ENABLE_DISTRESS_DETECTION !== 'true':
//   log 'distress notification skipped (flag off)' and return
//
// If ENABLE_DISTRESS_DETECTION === 'true':
//   1. Create SafetyEvent row: type='DISTRESS', severity, studentId, sessionId
//   2. Look up parent for student (via ParentStudent relation)
//   3. If no parent linked:
//      - Update SafetyEvent with resolution note: 'no_parent_linked_admin_review_required'
//      - Log CRITICAL — admin must review
//      - Return (never fail the student-facing response)
//   4. If parent linked:
//      - Send email via lib/mailer.ts to parent email
//      - Subject: "Important: [childName] may need support"
//      - Body: warm, does not quote the student's message verbatim, gives support resources
//        Include: iCall helpline 9152987821, Vandrevala Foundation 1860-2662-345
//
// Never throws — catch all errors and log
```

**3. Wire into orchestrator** (behind flag check)

In the tutor turn orchestrator, after `checkInputSafety` and before the LLM call:
```typescript
if (process.env.ENABLE_DISTRESS_DETECTION === 'true') {
  const distressResult = detectDistress(redactedMessage)
  if (distressResult.detected) {
    // Non-blocking enqueue
    enqueueDistressNotification({
      studentId, sessionId, turnId,
      severity: distressResult.severity,
      triggerPhrases: distressResult.triggerPhrases,
      studentMessage: redactedMessage, // already PII-redacted
    }).catch(() => {})

    // Override the AI response with the supportive message
    if (distressResult.severity === 'CRITICAL' || distressResult.severity === 'HIGH') {
      // Stream distressResult.suggestedResponse directly, skip LLM call
      return streamSupportiveResponse(distressResult.suggestedResponse)
    }
    // For LOW/MEDIUM: let the normal LLM call proceed but inject context
  }
}
```

Run tests:
```
/run npx jest tests/unit/lib/ai/tutor/distress.test.ts
```

All 10 tests must pass. `ENABLE_DISTRESS_DETECTION` remains `false` in `.env.production`.
```

---

## EXECUTION ORDER

```
Phase 1 — Gates (Week 1): Tasks 1 → 2 → 3 → 4 → 5 → 6
Phase 2 — Dashboard (Week 2–3): Tasks 7 → 8 → 9 → 10
Phase 3 — Parent (Week 3–4): Tasks 11 → 12 → 13
Phase 4 — Reliability (Week 4–5): Tasks 14 → 15 → 16 → 17 → 18 → 19 → 20
Phase 5 — V2 UI Migration (Week 5–7): Tasks 21 → 22 → 23 → 24 → 25 → 26 → 27
```

## GATE BETWEEN EVERY TASK (non-negotiable)

```bash
npm run build:workers && npm run build && npm test
# All green → commit → next task
# Any red → paste error into Aider, fix in same session, re-run gate
```

---

## PHASE 5 — V2 UI MIGRATION

These tasks replace the existing v1 UI with the v2 wireframe design.
Do these AFTER Phase 4 is complete — the backend data must be wired before the UI rebuild.

Global rules for every task in this phase:
- Mobile-first: default styles target 360px. sm: = 640px. md: = 768px. Never desktop-first.
- Min touch target: 44×44px on all interactive elements (min-h-[44px] min-w-[44px])
- All async widgets: loading skeleton + error state + empty state + populated state
- dark: Tailwind variants on every component
- No inline styles — Tailwind classes only
- Streak break copy: never use "broke", "missed", "failed", "lost"
- Brand colour: #534AB7 (indigo/purple). Use this for primary buttons and active states.

---

### TASK 21 — V2 Dashboard: full rebuild

```
/run find app/\(student\)/dashboard components/home components/student/dashboard -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components -name "EngagementSection*" -o -name "PrimaryAction*" -o -name "WeeklyStudy*" -o -name "NudgeBanner*" -o -name "WeakTopics*" -o -name "UpcomingTopics*" -o -name "HomeworkPending*" 2>/dev/null | grep -v node_modules
/run cat app/\(student\)/dashboard/page.tsx 2>/dev/null | head -60

Read all files found. This task rebuilds the student dashboard to match the v2 spec exactly.

SECTION ORDER (top to bottom, single column mobile, two-column desktop):
1. Topbar — logo left, streak badge (🔥 N days) + level badge (Lv N) + avatar right
2. TodaysLearningCard — topic name, subject badge, duration chip, single CTA "Start today's session"
3. XPWidget — "XP this week: N", level progress bar, "N XP to level N+1"
4. WeeklyStudyStrip — Mon–Sun dots, today highlighted teal, filled purple for completed days, goal text
5. RevisionWidget — "You're all caught up ✓" (green card) OR "N cards due today" with inline list
6. SubjectReadinessSection — one SubjectReadinessCard per subject (score ring + progress bar)
7. WeakTopicsSection — hidden until 3+ sessions completed, max 2 topics, shown as cards
8. UpcomingTopicsList — next 3 topics from LearningPlan, simple list rows

DESKTOP LAYOUT (md: breakpoint):
- Left column (60%): sections 1, 2, 3, 4, 5
- Right column (40%): sections 6, 7, 8

TOPBAR:
- Streak badge: orange pill "🔥 N days" — read from studentStreak.current
- Level badge: purple pill "Lv N" — read from user.level
- Avatar: initials circle using user.name first letter
- On mobile: topbar is sticky

TODAYSLEARNINGCARD (replaces PrimaryActionCard):
- Read from GET /api/student/learning-plan/today
- Show: topic name (large), subject badge (purple), duration chip (grey)
- Purple left border accent: border-l-4 border-[#534AB7]
- CTA button: full-width, "Start today's session" → /student/session/[conceptId]
- If recommendation=null and no diagnostic: show onboarding checklist (already built in Task 6)
- If plan exists but no item today: "You're ahead of your plan this week! 🎉" + secondary CTA

WEEKLYSTRIP:
- 7 dots Mon–Sun in a grid
- Filled purple (#534AB7) for days with completed sessions
- Teal border (today) with #1D9E75 border
- Empty grey for future/missed days
- Below: "N of N sessions done · N days left" in muted text
- Goal from studentLearningProfile.studyDaysPerWeek (default 5)

SUBJECTREADINESSSECTION:
- Use SubjectReadinessCard from Task 7
- If score=0 and no diagnostic: empty state CTA "Take diagnostic"
- Tap card → /student/progress/[subjectId]

Remove completely from the codebase (delete files, remove imports):
- components/home/PrimaryActionCard.tsx (replaced by TodaysLearningCard)
- components/home/NudgeBanner.tsx (replaced by inline logic)
- components/home/EngagementSection.tsx (split into separate widgets above)
- components/home/UpcomingTopicsList.tsx (rebuilt below as simpler component)
- components/home/WeakTopicsSection.tsx (rebuilt inline)
- components/home/HomeworkPendingCard.tsx (rebuild inline or keep as-is)

Before deleting any file, grep for all imports of that file and remove them.

Run npm run build && npm test. Report every file created, modified, deleted.
```

---

### TASK 22 — V2 Navigation: bottom nav bar + topbar

```
/run find components -name "*Nav*" -o -name "*Header*" -o -name "*Topbar*" -o -name "*navbar*" 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find app/\(student\) -name "layout.tsx" 2>/dev/null | grep -v node_modules
/run grep -rn "Learning Path\|Doubts\|nav\|navbar\|header" app/\(student\)/layout.tsx components/ --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20

Read all files found. This task replaces the existing top navigation with a v2 mobile-first bottom nav + slim topbar.

REMOVE the existing top navigation bar that shows:
"Home | Learning Path | Doubts | Profile" as horizontal links

REPLACE with two separate components:

1. TOPBAR (slim, ~44px height):
Create components/student/layout/Topbar.tsx:
- Left: Spinzy logo (text "Spinzy" in brand colour or SVG if exists)
- Right: streak badge + level badge + avatar (same as Task 21 topbar)
- Sticky: position sticky top-0 z-50 bg-white dark:bg-gray-950 border-b
- No nav links in topbar — navigation is in bottom bar

2. BOTTOM NAV BAR (mobile primary navigation):
Create components/student/layout/BottomNav.tsx:
- Fixed bottom, full width, safe-area-inset-bottom for iOS
- 4 items:
  Home (⌂) → /dashboard — active when path starts with /dashboard
  Learn (📚) → /learn — active when path starts with /learn or /session
  Doubts (❓) → /doubts — active when path starts with /doubts
  Profile (👤) → /profile — active when path starts with /profile
- Active item: icon + label in #534AB7
- Inactive: icon + label in grey
- Each item: min-h-[44px], tap area covers full cell width
- Hidden on md: and above (desktop uses sidebar or top nav)
- Background: white dark:bg-gray-950, border-top

3. On DESKTOP (md: and above):
- Show topbar only
- Show a simple sidebar or keep horizontal links in topbar
- Bottom nav hidden

Wire both into app/(student)/layout.tsx:
- Topbar renders at top
- BottomNav renders at bottom (fixed)
- Main content: pb-16 on mobile to avoid overlap with bottom nav

Run npm run build && npm test. Report changes.
```

---

### TASK 23 — V2 Pre-session screen

```
/run find app/\(student\)/session -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components -name "*PreSession*" -o -name "*pre-session*" 2>/dev/null | grep -v node_modules
/run grep -rn "prereq\|prerequisite\|pre.session\|beforeSession" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20

Read all files found. This task builds the v2 PreSessionScreen.

CREATE app/(student)/session/pre/[conceptId]/page.tsx:

Server component:
1. Load concept by conceptId: name, subject, chapter, estimatedMinutes
2. Load prerequisite concepts + their StudentConceptState.masteryScore for this student
3. Fire prefetch in background (non-blocking):
   fetch('/api/tutor/session/prefetch', { method: 'POST', body: { conceptId } })
4. Render PreSessionScreen component

CREATE components/student/session/PreSessionScreen.tsx:
- Full-screen on mobile, centred card max-w-[480px] on desktop
- Subject badge (purple pill) top
- Topic name: large, font-size ~20px, font-weight 500
- Sub-title: chapter name
- Chips row: "~N min" + "7 stages" + "N marks · board exam"
- Divider
- Prerequisites section:
  Each prerequisite as a pill:
    masteryScore >= 0.7 → green pill "TopicName ✓"
    masteryScore 0.4–0.69 → amber pill "TopicName ~"
    masteryScore < 0.4 → red pill "TopicName ✗"
  If any amber/red: amber warning banner "Some prerequisites are incomplete. Vidya will help you catch up."
  If all green or no prereqs: no banner
- Prereq pills load async — show skeleton pills while loading (CTAs always visible)
- CTAs:
  Primary: "Start session" → POST /api/tutor/session/start → redirect to /student/session/[sessionId]
  Secondary (only if unmet prereqs): "Study prerequisites first" → navigate to lowest-mastery prereq
- Footer note: "Vidya is already preparing your first question" (small grey text)
- Mobile: full-screen, large tap targets
- dark: variants throughout

ReplaceInterruptedSessionSheet trigger:
When navigating to pre-session and an incomplete Redis session < 24h exists for this concept:
- Show InterruptedSessionSheet as a bottom sheet BEFORE showing PreSessionScreen
- If exists: create components/student/session/InterruptedSessionSheet.tsx:
  Bottom sheet (slides up from bottom, not a modal):
  - Drag handle at top
  - "You left mid-session" title
  - "You were in [stage] — stage N of 7, about N minutes in."
  - Three large tappable rows:
    ▶ "Resume from where I left off" → POST /api/tutor/session/start { resumeMode: 'resume' }
    ↺ "Restart this topic" → POST /api/tutor/session/start { resumeMode: 'restart' }
    → "Skip to next topic" → PATCH /api/student/learning-plan/[itemId] { status: 'DEFERRED' } → /dashboard
  - Cannot dismiss by tapping outside — student must choose
  - Height: auto up to 60vh

Run npm run build && npm test. Report changes.
```

---

### TASK 24 — V2 Diagnostic page

```
/run find app/\(student\) -path "*diagnostic*" -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components -name "*Diagnostic*" -o -name "*diagnostic*" 2>/dev/null | grep -v node_modules
/run grep -rn "diagnostic\|DIAGNOSTIC" app/api/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20

Read all files found. This task builds the diagnostic page — the most critical missing page.
Without it, the diagnostic gate redirects to a dead end.

CREATE app/(student)/diagnostic/[subjectId]/page.tsx:

Server component:
1. Load subject by subjectId
2. Load up to 20 questions for this subject, varied by chapter, ordered by irt_b ascending
   (easiest first — adaptive starts easy then adjusts)
3. Check if a partial diagnostic exists in Redis for this student+subject (24h TTL)
4. If partial: load saved state and resume from last answered question
5. Pass to DiagnosticFlow component

CREATE components/student/diagnostic/DiagnosticFlow.tsx (client component):
- Full-screen, distraction-free — NO nav bar, NO bottom nav during active test
  Achieve this by passing a prop to the layout or using a separate layout
- Progress bar top: "Question N of ~20" + filled bar
- Timer top-right: countdown from 30:00 in mm:ss format
  At 2:00 remaining: timer turns amber, small warning text appears
  At 0:00: auto-save and call submitDiagnostic()
- Subject name + chapter badge
- One question at a time:
  Question text (readable, 14-16px, good line-height)
  MCQ options: each option min-h-[52px], full width, tap to select, selected = purple border + bg
  No back button — forward only
- Bottom: "Next question" button (disabled until option selected)
  + "Save and continue later" text link (saves to Redis, redirects to /dashboard)
- On last question: button changes to "Submit diagnostic"
- Abandon guard: if student tries to navigate away mid-diagnostic, show confirmation:
  "Save progress and leave?" / "Abandon (progress will be lost)"

AFTER SUBMISSION — Knowledge Map Results:
Replace the diagnostic page with a results screen (same route, different state):
- Title: "Your knowledge map"
- Subtitle: "Here's where you stand in [Subject] — no score, just your starting point."
- "Start here" card: highlighted with purple left border, shows weakest chapter
- Chapter list: each chapter as a card row with name + marks + badge (Strong/Partial/Needs work)
  Colour coding:
    avgMastery > 0.7 → green badge "Strong"
    avgMastery 0.4–0.7 → amber badge "Partial"
    avgMastery < 0.4 → red badge "Needs work"
- NEVER show a numeric score — colour bands only
- Single CTA: "Start learning" → /dashboard

CREATE app/api/student/diagnostic/submit/route.ts (POST):
- Body: { subjectId, answers: Array<{ questionId, selectedOption, timeSpentMs }> }
- For each answer: create AnswerEvent row
- Enqueue diagnosticBootstrapWorker job (which seeds StudentConceptState + generates LearningPlan)
- Clear Redis partial diagnostic state
- Return: { success: true, subjectId }

CREATE app/api/student/diagnostic/save-partial/route.ts (POST):
- Body: { subjectId, answers: Array<{ questionId, selectedOption }>, currentIndex: number }
- Save to Redis: key = diagnostic:partial:{studentId}:{subjectId}, TTL 86400s
- Return: { saved: true }

Run npm run build && npm test. Report every file created.
```

---

### TASK 25 — V2 Session completion screen rebuild

```
/run find components/student/session -type f 2>/dev/null | grep -v node_modules
/run find app/\(student\)/session -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run grep -rn "SessionCompletion\|session.*complete\|XPAnimation\|levelUp" components/ app/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20

Read all files found. This task rebuilds the SessionCompletionScreen to match the v2 spec exactly.

REBUILD components/student/session/SessionCompletionScreen.tsx:

Layout: full-screen scrollable, top → bottom:

1. CELEBRATION HEADER:
   - Large celebration emoji or CSS confetti burst
   - "Session complete!" heading
   - Sub-text: "[topic name] · N min"

2. XP ANIMATION SECTION:
   - XP circle: circular div with purple border, "+N XP earned" inside
   - Level progress: if leveledUp → show LEVEL UP OVERLAY first (see below)
   - Progress bar from previous XP to new XP, animates on mount using requestAnimationFrame
   - Counter ticks up from old total to new total over 800ms (easeOut)
   - "Level N → N+1" or "Level N" if no level up
   - "NNN / MMMM XP to level N+1"

3. LEVEL UP OVERLAY (if leveledUp=true):
   - Full-screen overlay renders FIRST before stats are visible
   - Cannot be skipped — minimum 1.5s display
   - After 3s or tap: overlay dismisses, stats become visible
   - Content: "🎉 Level N!" large text, confetti burst animation (CSS keyframes)

4. STATS ROW — 4 chips in a grid:
   - Questions attempted | % correct | Hints used | Minutes

5. MASTERY DELTA — only concepts touched in this session (max 5):
   - Each row: concept name + "N% → N% ↑" in green if improved
   - Background: grey surface card

6. AI INSIGHT CARD:
   - Loading skeleton (animate-pulse) for up to 3s while GPT-4o-mini generates
   - When ready: "Vidya's insight" label + generated text
   - Fallback if null or error: "Great session! Keep building on this momentum."
   - The insight must be session-specific — call POST /api/student/session/[sessionId]/insight if not already in response

7. STAR RATING:
   - "How was this session?" label
   - 5 star icons, tap to select, brief scale animation on tap
   - Optional — CTA unlocks after rating OR after 5s timeout
   - On tap: POST /api/student/session/[sessionId]/rate { rating }

8. CTAs:
   - Primary: "Start next session" → navigate to next LearningPlanItem conceptId
   - Secondary: "Back to dashboard" → /dashboard
   - Both disabled while level-up overlay is showing

All animations use CSS keyframes or requestAnimationFrame — no external libraries required.
dark: variants throughout. Mobile: no pinch-zoom (touch-action: manipulation on root).

Run npm run build && npm test. Report changes.
```

---

### TASK 26 — V2 AI Tutor chat panel rebuild

```
/run find components/student/session -name "*Chat*" -o -name "*Tutor*" -o -name "*chat*" 2>/dev/null | grep -v node_modules
/run find app/\(student\)/session -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run cat components/student/session/AITutorChatPanel.tsx 2>/dev/null | head -80

Read all files found. This task rebuilds the AITutorChatPanel to match the v2 spec exactly.

REBUILD components/student/session/AITutorChatPanel.tsx:

LAYOUT: full-height flex column
- Top: stage strip (scrollable horizontal) + session header
- Middle: chat history (flex-1, overflow-y-auto, scroll-to-bottom on new message)
- Bottom (sticky): hint bar + input bar (never obscured by keyboard)

SESSION HEADER:
- Topic name (truncated if long)
- Current stage badge (purple pill): "Hook" / "Core Explanation" / "Guided Practice" etc.
- No back button during active session

STAGE STRIP (horizontal scrolling row below header):
- 7 chips for the 7 stages
- Done stages: green chip (bg-green-50 text-green-800)
- Active stage: purple chip (bg-[#534AB7] text-white)
- Pending stages: grey chip (bg-gray-100 text-gray-400)
- Chips: rounded-full, text-xs, px-2 py-1, non-interactive
- Strip: overflow-x-auto, hide scrollbar, no-wrap

CHAT HISTORY:
- AI messages: left-aligned, grey bubble (bg-gray-100 dark:bg-gray-800)
  Max-width 85% on mobile. Border-radius: 4px 12px 12px 12px
  Small "Vidya" label above first message in a sequence (text-xs text-gray-400)
- Student messages: right-aligned, purple bubble (bg-[#534AB7] text-white)
  Max-width 75%. Border-radius: 12px 4px 12px 12px
- AI TYPING INDICATOR: while SSE stream is open + no tokens received yet:
  Three animated dots in a grey bubble (bounce animation, staggered delay)
  Immediately replaced by streaming text on first token
- STREAMING TEXT: text appended character-by-character
  Cursor blink (| character, 500ms interval) at end of in-progress message
- Message appear animation: fade-in + translateY(8px → 0), 150ms
- Machine tags STRIPPED: [QUESTION], [STAGE_ADVANCE], [VALIDATE] etc never shown
- Auto-scroll to bottom on new message, smooth scroll
- Stage transition divider: when stage changes, show subtle divider:
  "— Moving to Guided Practice —" (text-xs text-gray-400 text-center, 400ms fade)

INACTIVITY TIMER:
- After 90s of no student input: pulsing prompt appears above input bar
  "Still working on it? Want a hint?" with Yes / No buttons
- Yes → sends hint request message automatically
- No → dismisses, resets timer
- Auto-dismisses if student starts typing

HINT BAR (between chat and input, hidden during Explanation stages):
- "Hints: N / 3" left
- "Get a hint" button right (text-[#534AB7])
- After 3 hints: button disabled, text changes to "No hints remaining"
- Hidden completely during HOOK, PREREQ_BRIDGE, CORE_EXPLANATION, WORKED_EXAMPLE stages

INPUT BAR (sticky bottom):
- padding-bottom: env(safe-area-inset-bottom) for iOS
- Textarea (auto-resize, max 4 lines): placeholder "Type your answer..."
- Send button: circular, bg-[#534AB7], arrow icon, 44×44px min
- Disabled while SSE stream is open (streaming in progress)
- Never lose typed text on reconnect

SSE ERROR STATE:
- If SSE drops: inline banner above input "Connection lost — reconnecting..." with spinner
- On reconnect: re-deliver last AI message, resume
- After 3 failed retries: "Connection failed. Refresh to continue." with refresh button

FEATURE FLAG:
- If isAITutorEnabled=false: render null (existing session UI shows instead)

Run npm run build && npm test. Report every change.
```

---

### TASK 27 — V2 Registration + onboarding flow

```
/run find app/\(auth\) app/auth app/login app/register app/signup app/onboarding -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find app/\(student\)/onboarding -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components -name "*Onboard*" -o -name "*Register*" -o -name "*Login*" -o -name "*Auth*" 2>/dev/null | grep -v node_modules | head -20
/run find app -name "page.tsx" | xargs grep -l "signIn\|register\|onboard" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -10

Read all files found. This task rebuilds the registration and onboarding UI to match the v2 wireframe.

REGISTRATION PAGE (whatever route handles sign-in/register):
Rebuild to match wireframe Screen 1:
- Spinzy logo (initials circle, purple background) centered top
- "Welcome to Spinzy" heading
- "AI home tutor · CBSE Grades 6–12" subtext
- "Continue with Google" button: white bg, purple border + text, Google icon
- Divider: "or"
- Mobile number input (numeric keyboard: inputMode="numeric")
- Age input (numeric, inputMode="numeric") — collected at registration, not separately
- "Send OTP" primary button
- Terms text: "By continuing you agree to our Terms & Privacy Policy" — visible inline, not hidden
- No other links, no email option
- Mobile-first, full-screen on mobile, max-w-sm centered on desktop

ONBOARDING FLOW (profile setup — wireframe Screen 3):
Rebuild components/student/onboarding/ProfileSetupForm.tsx:
- Progress bar: N of 4 complete
- Checklist sidebar: Board ✓, Class ✓, Medium ○, Subjects ○ (visual progress)
- STEP: Board selector — card grid: CBSE, ICSE, State Board options
- STEP: Class selector — number grid 6–12, selected = purple border
- STEP: Medium — "English" / "Hindi" two large tap targets
- STEP: Subjects — grid of subjects, checkboxes, locked core subjects pre-selected
  "Maths & Science are mandatory for CBSE Grade 10" note
  Max 6 subjects enforced
- "Continue" button advances to next step
- Grade is shown as read-only "locked after save" text once set
- No back button, no close

EXAM DATE CAPTURE (wireframe Screen 4 — new screen after profile setup):
CREATE app/(student)/onboarding/exam-date/page.tsx:
- "When is your board exam?" heading
- Date input: text input, placeholder "e.g. 15 March 2027"
- Study days per week: row of number buttons 3/4/5/6/7, selected = purple
- Live coverage estimate: "With N days/week and N weeks — we'll cover all chapters with time for N revision rounds"
  Update this text reactively as user changes the days input
- "Build my learning plan" primary CTA → calls generateLearningPlan + redirect to /student/diagnostic/[firstSubjectId]
- "No upcoming exam — set a 6-month plan" secondary CTA → same but with null examDate

Run npm run build && npm test. Report every file created/modified/deleted.
```

---

---

## PHASE 6 — MISSING V2 FEATURES (not covered in Phases 1–5)

These complete the V2 feature set. Do after Phase 5.

---

### TASK 28 — Subscription upgrade flow V2

```
/run find app -path "*subscription*" -o -path "*payment*" -o -path "*upgrade*" -o -path "*plan*" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "learning-plan"
/run find components -name "*Payment*" -o -name "*Subscription*" -o -name "*Upgrade*" -o -name "*Plan*" 2>/dev/null | grep -v node_modules
/run grep -rn "razorpay\|Razorpay\|PlanSelector\|PaymentMethod" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20

Read all files found. This task rebuilds the subscription upgrade flow to match the v2 wireframe (Screen 11).

The complete flow is:
FreemiumUpgradeGate → PlanSelector → PaymentMethodSelector → PaymentConfirmation → Razorpay → Success/Failure

1. PLAN SELECTOR (components/student/subscription/PlanSelector.tsx):
Three plan rows:
  Monthly: ₹99/month — "₹99 + GST ₹17.82"
  Quarterly: ₹89/month billed ₹267 — "Save 10%" — featured: border-2 border-[#534AB7] + "Most popular" badge
  Annual: ₹74/month billed ₹891 — "Save 25%"
Featured plan: 2px border (ONLY exception to 0.5px border rule)
Selected plan: stored in local state, highlighted

2. PAYMENT METHOD SELECTOR (components/student/subscription/PaymentMethodSelector.tsx):
UPI listed FIRST (India-first):
  UPI: "GPay · PhonePe · Paytm" — pre-selected
  Debit/Credit card
  Net banking
Each option: radio-style row, 44px min height

3. PAYMENT CONFIRMATION (components/student/subscription/PaymentConfirmation.tsx):
Shows before Razorpay opens:
  Plan name + monthly equivalent
  GST breakdown: base + 18% GST = total
  Renewal date
  "Cancel anytime" text
  Terms paragraph (scrollable)
  "Confirm & pay ₹N" button — LOCKED until user has scrolled to bottom of terms
  Use IntersectionObserver on a sentinel div at bottom of terms to unlock button
  Must NOT reference referral programme anywhere

4. RAZORPAY INTEGRATION:
  POST /api/student/subscription/order → returns Razorpay orderId + amount
  Open Razorpay checkout with correct prefill (name, email, contact)
  On payment success: POST /api/student/subscription/verify → verify signature → update subscription
  On success: receipt email via mailer + SMS → redirect to /dashboard with success toast
  On failure: show "Payment failed" screen with retry (max 3x) + support contact

5. "REMIND ME LATER" from FreemiumUpgradeGate:
  Store dismissal in Redis: upgrade:dismissed:{studentId} TTL 86400s
  Show sticky banner on dashboard for 24h: "Upgrade to continue learning →"
  Banner dismissible with X button, re-stores TTL

Run npm run build && npm test. Report all files created/modified.
```

---

### TASK 29 — Progress report page (/student/progress)

```
/run find app/\(student\)/progress app/\(student\)/report -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components -name "*Progress*" -o -name "*Report*" 2>/dev/null | grep -v node_modules | head -10
/run grep -rn "progress\|report" app/api/student/ --include="*.ts" 2>/dev/null | grep -v node_modules | head -20

Read all files found. This task builds the progress report page per v2 spec.

CREATE app/(student)/progress/page.tsx (and /progress/[subjectId]/page.tsx):

Server component — never paywalled (all students see this regardless of subscription).

SECTIONS (top to bottom):

1. AI NARRATIVE INSIGHT (top):
   - "Vidya's insight" label
   - 2–3 sentence GPT-4o-mini generated summary of last 30 days
   - Prompt: "Write 2-3 encouraging sentences summarising this student's last 30 days.
     Sessions: [n], top improved chapter: [name], weakest chapter: [name].
     Tone: specific, encouraging, no jargon."
   - Loading skeleton while generating
   - PDF download button top-right: "Download PDF" (deferred — add as placeholder button that shows "Coming soon" toast)

2. SESSIONS CHART — last 30 days:
   - Bar chart using pure CSS (no Chart.js dependency)
   - X-axis: weeks (Week 1, Week 2, Week 3, Week 4)
   - Y-axis: session count per week
   - Bars: purple (#534AB7) for weeks with sessions, light grey for empty weeks
   - Below chart: "N sessions in last 30 days · N minutes total"

3. CHAPTER MASTERY BARS — per subject:
   Subject heading (e.g. "Mathematics")
   For each chapter:
     Chapter name (left) + mastery % (right, colour-coded)
     Progress bar: green >70%, amber 40–70%, red <40%
     board weight shown: "N marks" grey chip
   Ordered: lowest mastery first (most needs attention at top)

4. TEST SCORE HISTORY:
   Table: Date | Topic | Score | Time spent
   Last 10 completed sessions only
   Empty state: "Complete your first session to see scores here"

All sections: independent loading skeletons + error states.
Tap any chapter row → /student/session/pre/[conceptId] for the weakest concept in that chapter.

Run npm run build && npm test.
```

---

### TASK 30 — Streak system hardening + streak widget

```
/run find lib -name "*streak*" -o -name "*Streak*" 2>/dev/null | grep -v node_modules
/run find components -name "*Streak*" -o -name "*streak*" 2>/dev/null | grep -v node_modules
/run grep -rn "currentStreak\|longestStreak\|StudentStreak\|streakDays" prisma/schema.prisma lib/ app/ --include="*.ts" --include="*.tsx" --include="*.prisma" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20

Read all files found. This task hardens the streak system and adds the streak widget to the dashboard.

STREAK DEFINITION (enforce server-side):
An "active day" counts toward streak ONLY when:
  - Student completed a full session (all 7 stages reached CONSOLIDATION) OR
  - Student completed ≥ 10 revision cards in a day
NOT counted: login, partial session, browsing

1. Update the streak update logic (wherever it currently fires):
   - Only call updateStreak() when a session reaches CONSOLIDATION stage
   - Or when ≥ 10 revision cards completed in a day (check daily count)
   - Never on login or partial activity

2. STREAK SHIELD (if not already built):
   - One shield per calendar month per student
   - Auto-activates on first missed day (streak would break)
   - Sets a Redis key: streak:shield:{studentId}:{yearMonth} TTL until end of month
   - When shield activates: student notified via in-app message "Your streak shield protected you today! 🛡️"
   - Resets 1st of every month

3. CREATE components/student/dashboard/StreakWidget.tsx:
   - Fire emoji + count: "🔥 N days"
   - Tap → opens mini streak calendar (last 7 days as dots)
   - Calendar: filled purple for active days, grey for missed, teal border for today
   - "Your best streak: N days" below calendar
   - If streak = 0: "Start your streak today!" forward-looking message
   - Shield indicator: if shield available this month, show 🛡️ icon beside streak count
   - COPY RULE: never use "broke", "missed", "failed", "lost" anywhere in this component
   - Forward-looking tone only: "Start a new streak today — your best is still ahead."

4. Wire StreakWidget into dashboard (Task 21) — replace the streak badge in the topbar
   with a tap target that opens the StreakWidget as a popover/sheet

Run npm run build && npm test. Report changes.
```

---

### TASK 31 — Revision cards UI (SM-18 flow)

```
/run find app/\(student\)/revisions app/\(student\)/revision -type f 2>/dev/null | grep -v node_modules | grep -v ".next"
/run find components -name "*Revision*" -o -name "*revision*" 2>/dev/null | grep -v node_modules
/run cat app/api/student/revisions/due-today/route.ts 2>/dev/null | head -40

Read all files found. This task builds the revision cards UI per v2 spec (wireframe Screen 13).

CREATE app/(student)/revisions/page.tsx:

Server component:
1. Calls GET /api/student/revisions/due-today
2. If 0 due: show empty state "No revision due today ✓" with green tick + "Browse subjects" CTA
3. If due > 0: render RevisionFlow component

CREATE components/student/revision/RevisionFlow.tsx (client component):
- Full-screen during active revision
- Header: "Revision cards" + "N due · 20 min cap" right
- Progress bar: "N of N complete today"
- Daily cap indicator: if >20 min elapsed → "Daily cap reached. Come back tomorrow!" + exit CTA

PER CARD:
  Subject badge (green) + "Spaced repetition" label + "Card N of N" right
  Concept name (large)
  Question text
  MCQ options (same style as diagnostic — min 52px height)
  No back button — forward only

AFTER ANSWER:
  Correct: green feedback "Correct! ✓" + brief explanation
  Wrong: red feedback "Not quite" + worked answer + error type label
    (sign error / formula confusion / unit error / procedural error / reasoning gap)
  "Next card" button

AFTER ALL CARDS:
  Score summary: N/N correct
  If score > 80%: "Great work! Your memory of this topic is strengthening." (green card)
  If score ≤ 80%: "We'll add a re-teach session to your plan." (amber card)
    Non-blocking: POST /api/student/revision/complete { conceptId, score } → BullMQ job inserts re-teach LearningPlanItem
  CTA: "Back to dashboard"

REVISIONWIDGET on dashboard (already in Task 21):
  Wire to GET /api/student/revisions/due-today
  "N cards due today" chip → navigates to /student/revisions
  If 0 due: "You're all caught up ✓" green card (already built in Task 21 — verify it links correctly)

Run npm run build && npm test.
```

---

### TASK 32 — V1 cleanup: remove dead code and old components

```
/run find components/home -type f 2>/dev/null | grep -v node_modules
/run find app/\(student\) -name "*.tsx" -o -name "*.ts" 2>/dev/null | xargs grep -l "v1\|legacy\|old\|deprecated\|TODO.*remove\|FIXME.*remove" 2>/dev/null | grep -v node_modules | grep -v ".next"
/run grep -rn "getNextAction\|getOrderedTopicsForStudent\|homeEngine" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".next" | head -20
/run find components/home lib/homeEngine lib/dashboard -type f 2>/dev/null | grep -v node_modules

Read all files found. This is the V1 cleanup task — remove dead code after V2 UI is confirmed working.

ONLY do this task after Tasks 21–31 are all green and deployed. Verify V2 UI is working on production first.

FILES TO DELETE (verify no imports remain before deleting each):
1. components/home/ — all files in this directory (replaced by components in Task 21)
   Before deleting: /run grep -rn "from.*components/home" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules
   Fix any remaining imports first, then delete

2. lib/homeEngine/ — getNextAction.ts, getOrderedTopicsForStudent.ts, recommendationTrace.ts
   These were the V1 recommendation engine. V2 uses LearningPlan.
   Before deleting: check if getNextAction is still used anywhere as a fallback
   If used as fallback in TodaysLearningCard: keep getNextAction.ts, delete the others

3. lib/dashboard/ — nudgeMessage.ts (if NudgeBanner is removed in Task 21)
   Check if still imported anywhere first

LEGACY SESSION UI:
Find and remove the V1 session phases (OVERVIEW/EXPLANATION/PRACTICE/TEST/HOMEWORK) rendering code
that is now replaced by AITutorChatPanel. Only remove if ENABLE_AI_TUTOR=true for all users.
If still using feature flag for staged rollout: keep V1 code until rollout is 100%.

DEAD API ROUTES:
/run find app/api -name "route.ts" | xargs grep -l "TODO\|deprecated\|unused" 2>/dev/null | grep -v node_modules
Delete any confirmed-unused routes after verifying no client calls them.

After deletions:
Run npm run build && npm test — must be green.
If build breaks: restore deleted file, find the import, fix it, then delete again.

Run npm run build && npm test. Report every file deleted.
```

---

## COMPLETE EXECUTION ORDER

```
Phase 1 — Gates (Week 1):           Tasks 1–6    ✅ Complete
Phase 2 — Dashboard data (Week 2):  Tasks 7–10   ✅ Complete
Phase 3 — Parent actor (Week 3):    Tasks 11–13
Phase 4 — Reliability (Week 4–5):   Tasks 14–20
Phase 5 — V2 UI (Week 5–7):         Tasks 21–27
  21 — Dashboard full rebuild
  22 — Bottom nav + topbar
  23 — Pre-session screen + interrupted sheet
  24 — Diagnostic page (CRITICAL — dead-end redirect until this is done)
  25 — Session completion screen rebuild
  26 — AI tutor chat panel rebuild
  27 — Registration + onboarding flow
Phase 6 — Missing V2 features:      Tasks 28–32
  28 — Subscription upgrade flow V2
  29 — Progress report page
  30 — Streak system hardening + widget
  31 — Revision cards UI
  32 — V1 cleanup (do last, after production confirmed working)
```

## WHAT IS COMPLETE AFTER ALL 32 TASKS

Backend:
  ✅ AI tutor engine (T4–T25) — state machine, IRT, SM-18, RAG, safety, pgvector
  ✅ All gates — parent, profile, diagnostic, grade immutability
  ✅ LearningPlan + ExamReadiness + XP
  ✅ DPDP consent
  ✅ Parent actor + weekly digest
  ✅ Circuit breaker + staged rollout + cost monitoring
  ✅ Distress detection (code ready, flag off until counsellor sign-off)

Frontend:
  ✅ Registration + onboarding funnel
  ✅ Diagnostic flow + knowledge map
  ✅ Dashboard V2 (plan card, XP, readiness rings, streak)
  ✅ Pre-session screen
  ✅ AI tutor chat (streaming, stage strip, hints)
  ✅ Session completion (XP animation, insight, rating)
  ✅ Revision cards (SM-18 flow)
  ✅ Progress report
  ✅ Subscription upgrade (UPI-first, GST, scroll-to-confirm)
  ✅ Parent dashboard (read-only, weekly digest)
  ✅ V1 code removed

## WHAT REMAINS POST-LAUNCH (in post_launch_backlog.md)
  Referral programme
  Badge system
  Exam crunch mode
  Concurrent session prevention
  90-minute session cap
  Real CBSE content (descriptions, irt_b) — content team
  Timed chapter tests
  4-gate question generation
  PDF export on progress report
