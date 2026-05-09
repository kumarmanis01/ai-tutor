<!--
FILE OBJECTIVE:
- Comprehensive audit of student dashboard implementation against wireframe (screen 7) 
  and F-STU-032 specification. Identifies gaps, broken components, and missing features.

LINKED UNIT TEST:
- tests/unit/app/student/dashboard/page.test.ts
- tests/unit/components/student/dashboard/*.test.tsx

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/ENGINEERING_PRACTICES.md
- .github/copilot-instructions.md
- /docs/v2/01_student.md (spec reference)

EDIT LOG:
- 2026-05-09T14:30:00Z | audit | comprehensive dashboard gap analysis vs wireframe & spec
- 2026-05-09T15:30:00Z | copilot | status refresh after P0 fixes (Surprise fallback,
  XP breakdown rendering, readiness card rewrite)
-->

# Student Dashboard Audit Report
**Date:** 2026-05-09  
**Scope:** Compare implementation against wireframe (screen 7) and F-STU-032 spec  
**Assessed Version:** app/(student)/dashboard/page.tsx + component suite

---

## Executive Summary

| Gap | Severity | Impact | Status |
|-----|----------|--------|--------|
| 1. Surprise Me fallback logic | 🔴 Critical | Wrong routing on no suggestion | ✅ Fixed |
| 2. XP source breakdown not rendered | 🔴 Critical | Data fetched but hidden from UI | ✅ Fixed |
| 3. Subject Readiness Card broken | 🔴 Critical | Uses old design tokens, missing props | ✅ Fixed |
| 4. Focus Area missing | 🟠 High | Wireframe shows, not implemented | Needs implementation |
| 5. Secondary buttons hardcoded colors | 🟡 Medium | Should use design tokens | Refactor |
| 6. "This Week" complete | 🟢 Low | All spec requirements met | No action |
| 7. "You are all caught up" correct | 🟢 Low | Correctly shows when no revisions due | No action |

---

## Gap Analysis

### GAP 1: Surprise Me Routes to Wrong Destination 🔴

**Status:** ✅ Fixed

**File:** `components/student/dashboard/SecondaryStartOptions.tsx` (lines 51–73)  
**Spec Reference:** [F-STU-010 AC-02](../01_student.md#f-stu-010)

**Current Behavior:**
```tsx
// Line 51–73
const res = await fetch('/api/student/surprise-me')
if (res.status === 204) {
  toast('No surprise suggestion available right now. Opening today\'s topic.')
  router.push(resolvedTodaysHref)  // ← Falls back to today's topic (or /learn/learning-path)
  return
}
```

**The Problem:**
- When API returns **204 No Content** (no weak topic found), frontend **falls back to `resolvedTodaysHref`**
- If `resolvedTodaysHref` resolves to `FALLBACK_BROWSE_HREF = '/learn/learning-path'`, user navigates to **syllabus browser instead of a weak topic**
- User never sees the "weakest topic" as promised

**Expected Behavior (Spec):**
- "Surprise me" should pick the **highest-priority weak concept** (mastery < 0.4, practiceCount > 5)
- If no weak concept exists, fallback to **TopicRanker** (best recommendation)
- Only if both fail → no suggestion available

**API Implementation Status:**
✅ **API is correct!** (`app/api/student/surprise-me/route.ts` lines 40–105)
- Tries weak topic query first (mastery < 0.4, practiceCount > 5)
- Falls back to TopicRanker on miss
- Returns 204 only if both fail
- **Issue is in the frontend fallback logic**

**Fix Required:**
- On 204, redirect to `/dashboard` (home), not `/learn/learning-path`
- Show toast: "No specific weak topic to focus on. Let's pick something else!"
- Never open the syllabus browser as a fallback for "Surprise me"

---

### GAP 2: XP Source Breakdown Not Displayed 🔴

**Status:** ✅ Fixed

**Files:**
- Fetch: `app/(student)/dashboard/page.tsx` (line 141–148)
- Component: `components/student/dashboard/XPWidget.tsx` (lines 1–150)

**Spec Reference:** [F-STU-031 AC-01](../01_student.md#f-stu-031)

**Current Behavior:**
```tsx
// Fetch (dashboard/page.tsx line 141–148)
const xpBySource: Record<string, number> = {}
for (const row of xpBySourceRaw) {
  xpBySource[row.source] = row._sum.amount ?? 0
}

// Pass to component (line 488)
<XPWidget 
  totalXp={user.totalXp} 
  level={user.level} 
  xpThisWeek={xpThisWeek} 
  xpBySource={xpBySource}  // ← Data passed!
/>
```

**Component (XPWidget.tsx):**
```tsx
// Lines 7–12: Define labels (never used!)
const XP_SOURCE_LABELS: Record<string, string> = {
  session_correct: 'Correct answers',
  streak_bonus: 'Streak bonus',
  revision_complete: 'Revision cards',
  badge: 'Badge earned',
  session_complete: 'Session completion',
  first_attempt: 'First-attempt bonus',
}

export function XPWidget({ xpBySource, ... }: XPWidgetProps) {
  // Lines 60–130: Render total XP + progress bar
  // ❌ NEVER RENDER xpBySource breakdown!
}
```

**Expected Behavior:**
Wireframe + Spec show XP breakdown like:
```
Level 5 · Gold                XP this week: 245
├─ Correct answers: 120
├─ Streak bonus: 65
├─ Revision cards: 30
└─ Session completion: 30
```

**What's Missing:**
- Source breakdown **not rendered in JSX**
- `XP_SOURCE_LABELS` defined but unused
- Pass `xpBySource` but ignore it

**Fix Required:**
- Add expandable section in XPWidget showing source breakdown
- Render each source label + amount
- Consider collapsible/accordion for mobile space efficiency

---

### GAP 3: Subject Readiness Card Completely Broken 🔴

**Status:** ✅ Fixed

**File:** `components/student/dashboard/SubjectReadinessCard.tsx` (full file ~17 lines)

**Spec Reference:** [F-STU-023 AC-02, AC-03, AC-05](../01_student.md#f-stu-023)

**Current Implementation:**
```tsx
interface Props {
  subjectName: string;
  score: number;
  subjectId: string;
}

export function SubjectReadinessCard({ subjectName, score }: Props) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-error';
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 gap-3">
      <span className="font-body text-sm text-foreground truncate">{subjectName}</span>
      <span className={`font-headline font-bold text-sm ${color} shrink-0`}>{pct}%</span>
    </div>
  );
}
```

**Multiple Problems:**

1. **Uses old design tokens** (not Tailwind):
   - `border-border` ❌ (not in Tailwind)
   - `bg-card` ❌ (not in Tailwind)
   - `text-foreground` ❌ (not in Tailwind)
   - `font-body` ❌ (not in Tailwind)
   - `font-headline` ❌ (not in Tailwind)
   - `text-success`, `text-warning`, `text-error` ❌ (not in Tailwind)

2. **Missing required props** (but dashboard passes them!):
   ```tsx
   // dashboard/page.tsx line 524
   <SubjectReadinessCard
     subjectId={r.subjectId}
     subjectName={r.subjectName}
     score={r.score}
     diagnosticDone={r.diagnosticDone}        // ← Passed but not in Props!
     predictedRange={r.predictedRange}        // ← Passed but not in Props!
     retakeEligibleAt={r.retakeEligibleAt}    // ← Passed but not in Props!
   />
   ```

3. **Missing spec requirements:**
   - ❌ No chapter-level breakdown (AC-03: "breakdown shown by chapter")
   - ❌ No diagnostic status indicator
   - ❌ No retake eligibility info
   - ❌ No predicted score range display
   - ❌ No dark mode support

4. **Bad color mapping:**
   - Should use **brand colors**: #1D9E75 (green), #BA7517 (amber), #E24B4A (red)
   - Currently uses undefined tokens

**Expected Behavior (Spec F-STU-023 AC-05):**
```
┌─────────────────────────────────┐
│ Mathematics          78%  🟢     │
│ (Board exam ready)              │
│ ─────────────────────────────── │
│ Algebra:        92% (strong)    │
│ Geometry:       65% (needs work)│
│ Trigonometry:   51% (weak)      │
│ ─────────────────────────────── │
│ ⚡ Retake diagnostic in 5d      │
└─────────────────────────────────┘
```

**Fix Required:**
- Rewrite entire component using Tailwind utilities
- Accept all passed props
- Render chapter breakdown (expandable)
- Add diagnostic status indicator
- Add color-coded status badges
- Add dark mode support

---

### GAP 4: Focus Area Section Missing 🟠

**Status:** ⏳ Pending

**Files:**
- Dashboard: `app/(student)/dashboard/page.tsx`
- Wireframe: Screen 7

**Spec Reference:** [F-STU-023 AC-04](../01_student.md#f-stu-023) (implied by "chapter breakdown")

**Current State:**
The dashboard renders:
- ✅ Primary CTA (Today's Learning Card)
- ✅ Secondary options (Today/Browse/Surprise)
- ✅ XP Widget
- ✅ Weekly Study Strip
- ✅ Revision Widget
- ✅ Subject Readiness Cards (right column)
- ❌ **No "Focus Area" section**

**Wireframe Screen 7 Shows:**
A dedicated "Focus Area" card below the Readiness cards:
```
Focus Area
┌─────────────────────────────────┐
│ 📌 Quadratic Equations          │
│ Mastery: 32% (Weak)             │
│ Sessions needed: 3              │
│ Time to focus: ~45 min          │
│ [Study Focus Area] →            │
└─────────────────────────────────┘
```

**What Should Happen:**
- Extract the **lowest-mastery chapter** across all subjects
- Display it as a **priority card** in the dashboard
- CTA routes to a targeted mini-plan for that chapter
- Only show if no crunch mode

**Fix Required:**
- Add a new component: `components/student/dashboard/FocusAreaCard.tsx`
- Identify weakest chapter from `readinessResults` per subject
- Pick the **lowest across all subjects**
- Render card with session count + time estimate
- Add to dashboard layout (post-Revision, pre-Readiness or vice versa)

---

### GAP 5: Secondary Start Options Use Hardcoded Colors 🟡

**Status:** ⏳ Pending

**File:** `components/student/dashboard/SecondaryStartOptions.tsx` (lines 81–104)

**Current:**
```tsx
<Link
  href={resolvedTodaysHref}
  className="... border-[#534AB7] bg-[#EEEDFE] text-[#534AB7] hover:bg-[#e5e3fc]"
>
  Today's topic
</Link>
```

**Issue:**
- Hardcoded hex colors `#534AB7`, `#EEEDFE` break theme consistency
- If brand color changes, must update multiple files
- No single source of truth

**Best Practice:**
- Use CSS variables or Tailwind theme config
- Or use component wrapper: `<PrimaryButton>`, `<SecondaryButton>`

**Fix:**
- Extract to `lib/constants/theme.ts`:
  ```ts
  export const BRAND_COLORS = {
    PRIMARY: '#534AB7',
    PRIMARY_LIGHT: '#EEEDFE',
    ...
  }
  ```
- Use in component:
  ```tsx
  className={`border-[${BRAND_COLORS.PRIMARY}] bg-[${BRAND_COLORS.PRIMARY_LIGHT}]`}
  ```
- Or better: Create reusable button components

---

## Features Correctly Implemented ✅

### "This Week" Section (WeeklyStudyStrip)
- ✅ Shows 7-day Mon-Sun grid
- ✅ Filled (purple) when session completed
- ✅ Teal ring for today
- ✅ "N of N sessions done · N days left" footer
- ✅ Shows current streak (separate StreakWidget)
- ✅ Weekly goal display (default 5)

**Status:** Spec-compliant, no changes needed

---

### "You Are All Caught Up" Message
- ✅ Correctly shown in RevisionWidget when `revisions.length === 0`
- ✅ Only applies to revision cards due today (not full learning)
- ✅ Shows next review date when available
- ✅ Located at `components/student/dashboard/RevisionWidget.tsx` line 146

**Status:** Spec-compliant, no changes needed

---

## Summary of Required Changes

| Priority | Gap | Component | File(s) | Est. Effort |
|----------|-----|-----------|---------|------------|
| ✅ Done | Surprise Me fallback | SecondaryStartOptions | `SecondaryStartOptions.tsx` | Completed |
| ✅ Done | XP source display | XPWidget | `XPWidget.tsx` | Completed |
| ✅ Done | Readiness Card rewrite | SubjectReadinessCard | `SubjectReadinessCard.tsx` | Completed |
| 🟠 P1 | Focus Area section | FocusAreaCard + Dashboard | New + `page.tsx` | 3 hrs |
| 🟡 P2 | Color hardcoding | SecondaryStartOptions | `SecondaryStartOptions.tsx` | 1.5 hrs |

**Remaining Estimated Effort:** ~4.5 hours

---

## Implementation Checklist

- [x] Fix Surprise Me 204 fallback logic
- [x] Render XP source breakdown in XPWidget
- [x] Rewrite SubjectReadinessCard (design tokens + dark mode)
- [ ] Implement FocusAreaCard + integrate into dashboard
- [ ] Extract brand colors to `lib/constants/theme.ts`
- [ ] Run `npm run build` + `npm test` after each change
- [ ] Update unit tests for each component
- [ ] Verify against wireframe screen 7
- [ ] Test on mobile (360px) and desktop (1024px+)
- [ ] Test dark mode on all components
