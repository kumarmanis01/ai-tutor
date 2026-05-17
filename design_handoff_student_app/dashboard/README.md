# Dashboard revamp recipe

**Route**: `app/(student)/dashboard/page.tsx` (or wherever the existing dashboard lives)

**Prerequisite**: Step 1 of the master README is complete — design-system tokens + primitives + `CLAUDE_ADDENDUM.md` merged.

## What you're building

A multi-subject dashboard that supports multiple topics across multiple subjects per day, with a friends leaderboard and a multi-subject exam-readiness section. See `design_files/index.html` for the visual spec; this README is the implementation guide.

## Page composition

```tsx
'use client';
import { Card, Button, Pill, ReadinessPill, DayDot, Ring,
         SubjectChip, SubjectGlyph, missionCta, readinessTier } from '@/components/UI/design-system';

export default function DashboardPage() {
  const { missions, subjects, leaderboard, week, level, user } = useDashboardData();

  return (
    <PageShell>
      <WelcomeBanner user={user} missions={missions} />
      <TodaysMissions missions={missions} />
      <PickNext suggestions={…} />
      <StatsRow week={week} level={level} leaderboard={leaderboard} />
      <ExamReadiness subjects={subjects} />
    </PageShell>
  );
}
```

Each capitalised section is a local component in the dashboard folder — not a primitive (these are page-specific compositions). The primitives do the heavy lifting inside them.

## Sections

### `<WelcomeBanner>` — hero card

- `<Card variant="hero" padding="hero">`
- Eyebrow: today's date (`Wednesday · 17 May`) in `EyebrowLabel` style
- Title: `Welcome back, {user.firstName}.` in `text-4xl font-headline` (Poppins)
- Body: dynamic line based on mission count, e.g.
  - `4 missions across 3 subjects today. Knock them out and you'll cross Level {n+1} by Sunday.` (forward-looking — no "if you fall behind")
- DailyGoalBar: `done / total` of today's missions, warning-colored fill
- Right column: existing owl mascot (or your brand mascot) — `<Image>` next/image, 180×180, hidden on `< sm`

### `<TodaysMissions>` — hero + queue

```
<Section title="Today's missions" summary="4 missions · 3 subjects · ~52 min">
  <MissionHero mission={priority} />
  <Divider label="Up next today" />
  <Grid cols={{ base: 1, md: 2 }}>
    {others.map(m => <MissionRow key={m.id} mission={m} />)}
  </Grid>
</Section>
```

**MissionHero** (one per day, the priority mission):
- `<Card>` with `padding="hero"`
- Top pill row: `<Pill intent="amber">Homework pending</Pill>` + `<Pill intent="ghost"><Clock/> Due tomorrow · 10:00</Pill>` + `<SubjectChip subjectId={m.subjectId}/>` + right-aligned chapter ref
- 2-col grid (text + 140×120 lesson illustration)
- Title `text-5xl font-headline`
- Stat row: Questions / Time / Reward (XP in warning color)
- CTA row: `<Button variant={cta.variant}>{cta.label}</Button>` where `cta = missionCta(mission)` + `<Button variant="ghost">Preview</Button>` + right-aligned `Tomorrow: <subject>` anticipation text

**MissionRow** (compact, repeated per other mission):
- `<Card padding="compact">` with flex layout
- `<SubjectGlyph subjectId={…} size={36}/>` + text block + right-aligned `<Button variant={cta.variant} size="sm">{cta.label}</Button>`
- Text block: uppercase eyebrow (`{kind} · {subject} · {chapter}`) + serif title + stat line

> **CRITICAL**: every mission CTA — hero AND row — uses `missionCta(mission)`. Never hard-code "Start homework".

### `<PickNext>` — optional warm-ups

- Lighter section heading: `text-lg text-ink-2 font-headline`
- Segmented control: Warm-ups / Browse syllabus / Surprise me
- 3-col grid of `<Card variant="warm" padding="compact">` warm-up cards, each with `<SubjectChip>` + title + meta

Hide entirely if the user has > 4 incomplete missions today (too much to suggest extras).

### `<StatsRow>` — Week · Level · Leaderboard

3-col grid on `lg`, 2-col on `md` (leaderboard wraps to full width), 1-col on mobile.

**WeekCard** (`<Card variant="warm">`)
- Heading "This week" + dim caption "7 / 5 done"
- Row of 7 `<DayDot state={…}/>` with letter labels underneath
- Footer: forward-looking line — `✓ Ahead by 2 sessions` (use success color check)

**LevelCard** (`<Card variant="warm">`)
- `<Ring percent={xpPct} size="md" colorVar="--color-primary">` + level meta + "{n} XP to Level {next}"
- If gamification toggle is "high": extra inset row with this-week XP

**LeaderboardCard** (`<Card variant="warm">`)
- Heading + this-week / grade caption
- 6 rows: top 3 + you + 2 around you. Top 3 rank chips: gold / silver / bronze (use literal hex in component constants — these are decorative accents, not brand colors, exception documented).
- "You" row highlighted via `bg-primary-bg` and `border border-primary/20`
- Footer line: `{N} XP to overtake {neighborAbove.name}` + ghost "See all →" link
- **EMPTY STATE**: if leaderboard has 0 entries, show single CTA "Invite a friend to start a leaderboard" — but only when `FEATURE_REFERRALS` flag is on per repo policy. Otherwise show a calm placeholder ("Your class leaderboard appears here once friends join.").

### `<ExamReadiness>` — multi-subject

```tsx
function ExamReadiness({ subjects }) {
  const sorted = [...subjects].sort((a, b) => a.readiness - b.readiness);
  const [selectedId, setSelectedId] = useState(sorted[0].id);
  const selected = subjects.find(s => s.id === selectedId)!;
  const chapters = useChapters(selectedId);
  const overall = Math.round(avg(subjects.map(s => s.readiness)));

  return (
    <Card>
      <ExamHeader overall={overall} />
      <SubjectGrid subjects={sorted} selectedId={selectedId} onSelect={setSelectedId} />
      <Divider />
      <ChapterMastery subject={selected} chapters={chapters} />
    </Card>
  );
}
```

- **ExamHeader**: `<Ring percent={overall} size="lg" colorVar={READINESS_STYLE[readinessTier(overall)].fillVar}>{readinessLabel(readinessTier(overall))}</Ring>` + heading + summary line + ghost "Full report" link
- **SubjectGrid**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]` of `<ReadinessRingCard>` (see pattern in `COMPONENTS_AND_PATTERNS.md`). Sorted weakest first. Selected card gets subject-tinted bg, stronger border.
- **ChapterMastery**: subject chip + primary `Study {SubjectChip}` CTA, then a similar auto-fit grid of small chapter cards. Each chapter card has tier label + ring + bar — NEVER a raw percentage as the label.

### `<PageShell>` (helper)

```tsx
function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <TopBar />
      <main className="mx-auto max-w-page px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col gap-5 lg:gap-6">{children}</div>
      </main>
    </div>
  );
}
```

## Data shape

```ts
interface DashboardData {
  user: {
    firstName: string;
    level: number;
    levelTier: string;     // "Explorer"
    xp: { current: number; nextLevel: number };
    currentStreak: number;
    longestStreak: number;
  };
  missions: Mission[];     // see types in missionCta.ts
  subjects: Array<{
    id: SubjectId;
    readiness: number;     // 0-100 — used for ring fill only
    // tier is derived: readinessTier(readiness)
  }>;
  week: {
    days: Array<{ d: 'M'|'T'|'W'|'T'|'F'|'S'|'S'; state: DayState }>;
    sessionsDone: number;
    sessionsTarget: number;
  };
  level: { /* see user.xp */ };
  leaderboard: Array<{ rank: number; userId: string; name: string; xp: number; isYou: boolean }>;
}
```

All five fetches run in `Promise.all` in a server component, then pass to the client component. Per repo policy.

## Mobile rules

- **TopBar**: nav links collapse to a hamburger (`Menu`) on `< sm`. Streak pill stays.
- **WelcomeBanner**: single column. Mascot hides on `< md`. Daily goal bar full-width.
- **MissionHero**: title `text-3xl` (down from `text-5xl`). Illustration drops below text.
- **MissionRow**: stat line wraps to a second line if needed.
- **StatsRow**: stacks to 1 column. Leaderboard expands to show 8 rows when it's the only card on screen.
- **ExamReadiness**: subject grid becomes 2-col then 1-col. Chapter mastery stays the same auto-fit.

## Loading states

Every section has an independent skeleton matching its populated layout shape. Use `<CardSkeleton />` from the existing `components/UI/loaders` for the simple cards; build specific skeletons for `<MissionHero>` and `<LeaderboardCard>` since their shapes are bespoke. Loading-state widgets fail in isolation — one slow query doesn't blank the page.

## Empty states

- 0 missions today: `<WelcomeBanner>` copy changes to `Nothing queued — pick a topic below.` + render a single `<PickNext>` card with "Browse syllabus" prominent.
- 0 subjects (new student): hide `<ExamReadiness>` entirely. Re-enable after diagnostic.
- 0 leaderboard entries: see LeaderboardCard above.

## What you can delete after migrating

Search for and delete (after migration ships):
- The old `LearnTodayCard` / `DashboardCard` components that this replaces
- Any hard-coded `bg-[#534AB7]` literals — they should all be `bg-primary` now
- Inline `<style>` blocks in dashboard children
- The current segmented-button-row "Today's topic / Browse syllabus / Surprise me" pattern (consolidated into `<PickNext>`)

Don't delete in the same PR as the migration — separate cleanup PR with green gate.
