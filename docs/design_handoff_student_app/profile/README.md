# Profile revamp recipe

**Route**: `app/(student)/profile/page.tsx`

**Prerequisite**: Step 1 of the master README is complete — design-system tokens + primitives + `CLAUDE_ADDENDUM.md` merged.

## What you're building

A calmer, more confident profile page. Same data and same backend hooks — different visual rhythm. Biggest fix: the badges sidebar (which currently renders 4 oversized colorful social buttons per badge) gets a single Share dropdown per badge.

See `design_files/profile.html` for the visual spec.

## Page composition

```tsx
'use client';
import {
  Card, Button, Pill, KV,
  SubjectChip, SubjectGlyph,
} from '@/components/UI/design-system';

export default function ProfilePage() {
  const { data: session } = useSession();
  const { data: profile, loading } = useCurrentUser();
  // ... existing auth-guard + loading state stays as-is

  return (
    <PageShell>
      <IdentityHero user={profile} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 lg:gap-6 items-start mt-5 lg:mt-6">
        <main className="flex flex-col gap-4 lg:gap-5">
          <LearningGoalsLink />
          <AccountCard profile={profile} />
          <AcademicPreferencesCard profile={profile} />
          <DisplayCard />
          <ParentAccessCard />
          <DangerZone onRequestDelete={…} />
        </main>

        <aside className="flex flex-col gap-4 lg:gap-5">
          {FEATURE_REFERRALS && <InviteFriendCard />}
          <BadgesCard badges={badges} />
          <LeaderboardCard />
          <WeeklyChallengeCard />
        </aside>
      </div>
    </PageShell>
  );
}
```

## Sections

### `<IdentityHero>`

`<Card variant="hero" padding="hero">` with a 3-col grid:

| Avatar | Identity block | Actions |

- **Avatar**: 88 px, with a tier-color ring (current `<Avatar>` already supports `tierColor`). Wrap in 3 px padding to give the ring breathing room.
- **Identity block**:
  - Eyebrow: `Your profile`
  - `text-4xl font-headline` name
  - `text-xs text-muted-foreground` line: email · separator dot · `Member since {date}`
  - Pill row (3 pills):
    - `<Pill intent="amber" leftIcon={<Flame/>}><b>{streak}-day</b> streak <span className="text-muted-foreground">· best {longest}d</span></Pill>`
    - `<Pill intent="primary" leftIcon={<Bolt/>}>Level {level} · {tier}</Pill>`
    - `<Pill intent="mint" leftIcon={<Trophy/>}>{showcaseCount} showcased</Pill>` (only when > 0)
- **Actions** (right column, stacked):
  - `<Button variant="primary" fullWidth leftIcon={<Edit/>}>Update profile</Button>`
  - `<Button variant="ghost" fullWidth leftIcon={<LogoutIcon/>}>Sign out</Button>` — preserves existing `<LogoutButton>` logic
  - Admin button (when `isAdmin`) renders below as ghost link

**Mobile (< lg)**: stack vertically. Avatar centered, identity block centered, actions full-width stacked.

### `<LearningGoalsLink>`

Single clickable card linking to `/dashboard/profile/learning-goals`. Same content as the current implementation; restyle:

- `<Card>` flex row, 18 px padding
- Lead icon: 44×44 `bg-primary-bg text-primary rounded-xl` with `<TargetIcon/>`
- Title `text-lg font-headline` + subtitle `text-xs text-muted-foreground`
- Trailing 38×38 ghost circle button with `<ArrowIcon/>`

### `<AccountCard>` — Plan / Billing / Role / Member since

Wrap in `<Card>`. Heading row: eyebrow `Subscription` + `Account & plan` title + right-aligned ghost "Manage →" button. Then a stack of `<KV>` rows:

```tsx
<KV label="Plan"          value={profile.plan} />
<KV label="Billing cycle" value={profile.billingCycle} />
<KV label="Role"          value={profile.role} />
<KV label="Member since"  value={formatDate(profile.createdAt)} last />
```

KV automatically renders italic muted "Not set" when value is empty.

### `<AcademicPreferencesCard>` — Language / Board / Grade / Subjects / Country / Parent

```tsx
<KV label="Language" value={languageName(profile.language)} />
<KV label="Board"    value={profile.board} />
<KV label="Grade"    value={profile.grade ? `Class ${profile.grade}` : null} />
<KV
  label="Subjects"
  value={
    profile.subjects?.length
      ? <div className="flex flex-wrap gap-1.5">{profile.subjects.map(s => <SubjectTag key={s} name={s} />)}</div>
      : null
  }
/>
<KV label="Country"      value={profile.country} />
<KV label="Parent email" value={profile.parentEmail} last />
```

`<SubjectTag>` here is a thin wrapper: looks up the subject's id from name and renders `<SubjectChip subjectId={id} />`. If no match, fall back to a generic `<Pill intent="primary">{name}</Pill>`.

**Remember**: `grade` and `board` are immutable after first save (CLAUDE rule). The "Edit" CTA on this card should not navigate to a form that allows editing those two — only the editable fields.

### `<DisplayCard>` — Font size toggle

The existing `<FontSizeToggle>` survives — just wrap in the new card chrome:

```tsx
<SectionCard title="Display & accessibility" eyebrow="How it looks">
  <div className="grid grid-cols-[120px_1fr] gap-3.5 py-3">
    <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
      <FontIcon /> Font size
    </span>
    <span><FontSizeToggle /></span>
  </div>
</SectionCard>
```

Restyle the toggle's internal segmented control to match the system: pill background `bg-surface-sunk`, active segment `bg-card border border-border` (the same look the mock uses).

### `<ParentAccessCard>`

Reuses the existing `<ParentAccessCard>` component — just adjust its internal Tailwind classes to use the new primitives. New look:

- `<Card>` with heading row eyebrow `Family` + title `Parent access` + right-aligned `<Pill intent="ghost">Inactive</Pill>` (or `Active` mint when linked)
- 1-line body explaining what it does
- Two-button row: `<Button variant="primary">Invite a parent</Button>` + `<Button variant="ghost">Learn more</Button>`

### `<DangerZone>` — Privacy & data

The current page renders this as a red-bordered panel. Tone it WAY down:

- Top border (`border-t border-border`), 22 px top padding — no card chrome
- Flex row: 36×36 `bg-error-bg text-error rounded-lg` shield icon + heading "Privacy & data" + 1-line body, all on the left; `<Button variant="danger">Request deletion</Button>` on the right
- The confirmation dialog stays as-is (already a modal) — just restyle the buttons inside to use `<Button>`

### Sidebar widgets

**`<InviteFriendCard>`** (warm card)
- 28×28 amber icon tile + heading "Invite a friend"
- 1-line body with XP earn
- Full-width primary `Create invite` + small ghost share icon button
- **GATED on `FEATURE_REFERRALS`** per repo non-negotiable. Until then, do NOT render this card. Keep the component in source for when the feature ships.

**`<BadgesCard>`** — THE BIG FIX

The current page renders 4 oversized colorful social buttons per badge (`Share` / `WhatsApp` / `Twitter` / `Facebook`). That's the main visual problem.

New shape:

```tsx
function BadgesCard({ badges }) {
  return (
    <Card padding="compact">
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-headline">Badges</h3>
        <Button variant="ghost" size="sm" onClick={openManage}>Manage showcase</Button>
      </header>
      <p className="text-xs text-muted-foreground mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1.5 align-middle"/>
        {showcaseCount} of 5 showcase slots used
      </p>
      <div className="flex flex-col gap-2">
        {badges.map(b => <BadgeRow key={b.id} badge={b} />)}
      </div>
    </Card>
  );
}

function BadgeRow({ badge }) {
  const accent = badgeAccent(badge);   // returns intent: 'amber' | 'primary' | 'mint'
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <BadgeIcon
        icon={badge.icon}
        accent={accent}
        showcased={badge.showcased}    // shows ring only on the icon tile
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{badge.name}</div>
        <div className="text-xs text-muted-foreground truncate">{badge.description}</div>
      </div>
      <ShareDropdown badgeId={badge.id} title={badge.name} description={badge.description} />
    </div>
  );
}
```

**`<ShareDropdown>`**: replaces the existing `<ShareBadge>` component. Renders a single `<Button variant="ghost" size="sm">Share ▾</Button>` that opens a popover with 4 small tinted text buttons: `WhatsApp` (success-tinted), `X` (neutral), `Facebook` (primary-tinted), `Copy link` (neutral). Each button calls the same handlers `<ShareBadge>` currently exposes — don't reimplement the share logic, just rewrap the trigger.

Showcase: showcased badges get a `ring-2 ring-primary ring-offset-2 ring-offset-card` on the icon tile only. Don't decorate the row otherwise.

**`<LeaderboardCard>`** — uses the same pattern as the dashboard (see `dashboard/README.md`). Same component, same shape. Pulls from the existing `/api/leaderboard` endpoint.

**`<WeeklyChallengeCard>`** — restyle the existing `<WeeklyChallenge>`:
- `<Card>` with amber icon tile + heading
- `text-xl font-headline` challenge title
- Progress: `{done} / {total}` line + warning-colored bar
- Bottom: `<Button variant="amber" fullWidth>Continue challenge</Button>`

## Loading + error states

The existing skeleton loaders (`<CardSkeleton/>`) stay. The two-column shape needs its own skeleton — copy the existing structure but tilt to the new layout (hero card on top + 2 columns).

Per repo policy: one failing widget never blanks the page. Each card has its own error → "Couldn't load — tap to retry" surface.

## Hard rules to honor

- **`min-h-[44px]`** on every interactive element — applies to badge share dropdown trigger, toggle segments, all buttons
- **No referral copy** until Task 28 ships — gate `<InviteFriendCard>` behind `FEATURE_REFERRALS`
- **Forward-looking streak copy** — "1-day streak · best 3d" is fine; don't add "your streak was 7 last week"
- **`grade` and `board` immutable** after first save — the Edit CTA must not surface those fields

## What you can delete after migrating

- Old per-badge `<ShareBadge>` quad-button layout (keep the `<ShareBadge>` share-action logic, just rewrap the UI)
- Inline color classes (`bg-blue-500`, `bg-green-500`, etc.) inside the profile area
- The red-bordered `<div>` for Privacy & Data — replaced by `<DangerZone>`

Don't delete in the same PR as the migration.
