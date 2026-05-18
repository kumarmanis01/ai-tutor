# Claude Code prompt — implement the design system + revamps

Drop the entire `design_handoff_student_app/` folder at the **repo root** of `ai-tutor` (next to `CLAUDE.md`, `package.json`). Then paste the prompt below into Claude Code.

The prompt is structured as **4 separate tasks**, one PR each, with a green gate (`npm run build:workers && npm run build && npm test`) between every task. Don't combine. This matches your existing `aider_tasks.md` discipline.

---

## Prompt to paste into Claude Code

```
We're adopting a centralized design system + revamping the dashboard and
profile pages. A complete handoff bundle sits at the repo root:

    ./design_handoff_student_app/

READ FIRST, IN THIS ORDER, BEFORE WRITING ANY CODE:

    1. ./design_handoff_student_app/README.md
    2. ./design_handoff_student_app/CLAUDE_ADDENDUM.md
    3. ./design_handoff_student_app/design-system/README.md
    4. ./design_handoff_student_app/design-system/TOKENS.md
    5. ./design_handoff_student_app/design-system/COMPONENTS_AND_PATTERNS.md
    6. Existing ./CLAUDE.md  -- treat its non-negotiables as binding

The HTML files under design_files/ are PROTOTYPES, not production code.
Recreate the designs in the existing Next.js + Tailwind codebase. Where the
mocks conflict with repo policy (typography, mobile-first, min-h-[44px],
numeric readiness scores, referral copy, dark mode), repo policy wins -- see
the conflict table in design_handoff_student_app/README.md.

Execute the 4 tasks below IN ORDER. Treat each as a separate PR. Run the
green gate between every task:

    npm run build:workers && npm run build && npm test

Do not start Task N+1 until Task N is committed with a green gate.

=================================================================
TASK 1 -- Design system foundation (no user-visible change)
=================================================================
Goal: extend the existing brand/token system with the new primitives and
tokens so future UI work picks them up automatically.

1a. Tokens. Add the new tokens listed in
    design_handoff_student_app/design-system/TOKENS.md  ->  "Tokens to ADD".
    Three-file commit (per CLAUDE.md token discipline):

    -  lib/theme/brand.ts            -> add semantic entries
    -  styles/tailwind.css           -> append tokens-additions.css contents
                                        (split into :root and .dark blocks
                                        that already exist; do not duplicate
                                        the blocks)
    -  tailwind.config.js            -> merge tailwind-additions.config.js
                                        into theme.extend (colors, boxShadow,
                                        borderRadius, maxWidth)

    Verify with `npx tsc --noEmit` and a quick `grep -r "bg-surface-warm"` --
    should resolve through Tailwind once it builds.

1b. Helpers. Add these two files (the design-system folder has reference
    copies). They are the single source of truth used by every CTA and every
    readiness display:

    -  lib/learning/missionCta.ts        (from design-system/components/missionCta.ts)
    -  lib/learning/readinessTiers.ts    (from design-system/components/readinessTiers.ts)

    Adapt the imported types to existing types in lib/types/ if those exist
    already -- otherwise keep the types co-located in the helper file.

1c. Primitives. Copy the reference primitives from
    design_handoff_student_app/design-system/components/  into
    components/UI/design-system/  (create the folder).

    Files to copy and adapt:
        Button.tsx       Card.tsx        Pill.tsx        KV.tsx
        DayDot.tsx       Ring.tsx        SubjectChip.tsx (exports both
                         SubjectChip and SubjectGlyph)
        index.ts         (barrel export)

    Adaptation rules for each file:
        -  'use client' only when the component uses state/effects/events
           (Button -> no; Pill -> no; DayDot -> no; etc.)
        -  Confirm every interactive element satisfies min-h-[44px]
        -  Add dark: variants on every color reference (most read through
           CSS vars so this is automatic; double-check)
        -  Replace the icon placeholders in DayDot.tsx ('./icons') with
           imports from your existing icon set
        -  Confirm zero hex literals in the .tsx files -- if any slipped in,
           promote to a token in step 1a and refer here

1d. Append the contents of
        design_handoff_student_app/CLAUDE_ADDENDUM.md
    to the bottom of the repo's ./CLAUDE.md under a new top-level section
    titled "## DESIGN SYSTEM (mandatory for any UI task)".

1e. Tests. Add a minimal test per primitive in
        tests/unit/components/UI/design-system/<Name>.spec.tsx
    Coverage required (per existing repo standard):
        -  renders without crash
        -  each variant renders (Button: primary/amber/ghost/danger/disabled)
        -  click handler fires (for interactive primitives)
        -  empty-state branch for KV ('emptyHint' rendered when value is null)

1f. Gate.
        python3 scripts/fix-smart-quotes.py
        npx tsc --noEmit --project tsconfig.json
        npm run build:workers && npm run build && npm test
    Commit. PR title: "feat(design-system): foundation tokens + primitives".
    NO user-visible change.

=================================================================
TASK 2 -- Migrate the Profile page to the new system
=================================================================
Goal: validate the system on a smaller surface before touching the dashboard.

Read design_handoff_student_app/profile/README.md fully. It is the
implementation recipe for app/(student)/profile/page.tsx.

Key adaptations to existing code:

    -  Keep all existing data hooks (useCurrentUser, session) and side-effect
       handlers (LogoutButton, AuthRedeemOnSignIn, deletion dialog). Restyle
       only -- do not rewire the data layer.
    -  Replace the per-badge 4-button share row in components/ProfileWidgets.tsx
       with a single <ShareDropdown> trigger that calls the same handlers the
       existing <ShareBadge> component exposes. Do not reimplement share logic.
    -  Gate the new <InviteFriendCard> on FEATURE_REFERRALS. Until referrals
       ship per Task 28, do NOT render the invite card. Keep the component
       source for when it ships.
    -  The Privacy & Data section becomes <DangerZone> -- a restrained footer,
       NOT a red-bordered panel. Keep the existing deletion-confirm modal --
       only restyle its buttons via <Button variant="danger" /> etc.
    -  grade and board are immutable after first save -- the "Edit" CTA must
       not navigate to a form that allows editing those two fields.
    -  Mobile-first: every section stacks correctly at 360px. Test in
       responsive devtools.

Forbidden in this PR:
    -  Inline styles in committed code (mocks use them; production never does)
    -  Hard-coded hex literals in .tsx files -- everything via tokens
    -  Any new npm dependency

Gate, commit. PR title: "refactor(profile): adopt design system + revamp".

=================================================================
TASK 3 -- Dashboard revamp on the new system
=================================================================
Goal: ship the multi-subject dashboard with friends leaderboard and
multi-subject exam readiness.

Read design_handoff_student_app/dashboard/README.md fully. It is the
implementation recipe for app/(student)/dashboard/page.tsx.

Key behaviors:

    -  Every mission CTA -- hero, row, warm-up -- uses
       missionCta(mission) for label + variant. No hard-coded "Start homework".
    -  Exam readiness section sorts subjects weakest-first; clicking a
       <ReadinessRingCard> updates a selectedSubjectId local state; chapter
       mastery below re-renders for that subject.
    -  Render the tier label ('Critical' / 'Weak' / 'Fair' / 'On track' /
       'Strong'), not the numeric %. The ring fill stays % as a visual.
       This satisfies the existing CLAUDE.md rule about knowledge map results.
    -  Page shell:  <main className="mx-auto max-w-page px-4 sm:px-6 lg:px-8 ..." />
    -  All five data fetches in Promise.all on the server component, then
       hand off to client components. Per repo perf rules.
    -  Each section has independent loading + error states -- one slow query
       must not blank the page.
    -  No AI tutor entry on this page (the original screenshot showed none and
       the design intentionally removes it).

Data shape -- if the existing dashboard data hooks don't return this shape,
adapt them (additive only -- never drop fields):

    {
      user: { firstName, level, levelTier, xp:{current,nextLevel}, currentStreak, longestStreak },
      missions: Mission[],         // see lib/learning/missionCta.ts types
      subjects: Array<{ id: SubjectId, readiness: number }>,
      week: { days: Array<{d, state}>, sessionsDone, sessionsTarget },
      level: <same shape as user.xp>,
      leaderboard: Array<{ rank, userId, name, xp, isYou }>,
    }

Gate, commit. PR title: "feat(dashboard): multi-subject + leaderboard revamp".

=================================================================
TASK 4 -- Cleanup
=================================================================
After Tasks 1-3 are merged and burned in for >= 24h with no incidents:

    -  Grep for hard-coded brand hex literals in app/ and components/
       (#534AB7, #1D9E75, #BA7517, #E24B4A, #EEEDFE, #EAF3DE, #FAEEDA, #FCEBEB).
       Replace each with the matching token utility class.
    -  Grep for inline `style={{...}}` in .tsx under app/(student)/ and
       components/. Either move to Tailwind utilities or to a primitive.
    -  Delete any V1 dashboard/profile component code that the migration
       superseded -- but only after `grep -r "<OldComponent" app/ components/`
       confirms zero imports remain.
    -  Add follow-ups to post_launch_backlog.md for screens not yet migrated
       (room, doubts, onboarding, login). Do NOT migrate those in this sprint.

Gate, commit. PR title: "chore(ui): sweep legacy hex literals + inline styles".

=================================================================
NON-NEGOTIABLES (apply to all four tasks)
=================================================================

From the repo's CLAUDE.md (re-stated for emphasis):
    -  Mobile-first 360px. Use sm: md: lg: modifiers for wider.
    -  min-h-[44px] min-w-[44px] on every interactive element.
    -  Tailwind classes only -- no inline styles.
    -  dark: variants on every component -- test both modes.
    -  Server components by default; 'use client' only when needed.
    -  No new npm dependencies.
    -  No referral copy until Task 28 ships -- gate behind FEATURE_REFERRALS.
    -  No numeric scores on knowledge map results -- tier labels only.
    -  Forward-looking streak copy -- never 'broke / missed / failed / lost'.
    -  Tests for every new function and new API route.
    -  Pre-commit: scripts/fix-smart-quotes.py + tsc --noEmit.
    -  Gate between every task: build:workers && build && test. All green.

Report any conflict between the handoff and existing CLAUDE.md before
deviating. Repo policy wins.

=================================================================
START WITH TASK 1.
=================================================================
```

---

## After Claude Code finishes Task 1

You should see:

- A new folder `components/UI/design-system/` with 8 primitives + an `index.ts`
- New entries in `lib/theme/brand.ts`, `styles/tailwind.css`, `tailwind.config.js`
- New files `lib/learning/missionCta.ts` + `lib/learning/readinessTiers.ts`
- A new section in `CLAUDE.md` titled "DESIGN SYSTEM (mandatory for any UI task)"
- Tests under `tests/unit/components/UI/design-system/`
- Green `npm run build` + `npm test`
- Zero visible change in the app

If any of those are missing or the build is red, send Claude Code back to fix Task 1 before letting it proceed to Task 2.

## Sanity checks you can run yourself

```bash
# 1. Brand tokens added to all three files in one commit
git log --diff-filter=A --name-only --oneline | head -20

# 2. No new hex literals introduced in .tsx files outside theme/
grep -rE "#[0-9A-Fa-f]{6}" --include="*.tsx" components/UI/design-system/ \
  && echo "FAIL: hex literal in primitive" || echo "OK"

# 3. CLAUDE.md updated
grep -n "DESIGN SYSTEM" CLAUDE.md

# 4. Primitives import-able
node -e "console.log(require('./components/UI/design-system'))"
```

## Why this works long-term

Once Task 1 is merged, **the system is the path of least resistance**. Any future Claude Code session reading `CLAUDE.md` sees the "DESIGN SYSTEM (mandatory)" section, opens `COMPONENTS_AND_PATTERNS.md`, and composes screens from primitives. New tokens get added through the documented 3-file commit. New patterns get documented in the same PR that introduces them.

Drift stops being a thing you have to police — it becomes harder to drift than to comply.
