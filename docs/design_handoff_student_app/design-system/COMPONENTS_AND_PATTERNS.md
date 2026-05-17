# Components & patterns

Every primitive in the design system + every page-level pattern composed from them. Spec-grade: dimensions, variants, behavior, accessibility.

> Convention: **Primitives** = small reusable bits (`Button`, `Pill`). **Patterns** = compositions of primitives (`IdentityHero`, `LeaderboardCard`).

---

## Primitives

### `<Button>`

Single source for every CTA. Wraps Tailwind classes; consumes brand tokens.

**Props**
- `variant`: `'primary' | 'amber' | 'ghost' | 'danger' | 'disabled'`. Default `'primary'`.
- `size`: `'sm' | 'md' | 'lg'`. Default `'md'`. **All sizes guarantee `min-h-[44px]`.**
- `leftIcon`, `rightIcon`: optional icon component
- `fullWidth?`: boolean
- Standard button props (`type`, `onClick`, `disabled`, `aria-*`)

**Visual specs**

| Variant | Background | Text | Border | Press shadow | Hover |
|---|---|---|---|---|---|
| `primary` | `bg-primary` | `text-primary-foreground` | none | `shadow-press-primary` | `bg-primary-hover` + lift |
| `amber` | `bg-warning` | `text-white` | none | `shadow-press-warning` | lift |
| `ghost` | transparent | `text-foreground` | `border border-border` | none | `bg-surface-sunk` |
| `danger` | transparent | `text-error` | `border border-error/30` | none | `bg-error-bg` |
| `disabled` | `bg-muted` | `text-muted-foreground` | none | none | none; cursor not-allowed |

**Interaction**: on `:active` translate-y by 1 px AND drop the press shadow so the button reads "pressed in". CSS:
```css
.btn-primary:active { transform: translateY(1px); box-shadow: none; }
```

**When to use which**
- **primary**: main CTA per surface (Start, Continue, Update profile, Create invite)
- **amber**: ANY mission CTA where the mission is a homework, OR for retries. The amber reads as "urgent / now". Don't use amber for general CTAs.
- **ghost**: secondary action sitting next to a primary (Preview, Skip, Manage)
- **danger**: destructive (Request deletion, Logout from sensitive contexts)

**Mission CTA**: never hard-code the label — use the `missionCta(mission)` helper (see `TOKENS.md`).

```tsx
const cta = missionCta(mission);
<Button variant={cta.variant} leftIcon={cta.icon}>{cta.label}</Button>
```

---

### `<Card>`

Wrapper for content blocks. Three variants.

**Props**
- `variant`: `'default' | 'warm' | 'hero'`. Default `'default'`.
- `padding`: `'compact' | 'normal' | 'hero'`. Default `'normal'`.
- Pass-through `className` for one-off adjustments.

**Variants**

| Variant | Background | Border | Radius |
|---|---|---|---|
| `default` | `bg-card` (#fff) | `border border-border` | `rounded-xl` (16) |
| `warm` | `bg-surface-warm` | `border border-border` | `rounded-xl` |
| `hero` | gradient (see `IdentityHero`) | `border border-border` | `rounded-2xl` (24) |

Paddings: `compact` → `p-4`; `normal` → `p-6`; `hero` → `p-7 sm:p-8`.

---

### `<Pill>`

Small inline tag for status, eyebrows, category.

**Props**
- `intent`: `'amber' | 'mint' | 'critical' | 'primary' | 'ghost'`. Default `'ghost'`.
- `leftIcon?`, `rightIcon?`
- `children` (label)

**Specs**
- Padding `px-2.5 py-1` (5×11 px on desktop), `rounded-full`, `text-xs font-medium leading-none`
- Background = `bg-{intent}-bg` (`bg-warning-bg` etc.)
- Text = `text-{intent}-text` (e.g. `text-warning` / `text-success` / `text-error` / `text-primary` / `text-muted-foreground`)
- For `ghost`: transparent bg, `text-muted-foreground`, `border border-border`

**Don't** create per-screen "tag" styles — always `<Pill intent=…>`.

---

### `<ReadinessPill>`

Specialized `<Pill>` for the readiness tier label. Single argument: `tier`.

```tsx
<ReadinessPill tier={readinessTier(subject.pct)} />
```

Renders the tier label (`Critical` / `Weak` / `Fair` / `On track` / `Strong`) with the matching `READINESS_STYLE` colors. **Use this everywhere a readiness state shows up. Never render the numeric % as the user-facing label.**

---

### `<Ring>`

Conic-gradient progress ring. Pure presentational.

**Props**
- `percent`: 0–100
- `size`: `'sm' | 'md' | 'lg'` → 48 / 56 / 64 px
- `colorVar`: CSS variable name for the filled portion. Default `--color-primary`. For readiness rings, pass the tier's `fillVar`.
- `children`: usually the label inside (a tier label, not the digits — see CLAUDE rule).

**Implementation note**: ring is a `div` with `background: conic-gradient(var(--ring-color) calc(var(--p)*1%), var(--color-border) 0)` and an inner mask circle. See `components/Ring.tsx` reference.

---

### `<DayDot>`

Single day cell for the weekly streak strip. The thing that gives the app its "I want to come back" feel — keep the 3D lift.

**Props**
- `state`: `'done' | 'today' | 'future' | 'missed'`. Default `'future'`.
- `label`: optional letter inside (when done, show check; when missed, dim X)

**Specs**

| State | Background | Border | Shadow | Foreground |
|---|---|---|---|---|
| `done` | `bg-success` | none | `shadow-press-success` | white check icon |
| `today` | `bg-card` | `border-2 border-primary` | `shadow-press-primary` | small primary dot |
| `future` | transparent | dashed `border-2 border-border` | none | none |
| `missed` | transparent | dashed `border-2 border-border` | none | `text-muted-foreground` × (use forward-looking copy elsewhere — never call this "missed" in user copy) |

Size: 28–32 px square. The chunky press-down shadow on `done` is the whole reason this works visually — don't drop it.

---

### `<SubjectChip>`

Inline pill that identifies a subject. Used in mission rows, badge eyebrows, anywhere a subject needs naming.

**Props**
- `subjectId`: `'mathematics' | 'physics' | 'chemistry' | 'biology' | 'english' | 'social' | 'hindi'`
- `size?`: `'xs' | 'sm'`. Default `'xs'`.

**Visual**: small letter-glyph square (subject color) + subject short name. Tailwind: `bg-subject-{id}-bg text-subject-{id}` with the glyph inset.

---

### `<SubjectGlyph>`

Larger square subject identity tile (no label). Used as the leading icon in mission rows, badge rows, and the academic-preferences subject chips.

**Props**
- `subjectId`
- `size?`: number (px). Default 36.

**Visual**: rounded square, `bg-subject-{id}-bg`, single serif letter (`text-subject-{id}`) centered. Borderless.

---

### `<KV>`

A definition-list row used in account / academic-prefs / settings sections. Replaces the "**Label:** value" pattern that looks lifeless.

**Props**
- `label`: string
- `value`: ReactNode | string | null
- `emptyHint?`: shown italic muted when value is falsy. Default `'Not set'`.

**Visual**: two-column grid `120px 1fr`, 12 px vertical padding, 1 px bottom divider on every row except the last. Label is `text-xs text-muted-foreground`, value is `text-sm text-foreground`.

---

### `<EyebrowLabel>` (utility)

Tiny uppercase tracking-wide label that introduces a section or stat. Not strictly a component — it's a `<div className="text-xs uppercase tracking-wider text-muted-foreground">…</div>`. Document the pattern so it's not reinvented per file.

---

### `<NavLink>`

Top-bar text nav link. `active` vs default state.

**Props**: `href`, `active`, `children`. Styled via Tailwind:
- default: `text-ink-2 px-3 py-2 rounded-lg hover:bg-surface-sunk hover:text-foreground`
- active: `bg-card text-foreground font-medium border border-border`

---

## Patterns

### `<TopBar>`

Sticky top app bar present on every authenticated student page.

**Anatomy** (left → right)
1. Brand mark + product wordmark (`Spinzy` / `TutorAI` depending on white-label)
2. Nav links: `Today` · `Syllabus` · `Practice` · `Progress` · `Doubts`
3. Right cluster: `Upgrade` (ghost) · streak `<Pill intent="amber">` (with level badge inset) · avatar

**Specs**
- `sticky top-0 z-10`
- `backdrop-blur-md bg-background/80`
- `border-b border-border`
- Max-width content `1120px` centered, `py-3 px-8`
- Mobile (< 640px): collapse nav links into a sheet (`<Menu>`). Streak pill stays visible.

---

### `<IdentityHero>`

Used on **profile page**. Shared shell with `<WelcomeBanner>` (dashboard) — both use `<Card variant="hero">` with the warm gradient.

**Anatomy**
- Avatar (88 px, tier-colored ring) — left
- Name + email + member-since + identity pills (streak / level / showcase) — center
- Update profile (primary) + Sign out (ghost) — right, stacked

**Mobile**: stack vertically. Avatar centered, name/pills below, actions full-width stacked.

---

### `<WelcomeBanner>`

Dashboard equivalent of IdentityHero. Same `Card variant="hero"` chrome.

**Anatomy**
- Eyebrow date (`Wednesday · 17 May`) — small uppercase
- Headline (`Welcome back, {name}.`) — serif 4xl
- Body (1-line, what's queued today)
- Daily goal bar (`<DailyGoalBar done={n} total={m}/>`) — uses `bg-warning` fill
- Mascot illustration (right column, hidden on mobile)

The daily-goal bar is the habit hook — keep it.

---

### `<MissionRow>`

Used in dashboard "Up next today" and anywhere a list of topics/missions shows.

**Anatomy**
- `<SubjectGlyph>` (left, 36px)
- Text block: small uppercase eyebrow (`KIND · subject · chapter`) · serif title (1-line ellipsis) · stat line (`5 q · ~15 min · +120 XP`)
- `<Button variant=…>` (right, derived from `missionCta(mission)`) OR a round arrow IconButton

**State**: hover lifts slightly (`hover:shadow-sm`). Whole row is clickable.

---

### `<MissionHero>`

The big hero card on the dashboard. The day's priority mission.

**Anatomy**
- Pill row: kind + due + subject chip + chapter reference
- 2-col grid: text block (eyebrow `Today's top mission`, serif 5xl title, body line, stat row) + 140×120 lesson illustration
- CTA row: primary button (state-derived via `missionCta`) + ghost preview + "Tomorrow: …" anticipation text

**Mobile**: title shrinks to text-3xl, illustration drops below text.

---

### `<LeaderboardCard>`

**Anatomy**
- Heading + this-week / grade caption
- 6 rows = top 3 + you + 1 above + 1 below
  - Rank chip (22×22 rounded-md). Top 3 = gold/silver/bronze. Others muted.
  - Avatar circle (22×22). `You` row uses `bg-primary text-primary-foreground`, others muted.
  - Name (12.5 px). `You` weight 500 + foreground; others ink-2.
  - XP value, tabular-nums, right-aligned.
- "You" row highlighted: `bg-primary-bg border border-primary/20`
- Footer: `"{N} XP to overtake {name}"` + ghost "See all →"

**Empty / loading**: skeleton with 6 row placeholders. If no friends yet, show single CTA "Invite a friend to start a leaderboard" — but only when referrals feature is enabled.

---

### `<ReadinessRingCard>` (subject card)

One per subject in the exam-readiness grid.

**Anatomy**
- `<SubjectGlyph>` + subject name (serif `text-lg`, 1-line ellipsis with `min-w-0`)
- `<ReadinessPill tier={…}>`
- `<Ring percent={…} colorVar={tierFillVar}>` on the right (`size="md"`)
- Bottom: 6px progress bar tinted to tier color

**Selectable**: clicking selects → `bg-subject-{id}-bg`, stronger border, 2 px down-shadow accent. Selection is local state on the parent `ExamReadiness` component.

**Important**: render the tier label, not the percentage. Ring's center may show the tier label too — never digits in user-facing copy.

---

### `<ExamReadiness>` (page section)

**Anatomy** (full pattern)
1. Header row: overall ring (avg of subjects) + section heading + summary line + ghost "Full report" link
2. Grid (auto-fit minmax(220px, 1fr)) of `<ReadinessRingCard>`, sorted weakest first
3. Divider
4. Selected subject chip + primary "Study {subject}" CTA
5. Chapter cards (auto-fit minmax(220px, 1fr)) for the selected subject

**State**: `selectedSubjectId` defaults to weakest. Switching is purely client.

---

### `<BadgeRow>` (profile)

Replaces the colorful 4-share-buttons-per-badge anti-pattern.

**Anatomy**
- Badge icon tile (40×40, `bg-{accent}-bg text-{accent}`)
- Name + description (1-line each, ellipsis)
- Single `<Button variant="ghost" size="sm">Share ▾</Button>` opens a popover with WhatsApp / X / Facebook / Copy link options

**Showcase**: showcased badges get a subtle `ring-2 ring-primary ring-offset-2 ring-offset-card` on the icon tile only. Don't repeat the showcase marker elsewhere.

---

### `<DangerZone>`

Restrained footer block used for destructive actions (delete account, full data wipe). Sits below the main content with a top border.

**Anatomy**
- Small shield icon in `bg-error-bg text-error` 36×36 tile
- Heading + 1-line explanation
- `<Button variant="danger">Request deletion</Button>`

Never use the whole-card-in-red treatment. The point is restraint.

---

### `<ContinueLearningCard>` (dashboard variant)

Compact card used in dashboard's "Pick what's next" / "Continue learning" row.

**Anatomy**: identical to `<MissionRow>` but for lesson resume specifically: shows progress bar (`<Bar value={progress} />`) and uses `<Button variant=…>` derived from `missionCta({kind: 'Lesson', state: 'in_progress'})` (i.e. label "Continue learning").

---

## Page layouts

### Authenticated student page shell

```tsx
<div className="min-h-screen bg-background text-foreground font-sans">
  <TopBar />
  <main className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 py-6 lg:py-7">
    {/* page content */}
  </main>
</div>
```

### Two-column layout (profile + content + sidebar)

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
  <div className="flex flex-col gap-4 lg:gap-5">{/* main */}</div>
  <aside className="flex flex-col gap-4 lg:gap-5">{/* sidebar */}</aside>
</div>
```

On `< lg`, sidebar stacks below main.

### Stacked layout (dashboard)

```tsx
<div className="flex flex-col gap-5 lg:gap-6">
  <WelcomeBanner />
  <TodaysMissions />
  <PickNext />
  <StatsRow />        {/* 3-col on lg, 2 on md, 1 on mobile */}
  <ExamReadiness />
</div>
```

---

## Accessibility checklist (every primitive must satisfy)

- All interactive elements: `min-h-[44px] min-w-[44px]`
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large (Poppins ≥ 18px)
- `aria-label` on icon-only buttons
- Focus ring: `focus-visible:ring-2 ring-ring ring-offset-2` (the `--color-ring` token is already wired)
- Don't rely on color alone — readiness tiers always include the text label, day-dots use icons + color
- Forms: label every input, error messages associated via `aria-describedby`
- Keyboard navigation: `Tab` order matches visual order, popovers close on `Esc`

---

## Anti-patterns (do not do)

- Hand-rolling a card border / radius / shadow per screen
- Hand-coding subject color hexes per surface
- Rendering numeric readiness % as the user-facing label (use tier word)
- Using `bg-red-500` / `bg-purple-600` etc. — Tailwind palette colors are forbidden; use semantic brand tokens (`bg-primary`, `bg-error`)
- Inline styles in `.tsx` files (mocks use them; production doesn't)
- Drop shadows beyond the press-down + focus + popover shadows
- Multiple share buttons per badge
- Bold "Label:" + inline value text runs in settings — use `<KV>`
