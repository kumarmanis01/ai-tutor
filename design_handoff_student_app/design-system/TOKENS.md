# Tokens

Every value in the HTML mocks → the brand token to use in production. **No hex in `.tsx` files.**

The repo already has a solid token system in `lib/theme/brand.ts` + `styles/tailwind.css` + `tailwind.config.js`. This file:

1. **Maps mock values to existing tokens** wherever possible (reuse first).
2. **Lists tokens to ADD** where the mocks introduce values the brand system doesn't yet have.

Treat the "ADD" list as a single commit covering `brand.ts`, `tailwind.css`, and `tailwind.config.js`.

---

## Colors

### Reuse what already exists

| Mock variable | Mock value | → Brand token | Tailwind utility |
|---|---|---|---|
| `--primary` (mocks: `#6c4cc9`) | refined purple | `BRAND_COLORS.primary` (`#534AB7`) | `bg-primary`, `text-primary`, `bg-brand-primary/10` for tints |
| `--primary-soft` | `oklch(0.95 0.03 285)` | `BRAND_COLORS.primaryBg` (`#EEEDFE`) | `bg-primary-bg`, or `bg-brand-primary/10` |
| `--mint` | `#65a98b` | `BRAND_COLORS.success` (`#1D9E75`) | `bg-success`, `text-success` |
| `--mint-soft` | `oklch(0.94 0.04 165)` | `BRAND_COLORS.successBg` (`#EAF3DE`) | `bg-success-bg` |
| `--amber` | `#d49a3e` | `BRAND_COLORS.warning` (`#BA7517`) | `bg-warning`, `text-warning` |
| `--amber-soft` | `oklch(0.95 0.05 70)` | `BRAND_COLORS.warningBg` (`#FAEEDA`) | `bg-warning-bg` |
| `--critical` | `oklch(0.56 0.16 25)` | `BRAND_COLORS.error` (`#E24B4A`) | `bg-error`, `text-error` |
| `--critical-soft` | `oklch(0.95 0.04 25)` | `BRAND_COLORS.errorBg` (`#FCEBEB`) | `bg-error-bg` |
| `--ink` (text default) | `oklch(0.22 0.025 280)` | `BRAND_COLORS.foreground` (`#1A1A1A`) | `text-foreground` |
| `--ink-3` (muted) | `oklch(0.58 0.020 280)` | `BRAND_COLORS.mutedForeground` (`#666666`) | `text-muted-foreground` |
| `--line` (1 px border) | `oklch(0.92 0.012 75)` | `BRAND_COLORS.border` (`#E5E7EB`) | `border-border` |

### Subject identity (already exists)

| Mock `subjectId` | → Tailwind utility | Background tint |
|---|---|---|
| `math` | `text-subject-mathematics` | `bg-subject-mathematics-bg` |
| `science` | use `text-subject-physics` for general science (or pick `chemistry`/`biology` per topic) | `bg-subject-physics-bg` |
| `english` | `text-subject-english` | `bg-subject-english-bg` |
| `social` | `text-subject-social` | `bg-subject-social-bg` |
| `hindi` | **ADD** — see below | |

### Tokens to ADD

These are values the mocks use that don't have an existing token. Add to all three files (`brand.ts`, `tailwind.css`, `tailwind.config.js`) in one commit.

```ts
// lib/theme/brand.ts — append to BRAND_COLORS
{
  // Warm-cream surface layer for dashboards/profile (not pure white)
  surfaceWarm: '#FBF8F1',   // hero banners, sidebar warm cards
  surfaceSunk: '#F5F1E8',   // inset placeholders, "focus area" tray

  // Extended ink scale (already have foreground + mutedForeground)
  ink2: '#4A4458',          // body emphasis — between foreground and muted
  ink4: '#A8A2B8',          // disabled / faint dividers

  // Press-down shadow color for primary CTA (Duolingo lift)
  primaryShadow: '#3A2F8C',
  warningShadow: '#7E4F0F',
  successShadow: '#176A4F',

  // Subject identity — Hindi (add to subject tokens block)
  subjectHindi: '#A33B6E',
  subjectHindiBg: '#FBEAF1',

  // Readiness tiers — repo already has critical/weak/success status tokens.
  // Add the missing two for a complete 5-tier scale:
  statusFairText: '#BA7517',         // same as warning
  statusFairFill: '#E89645',
  statusOnTrackText: '#534AB7',      // same as primary
  statusOnTrackFill: '#7B74D4',
}
```

```css
/* styles/tailwind.css — append to :root and .dark blocks */
:root {
  --color-surface-warm: #FBF8F1;
  --color-surface-sunk: #F5F1E8;
  --color-ink-2: #4A4458;
  --color-ink-4: #A8A2B8;
  --color-primary-shadow: #3A2F8C;
  --color-warning-shadow: #7E4F0F;
  --color-success-shadow: #176A4F;

  --subject-hindi: #A33B6E;
  --subject-hindi-bg: #FBEAF1;

  --color-fair-text: #BA7517;
  --color-fair-fill: #E89645;
  --color-on-track-text: #534AB7;
  --color-on-track-fill: #7B74D4;

  /* New press-down shadow tokens (used by buttons + day-dots) */
  --shadow-press-primary: 0 2px 0 var(--color-primary-shadow);
  --shadow-press-warning: 0 2px 0 var(--color-warning-shadow);
  --shadow-press-success: 0 3px 0 var(--color-success-shadow);
}
.dark {
  --color-surface-warm: #1A1A2E;
  --color-surface-sunk: #0F0F1F;
  --color-ink-2: #B8B4C8;
  --color-ink-4: #6B6680;
  --color-primary-shadow: #1A1845;
  --color-warning-shadow: #451A03;
  --color-success-shadow: #14532D;
  --subject-hindi: #E07AAB;
  --subject-hindi-bg: #3A1F2A;
  --color-fair-text: #F59E0B;
  --color-fair-fill: #FBBF24;
  --color-on-track-text: #7B74D4;
  --color-on-track-fill: #9A95E0;
}
```

```js
// tailwind.config.js — merge into theme.extend.colors and theme.extend.boxShadow
{
  colors: {
    'surface-warm': 'var(--color-surface-warm)',
    'surface-sunk': 'var(--color-surface-sunk)',
    'ink-2':        'var(--color-ink-2)',
    'ink-4':        'var(--color-ink-4)',
    'subject-hindi':    'var(--subject-hindi)',
    'subject-hindi-bg': 'var(--subject-hindi-bg)',
    'status-fair-text': 'var(--color-fair-text)',
    'status-fair-fill': 'var(--color-fair-fill)',
    'status-on-track-text': 'var(--color-on-track-text)',
    'status-on-track-fill': 'var(--color-on-track-fill)',
  },
  boxShadow: {
    // existing: focus
    'press-primary': 'var(--shadow-press-primary)',
    'press-warning': 'var(--shadow-press-warning)',
    'press-success': 'var(--shadow-press-success)',
  },
}
```

---

## Typography

| Mock | → Production | Notes |
|---|---|---|
| `Instrument Serif` (display) | `BRAND_TYPOGRAPHY.fontHeadline` → Poppins | Drop Instrument Serif entirely. Poppins is the brand display font. |
| `Geist` (body) | `BRAND_TYPOGRAPHY.fontBody` → Inter | |
| `JetBrains Mono` (numerics) | Whatever `--font-mono` resolves to (SF Mono / Consolas) | Keep numerics tabular: `font-variant-numeric: tabular-nums` or Tailwind's `tabular-nums` utility |

**Type scale used in mocks** — map to existing Tailwind utilities:

| Element | Mock size | Tailwind |
|---|---|---|
| Welcome banner title | 38 px | `text-4xl` |
| Hero mission title | 42 px | `text-5xl` |
| Section heading | 22 px | `text-2xl` |
| Card heading (small) | 18 px | `text-lg` |
| Body | 14 px | `text-sm` |
| Eyebrow / caption | 11–12 px, uppercase, letter-spacing 0.06–0.1em | `text-xs uppercase tracking-wider` |
| XP / numeric value | 22 px tabular | `text-2xl font-medium tabular-nums` |

---

## Radius

The repo already exports `BRAND_RADIUS`:

| Mock value | → Brand token | Tailwind utility |
|---|---|---|
| 8 px | `BRAND_RADIUS.md` (8 px) | `rounded` (default) |
| 10–12 px | `BRAND_RADIUS.lg` (12 px) | `rounded-lg` |
| 16 px (card default) | `BRAND_RADIUS.xl` (16 px) | `rounded-xl` |
| 22 px (welcome banner / identity hero) | **ADD** `BRAND_RADIUS.xxl` (24 px) | `rounded-2xl` |
| 999 (pill) | `BRAND_RADIUS.full` | `rounded-full` |

---

## Shadows

```ts
// lib/theme/brand.ts — append BRAND_SHADOWS
export const BRAND_SHADOWS = {
  // Buttons that "press down" 1 px on active (Duolingo lift). Use one
  // per intent so the under-shadow matches the button color.
  pressPrimary: '0 2px 0 #3A2F8C',
  pressWarning: '0 2px 0 #7E4F0F',
  pressSuccess: '0 3px 0 #176A4F',  // day-dots use a slightly chunkier lift
  // Floating elements (popovers, dropdowns)
  pop: '0 10px 30px -12px rgba(40,30,60,0.18)',
};
```

CSS variables for them already added above. Tailwind utilities: `shadow-press-primary`, `shadow-press-warning`, `shadow-press-success`, plus `shadow-pop` (add to `tailwind.config.js` if used).

---

## Spacing

Tailwind's default scale is fine — no new tokens needed. The mocks use:

| Use | Tailwind |
|---|---|
| Card padding (default) | `p-6` (24px) or `p-7` (28px) for hero |
| Card padding (compact row) | `p-4` (16px) |
| Section vertical gap | `gap-5` (20px) on mobile, `sm:gap-6` (24px) desktop |
| Container max-width | `max-w-[1120px]` (custom — set as `7xl` extension or use raw) |
| Container side padding | `px-4 sm:px-6 lg:px-8` |

---

## Readiness tier mapping (used everywhere readiness shows up)

```ts
// lib/learning/readinessTiers.ts — single source of truth
export type ReadinessTier = 'critical' | 'weak' | 'fair' | 'on track' | 'strong';

export function readinessTier(pct: number): ReadinessTier {
  if (pct < 20)  return 'critical';
  if (pct < 40)  return 'weak';
  if (pct < 65)  return 'fair';
  if (pct < 85)  return 'on track';
  return 'strong';
}

export const READINESS_STYLE: Record<ReadinessTier, { textVar: string; fillVar: string; tailwindText: string; tailwindBg: string }> = {
  'critical':  { textVar: '--color-critical-text',  fillVar: '--color-critical-fill',  tailwindText: 'text-status-critical-text',  tailwindBg: 'bg-status-critical-fill/10' },
  'weak':      { textVar: '--color-weak-text',      fillVar: '--color-weak-fill',      tailwindText: 'text-status-weak-text',      tailwindBg: 'bg-status-weak-fill/10' },
  'fair':      { textVar: '--color-fair-text',      fillVar: '--color-fair-fill',      tailwindText: 'text-status-fair-text',      tailwindBg: 'bg-status-fair-fill/10' },
  'on track':  { textVar: '--color-on-track-text',  fillVar: '--color-on-track-fill',  tailwindText: 'text-status-on-track-text',  tailwindBg: 'bg-status-on-track-fill/10' },
  'strong':    { textVar: '--color-success-text',   fillVar: '--color-success-fill',   tailwindText: 'text-status-success-text',   tailwindBg: 'bg-status-success-fill/10' },
};
```

**Important repo rule**: render the **tier label**, not the percentage, in user-facing copy. The ring fill stays % as a visual; the adjacent text shows the tier. This satisfies the "no numeric scores on knowledge map results" non-negotiable in CLAUDE.md.

---

## Mission state → CTA mapping (single source of truth)

```ts
// lib/learning/missionCta.ts
import type { Mission, MissionKind, MissionState } from '@/lib/types';

export type MissionCta = {
  label: string;
  variant: 'primary' | 'amber' | 'ghost' | 'disabled';
  icon?: 'arrow' | 'play' | 'check' | 'lock';
};

export function missionCta(m: Pick<Mission, 'kind' | 'state'>): MissionCta {
  // Lessons / practice get primary purple. Homework gets amber (urgency).
  const isHomework = m.kind === 'Homework';
  const accent = isHomework ? 'amber' : 'primary';

  switch (m.state) {
    case 'not_started':
    case 'recommended_new':
      return { label: isHomework ? 'Start homework' : 'Start', variant: accent, icon: 'arrow' };
    case 'in_progress':
      return { label: isHomework ? 'Continue homework' : 'Continue learning', variant: accent, icon: 'play' };
    case 'completed_today':
      return { label: 'Review', variant: 'ghost', icon: 'check' };
    case 'failed_retry':
      return { label: 'Retry', variant: 'amber', icon: 'arrow' };
    case 'available_tomorrow':
      return { label: 'Locked', variant: 'disabled', icon: 'lock' };
    default:
      return { label: 'Open', variant: accent, icon: 'arrow' };
  }
}
```

Use this everywhere a mission/topic CTA renders. Do not hard-code `"Start homework"` per surface.
