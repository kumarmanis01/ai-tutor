# Design system — Spinzy student app

This folder is the centralized design system for the student-facing app. It extends the existing Spinzy brand tokens (`lib/theme/brand.ts`) with additional surfaces, primitives, and patterns introduced during the dashboard + profile revamp.

## Files in this folder

- **`TOKENS.md`** — every color, spacing, radius, shadow, type value the mocks use → mapped to the brand token you should use in production. Includes a "Tokens to add" section for any new values.
- **`COMPONENTS_AND_PATTERNS.md`** — every primitive (button, card, pill, ring, day-dot, KV, etc.) and every page-level pattern (identity hero, mission row, leaderboard card, readiness grid). Spec-grade: dimensions, states, behavior, accessibility.
- **`tokens-additions.css`** — drop-in CSS variables to append to `styles/tailwind.css`.
- **`tailwind-additions.config.js`** — config snippets to merge into `tailwind.config.js`.
- **`components/`** — reference TypeScript implementations of every primitive. Copy into `components/UI/design-system/` and adapt to repo conventions (add `dark:` variants, `min-h-[44px]`, etc.).

## Philosophy (3 rules)

1. **Tokens own the system.** Every value lives in `lib/theme/brand.ts` → flows through CSS variables → flows through Tailwind utilities. Components never know hex values.
2. **Primitives own the look.** Every screen is composed from `<Button>`, `<Card>`, `<Pill>`, etc. New screens don't reinvent card chrome.
3. **Patterns own the layout.** A "leaderboard card" looks the same on the dashboard as on the profile — same `<LeaderboardCard>` component, same row anatomy, same "You" highlight. Consistency is enforced by reuse, not by audit.

## When to add to the system

Add a new **token** when:
- A new color, spacing, radius, or shadow value would otherwise be hard-coded
- A new "intent" emerges (e.g. a new readiness tier — though `critical/weak/fair/on track/strong` should already cover it)

Add a new **primitive** when:
- Two or more screens share the same micro-pattern (e.g. a stat tile, an avatar+name row)
- A primitive's variants would otherwise multiply across screens

Add a new **pattern** when:
- A composition of primitives recurs (e.g. identity hero, stat row, readiness grid)

**Don't** add to the system when:
- The "pattern" is genuinely one-off (e.g. a marketing splash)
- A variant request is really a configuration tweak (use props)

## The age-variant story

The repo's `AGE_PALETTES` system swaps `--color-primary` etc. at runtime based on the student's grade band. **Every primitive in this system reads through CSS variables**, so age-variant flips work automatically. Do not hard-code color values in primitives.

The only place a primitive should reference a static hex is the `<SubjectChip>` / `<SubjectGlyph>` — subject identity is intentionally consistent across grades.

## Adding a token — the 3-file checklist

When you find yourself reaching for a raw hex in a `.tsx` file, stop. Add it as a token in **the same commit** across three files:

1. **`lib/theme/brand.ts`** — semantic export, e.g.:
   ```ts
   export const BRAND_COLORS = {
     // …existing…
     surfaceWarm: '#FBF8F1',
     surfaceSunk: '#F5F1E8',
   } as const;
   ```
2. **`styles/tailwind.css`** — CSS variable in `:root` and matching `.dark`:
   ```css
   :root {
     --color-surface-warm: #FBF8F1;
     --color-surface-sunk: #F5F1E8;
   }
   .dark {
     --color-surface-warm: #0F1724;
     --color-surface-sunk: #071025;
   }
   ```
3. **`tailwind.config.js`** — Tailwind utility binding:
   ```js
   colors: {
     // …existing…
     'surface-warm': 'var(--color-surface-warm)',
     'surface-sunk': 'var(--color-surface-sunk)',
   }
   ```

Now usable as `bg-surface-warm`. Drift impossible.

## Adding a primitive — checklist

When adding `components/UI/design-system/Thing.tsx`:

- Function component, no default export (named export only — easier grep)
- Props typed; no `any`
- `'use client'` only if it needs state/effects/events
- Mobile-first: default styles for 360 px, `sm:`/`md:`/`lg:` modifiers for wider
- `dark:` variants on every color
- `min-h-[44px]` on every interactive element
- Add a JSDoc one-liner above the export so editor hover shows what it is
- Add an entry to `COMPONENTS_AND_PATTERNS.md` in the same PR
- Add a test in `tests/unit/components/UI/design-system/Thing.spec.tsx` — at minimum: renders, all variants render, click handler fires
