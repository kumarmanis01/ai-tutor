# Spinzy student app · Design system + dashboard/profile revamp

A handoff package for Claude Code (and any future engineer) covering:

1. **A centralized design system** that extends your existing Spinzy brand tokens — drop-in additions to `styles/tailwind.css`, a small set of reusable React primitives, and clear patterns to follow. Future UI work picks these up automatically.
2. **Dashboard revamp** (`/dashboard/page.tsx`) — multi-subject, friends leaderboard, calmer hierarchy.
3. **Profile revamp** (`/(student)/profile/page.tsx`) — single share dropdown per badge, identity hero, clean key/value sections.

> **TL;DR for Claude Code**: read `CLAUDE_ADDENDUM.md` first, then `design-system/README.md`, then implement in the order below.

---

## What's in this folder

```
design_handoff_student_app/
├── README.md                          ← you are here
├── CLAUDE_ADDENDUM.md                 ← drop into / append to repo CLAUDE.md
├── design-system/
│   ├── README.md                      ← system overview, when to add tokens vs. patterns
│   ├── TOKENS.md                      ← maps every mock value to a brand token
│   ├── COMPONENTS_AND_PATTERNS.md     ← every component + page pattern, spec-grade
│   ├── tokens-additions.css           ← append to styles/tailwind.css
│   ├── tailwind-additions.config.js   ← merge into tailwind.config.js theme.extend
│   └── components/                    ← reference React/TS primitives
│       ├── Button.tsx                 ← single source of CTA variants + state→label helper
│       ├── Card.tsx
│       ├── Pill.tsx                   ← intent-driven (amber/mint/critical/primary/ghost)
│       ├── DayDot.tsx                 ← Duolingo-style 3D week markers
│       ├── Ring.tsx                   ← conic-gradient progress ring
│       ├── SubjectChip.tsx            ← inline subject identity tag
│       ├── SubjectGlyph.tsx           ← square subject icon tile
│       ├── KV.tsx                     ← definition-list row (key/value)
│       ├── IdentityHero.tsx           ← profile + dashboard welcome banner shared shell
│       ├── LeaderboardCard.tsx
│       ├── ReadinessRingCard.tsx      ← subject readiness card used in exam-readiness grid
│       └── BadgeRow.tsx               ← profile badge row with single Share dropdown
├── dashboard/
│   ├── README.md                      ← dashboard-specific recipe
│   └── design_files/                  ← HTML mocks (reference, do not ship)
└── profile/
    ├── README.md                      ← profile-specific recipe
    └── design_files/                  ← HTML mocks (reference, do not ship)
```

---

## Implementation order (strict)

Treat each step as a separate task — one PR each, gate green between them. This matches the repo's existing `aider_tasks.md` discipline.

### Step 1 — Design system foundation (no user-visible change)
1. Open `design-system/TOKENS.md`. Confirm every mock value has a brand token. Where a mapping is "**add**" (new token), append it to:
   - `styles/tailwind.css` — see `design-system/tokens-additions.css`
   - `tailwind.config.js` → `theme.extend.colors` / `boxShadow` / `borderRadius` — see `design-system/tailwind-additions.config.js`
   - `lib/theme/brand.ts` — the lib is the source of truth per repo policy. Add semantic entries (e.g. `surfaceWarm`, `surfaceSunk`, `inkScale.{1..4}`).
2. Copy the reference primitives in `design-system/components/` into `components/UI/design-system/` (existing folder; create if missing). Adapt them to repo conventions:
   - `'use client'` only when needed (most are server-safe — `Button` and `Pill` are pure)
   - Tailwind classes, no inline styles (mocks use inline styles only because they're prototypes)
   - `dark:` variants on every component
   - `min-h-[44px]` on interactive elements
3. Add `CLAUDE_ADDENDUM.md` content into the repo's `CLAUDE.md` under a new "DESIGN SYSTEM" section (or as a separate doc that CLAUDE.md links to).
4. **Gate**: `npm run build:workers && npm run build && npm test` green. No visual change yet.

### Step 2 — Migrate one existing page to validate
Pick the **profile** page (smaller surface) and refactor it onto the new primitives. This validates the system before touching the dashboard. See `profile/README.md` for the recipe. **Gate** green.

### Step 3 — Dashboard revamp
Implement the multi-subject + leaderboard dashboard from `dashboard/README.md`. **Gate** green.

### Step 4 — Sweep existing screens (optional, post-launch)
Add to `post_launch_backlog.md`: migrate remaining screens (login, onboarding, room, doubts, etc.) to the new primitives. Don't do this in the same sprint.

---

## Hard constraints from existing repo policy

Read these BEFORE coding — they override anything in this handoff:

- **`CLAUDE.md` non-negotiables** apply (mobile-first 360px, `min-h-[44px]`, no inline styles in committed code, no new npm deps, dark mode mandatory, no referral copy until Task 28, no numeric scores on knowledge map results, forward-looking streak copy only).
- **Brand source of truth is `lib/theme/brand.ts`** — every new token must land there + in `styles/tailwind.css` + in `tailwind.config.js`. All three in the same commit.
- **`docs/ENGINEERING_PRACTICES.md`** — read first.
- **Age-variant palettes** (`AGE_PALETTES` in `brand.ts`) still apply — when in doubt, route through `UIVariantProvider`. The patterns in this handoff use the *balanced* (middle-grade) palette as the default mock; juniors should still pick up `vibrant` overrides automatically because all primitives use CSS vars.

### Specific accommodations vs. the mocks

These mock decisions need adjustment in production:

| Mock | Production rule | Resolution |
|---|---|---|
| `Instrument Serif` for headlines | Repo uses Poppins (BRAND_TYPOGRAPHY.fontHeadline) | **Use Poppins**. Drop Instrument Serif. Hierarchy is what matters, not the typeface. |
| `Geist` for body | Repo uses Inter | **Use Inter**. |
| Numeric readiness on exam-readiness rings (`4%`, `62%`) | "Never show numeric score on knowledge map results — colour bands only" | **Replace numeric labels with tier labels**: `Critical / Weak / Fair / On track / Strong`. Keep the ring fill % for visual but render the band label, not the digits. |
| "Invite a friend · earn 200 XP" card | "Never reference referral programme until Task 28 is complete" | **Hide the InviteCard** until referral programme ships (gate on `FEATURE_REFERRALS`). Replace placeholder copy with internal name (`InviteFriendCard`) but don't render. |
| Streak copy `"X more to keep your streak going 🔥"` | OK — forward-looking | Keep. |
| Streak copy `"You're ahead by 2 sessions"` | OK | Keep. |
| Mock buttons sit at ~36–40 px tall | `min-h-[44px]` required | Bump all CTA padding to satisfy 44 px touch target. |
| Mock is 1280 px desktop only | Mobile-first 360 px | Every component spec in `COMPONENTS_AND_PATTERNS.md` includes a mobile rule. |

---

## How to use this on future UI work

After Step 1 ships, future screen work follows a tight loop:

1. **Read `design-system/README.md` and `COMPONENTS_AND_PATTERNS.md` first.** Almost every new screen is a re-composition of existing primitives.
2. **Reach for primitives before raw Tailwind.** Need a CTA? `<Button variant=…>`. Need a label/value row? `<KV>`. Need a subject identity tag? `<SubjectChip>`.
3. **If a pattern is missing, add it to `COMPONENTS_AND_PATTERNS.md` in the same PR** that introduces it. The system grows by accretion, not by drift.
4. **If a color/spacing value is missing, add it as a brand token** (the 3-file commit: `brand.ts` + `tailwind.css` + `tailwind.config.js`). Never hard-code a hex.

---

## What's NOT in scope

- AI tutor surface (intentionally removed from dashboard)
- Doubts queue, parent view dashboards
- Dark-mode visual tuning (the system supports it; concrete color audits are post-launch)
- Mobile bottom nav redesign (separate handoff)
- Empty/first-time states (separate handoff)

---

## Questions you can shortcut

- **"Should I introduce a new framework / shadcn / styled-components?"** No. Tailwind + CSS variables, exactly what's already there.
- **"Can I add a new npm dep for icons?"** Only if `CLAUDE.md` rules permit. The mocks use inline SVG glyphs — port those into `components/UI/icons/` if you don't have a set.
- **"The mock uses Instrument Serif. Do I add it?"** No — see table above.
- **"Should I remove existing pages I'm replacing?"** No. Refactor in place — same route, new composition.
