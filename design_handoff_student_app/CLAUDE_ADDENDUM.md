# CLAUDE.md addendum — Design system

**Append this section to the repo's existing `CLAUDE.md` (under PRODUCTION STANDARDS or as a new top-level section called "DESIGN SYSTEM"). Future Claude Code sessions will read it first and treat it as binding.**

---

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
