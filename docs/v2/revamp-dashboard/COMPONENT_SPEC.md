# VIDYA DASHBOARD — COMPONENT VISUAL SPEC
# For Claude Code: read this file before writing any dashboard component.
# Every measurement, colour, and behaviour described here is the canonical truth.
# DO NOT deviate. DO NOT invent values not listed here.

---

## FILE ORGANISATION

app/
  tokens/
    design-tokens.ts          ← colour + typography primitives (MUST import from here)
  components/
    dashboard/
      DashboardGrid.tsx        ← layout shell
      GreetingCard.tsx
      TodaysPlan.tsx
      TopicCard.tsx            ← single topic row within TodaysPlan
      SubjectReadinessPanel.tsx
      SubjectReadinessCard.tsx ← single subject card
      ChapterMasteryRow.tsx
      FocusPriorityPanel.tsx
      FocusRow.tsx
      WeeklyCalendar.tsx
      DayDot.tsx
    ui/
      Chip.tsx
      ProgressBar.tsx
      SkeletonCard.tsx
      StatTile.tsx

---

## 1. DASHBOARD GRID (DashboardGrid.tsx)

Structure — 3 rows × varying columns:
  Row 1: [GreetingCard col-1] [TodaysPlan col-2 to col-3]
  Row 2: [SubjectReadinessPanel col-1 to col-3]
  Row 3: [FocusPriorityPanel col-1 to col-2] [WeeklyCalendar col-3]

CSS Grid:
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: 10px
  padding: 12px
  background: var(--color-bg-page)

Breakpoints:
  ≥ 1024px  → 3 columns (as above)
  768–1023px → grid-template-columns: repeat(2, 1fr)
               TodaysPlan spans col-1 to col-2
               SubjectReadinessPanel spans col-1 to col-2
               WeeklyCalendar moves below FocusPriority, full width
  < 768px   → grid-template-columns: 1fr  (single column stack)

CARD BASE STYLE (apply to every top-level card):
  background:    var(--color-bg-surface)
  border:        0.5px solid var(--color-border-subtle)
  border-radius: 12px
  padding:       14px 16px

---

## 2. GREETING CARD (GreetingCard.tsx)

Dimensions: col-1, row-1. Height: auto (content-driven, min ~160px).

Layout — two rows:
  Row A: [Greeting text left] [Level + XP right]
  Row B: [XP bar full width]
  Row C: [3 stat tiles equal width, gap 6px]

Greeting text:
  Line 1: "{time-greeting}, {firstName}"
    font-size: 17px, font-weight: 500, color: var(--color-text-primary)
  Line 2: "{DayName} · {N} subjects active"
    font-size: 12px, color: var(--color-text-secondary), margin-top: 2px

Level + XP (top-right):
  "Level {N}"  → font-size: 11px, color: var(--color-text-tertiary)
  "{XP} XP"   → font-size: 18px, font-weight: 500, color: #534AB7
                 (hardcoded purple-600 — this is always brand, not semantic)

XP progress bar wrapper:
  background:    var(--color-bg-subtle)
  border-radius: 8px
  padding:       10px 12px
  margin-top:    12px

  Label row (flex space-between):
    Left:  "{current} / {target} XP to Level {next}"  font-size:11px color:var(--color-text-secondary)
    Right: "{pct}%"  font-size:11px font-weight:500 color:#534AB7

  Bar track: height 5px, border-radius 3px, bg var(--color-border-subtle)
  Bar fill:  background #534AB7, transition width 500ms spring easing

3 Stat tiles (StatTile component):
  background:    var(--color-bg-subtle)
  border-radius: 8px
  padding:       8px
  text-align:    center
  flex: 1

  Value: font-size 18px, font-weight 500, color var(--color-text-primary)
  Label: font-size 10px, color var(--color-text-tertiary)

  Tile 1: "{N} day streak" — if streak=0 show "Start today" in critical-text colour
  Tile 2: "{done}/{target} sessions" — target from student settings (default 5)
  Tile 3: "~{N}m" — sum of durations of today's uncompleted topics

Time greeting logic:
  00:00–11:59 → "Good morning"
  12:00–16:59 → "Good afternoon"
  17:00–23:59 → "Good evening"

---

## 3. TODAY'S PLAN (TodaysPlan.tsx)

Dimensions: col-2 to col-3, row-1.

Section header:
  Title: "Today's study plan"  → 14px/500 var(--color-text-primary)
  Sub:   "{N} topics · ~{total}min · AI-optimised for your weak areas"
         → 11px var(--color-text-secondary), margin-top 1px
  Right controls: [Customise ghost-btn] [Surprise me ghost-btn] gap 6px

  Ghost button spec:
    height: 30px, padding: 0 10px
    font-size: 13px, gap: 5px (icon + label)
    icon: Lucide icon at 14px

Topic cards: rendered by TopicCard component (see §3a below)

Empty state (all done):
  Replace card list with centred text:
  "You've completed today's plan" (14px/500)
  + "Add more topics" ghost button + "Browse syllabus" text link

---

## 3a. TOPIC CARD (TopicCard.tsx)

Props: topicName, subject, durationMin, status, progress?, isActive

ACTIVE state (status = 'in_progress'):
  border:     1px solid #AFA9EC  (purple-200)
  background: #EEEDFE            (purple-50)
  border-radius: 10px
  padding:    10px 12px
  margin-bottom: 8px

  Counter circle: bg #534AB7, color #FFFFFF
  Topic name: 13px/500, color #3C3489 (purple-800)
  Subject chip: purple variant (see Chip spec §7)
  Duration + status: font-size 11px, color #534AB7
  CTA: "Continue" primary button (see Button spec §6)
  Progress bar: shown, height 5px, fill #534AB7
    Label row: "Session progress" (11px #534AB7) + "{pct}%" (11px/500 #3C3489)

NOT STARTED state:
  border:     0.5px solid var(--color-border-subtle)
  background: var(--color-bg-surface)
  border-radius: 10px
  padding:    10px 12px
  margin-bottom: 8px (last-child: 0)

  Counter circle: bg var(--color-bg-subtle), color var(--color-text-secondary), 28×28px
  Topic name: 13px/500, color var(--color-text-primary)
  Duration + status: 11px, color var(--color-text-tertiary)
  If critical: show red "Critical" chip after subject chip
  CTA: "Start" ghost button

COMPLETED state:
  Identical to NOT STARTED layout but:
  Counter circle: bg var(--color-success-bg), show check icon (Lucide Check, 12px, color var(--color-success-text))
  Topic name + all text: color var(--color-text-secondary) [de-emphasised]
  No CTA button (replaced by nothing or "Review" text link)

---

## 4. SUBJECT READINESS PANEL (SubjectReadinessPanel.tsx)

Dimensions: col-1 to col-3 (full width), row-2.

Section header:
  Title: "Subject readiness"  14px/500
  Right: "Full report →" text link, 11px, color #534AB7

Inner grid: display grid, grid-template-columns repeat(3, 1fr), gap 10px
  At 2-col layout: repeat(2, 1fr) — 4 subjects → 2×2
  At 1-col layout: 1fr — cards stack

---

## 4a. SUBJECT READINESS CARD (SubjectReadinessCard.tsx)

border:        0.5px solid var(--color-border-subtle)
border-radius: 10px
padding:       12px

Header row (flex, space-between):
  Left: [8px dot] [SubjectName 13px/500]
        dot colour: from SUBJECT COLOUR MAP (§9)
  Right: [{pct}% score] [status chip]
         score font-size: 20px, font-weight: 500
         score colour:  mastery-dependent (see Colour Logic §8)

Exam info: font-size 11px, color var(--color-text-tertiary), margin-bottom 6px
  "{board} exam: {date} · {N} days"
  Days colour: daysToExamColor() helper (see design-tokens.ts §11)

Overall progress bar: height 5px, fill colour from progressFillColor() helper

Chapter mastery list: rendered by ChapterMasteryRow × N chapters
  Default show: 5 chapters (sorted by mastery asc)
  Overflow: "Show all {N} chapters" expand link (11px #534AB7)

Predicted score: 11px, var(--color-text-tertiary)
  "Predicted board score: {low}–{high} / {max}"
  Score values: font-weight 500, colour from mastery-dependent rule

---

## 4b. CHAPTER MASTERY ROW (ChapterMasteryRow.tsx)

Layout: flex, align-items center, gap 8px
Padding: 7px 0
Border-bottom: 0.5px solid var(--color-border-subtle)
Last-child: no border, no bottom padding

  [Chapter name — flex:1, font-size 12px, color var(--color-text-primary)]
  [Mini progress bar — width 60px, height 4px]
  [Pct — font-size 11px, font-weight 500, width 28px, text-align right, colour from mastery]
  [Status chip — font-size 10px, padding 1px 5px, border-radius 20px]

---

## 5. FOCUS PRIORITY PANEL (FocusPriorityPanel.tsx)

Dimensions: col-1 to col-2, row-3.

Section header:
  Title: "AI focus priority"  14px/500
  Sub:   "Ranked by exam impact × days remaining"  11px secondary
  Right: brand chip "AI-ranked" with Sparkles icon 12px

Rows: FocusRow × N (max 6), then "View all →" text link

---

## 5a. FOCUS ROW (FocusRow.tsx)

Layout: flex, align-items center, gap 8px
Padding: 8px 0
Border-bottom: 0.5px solid var(--color-border-subtle)

Rank circle: 20×20px, border-radius full, flex centre
  Rank 1–2 (critical): bg var(--color-critical-bg), text var(--color-critical-text)
  Rank 3–4 (weak):     bg var(--color-weak-bg),     text var(--color-weak-text)
  Rank 5–6 (default):  bg var(--color-bg-subtle),   text var(--color-text-secondary)

Content (flex:1):
  Line 1: "{TopicName}" 13px/500 var(--color-text-primary)
           " · {SubjectName}" 13px/400 var(--color-text-tertiary)
  Line 2: "{pct}% mastery · {N} sessions needed · exam in {N}d"
           11px var(--color-text-tertiary)

Right: [urgency chip] [Study ghost-btn 11px padding 5px 10px]
  Rank 1: chip "Highest risk" → critical style
  Rank 2: chip "Critical"     → critical style
  Rank 3–4: chip "Weak"       → weak style
  Rank 5–6: no chip

---

## 6. BUTTON SPEC (ui/Button.tsx)

PRIMARY button:
  background:    var(--color-brand-bg)   → #534AB7
  hover bg:      var(--color-brand-bg-hover) → #3C3489
  color:         var(--color-text-on-brand) → #FFFFFF
  font-size:     13px
  font-weight:   500
  padding:       7px 14px   (icon+label) / 9px full-width
  border-radius: 8px
  border:        none
  icon size:     13px, gap 6px
  transition:    background-color 150ms ease
  focus ring:    0 0 0 3px rgba(83,74,183,0.35)
  active scale:  scale(0.98)

GHOST button:
  background:    transparent
  hover bg:      var(--color-bg-subtle)
  color:         var(--color-text-secondary)
  border:        0.5px solid var(--color-border-default)
  font-size:     13px
  font-weight:   500
  padding:       7px 12px
  border-radius: 8px
  icon size:     14px, gap 6px
  transition:    background-color 150ms, border-color 150ms

DO NOT:
  - Create a third button style without updating this spec
  - Use different padding values
  - Use font-weight 600 or 700 on buttons

---

## 7. CHIP SPEC (ui/Chip.tsx)

All chips share base:
  display:       inline-flex
  align-items:   center
  gap:           4px
  font-size:     11px
  font-weight:   500
  padding:       2px 8px
  border-radius: 9999px (full)
  border:        0.5px solid {variant-border}

VARIANTS:

  critical:
    background:   var(--color-critical-bg)    → #FCEBEB
    border-color: var(--color-critical-border)→ #F09595
    color:        var(--color-critical-text)  → #A32D2D

  weak:
    background:   var(--color-weak-bg)        → #FAEEDA
    border-color: var(--color-weak-border)    → #EF9F27
    color:        var(--color-weak-text)      → #633806

  success:
    background:   var(--color-success-bg)     → #EAF3DE
    border-color: var(--color-success-border) → #97C459
    color:        var(--color-success-text)   → #27500A

  brand (AI-ranked, In progress):
    background:   var(--color-brand-bg-subtle)→ #EEEDFE
    border-color: var(--color-brand-border)   → #AFA9EC
    color:        var(--color-brand-text)     → #3C3489

  subject chips — use subjectChipStyle() from design-tokens.ts
    Returns { background, borderColor, color } as React.CSSProperties

Small chip variant (inside chapter rows):
  font-size: 10px
  padding:   1px 5px

DO NOT invent new chip colours. All new status types map to one of these 4 variants.

---

## 8. MASTERY COLOUR LOGIC

Mastery thresholds apply to: progress bar fill, score text, status chip, rank circle.

  < 30%   → CRITICAL  fill: #E24B4A  text: #A32D2D  chip: critical
  30–64%  → WEAK      fill: #EF9F27  text: #633806  chip: weak
  65–84%  → GOOD      fill: #639922  text: #27500A  chip: success ("Good")
  ≥ 85%   → STRONG    fill: #639922  text: #27500A  chip: success ("Strong")

Use progressFillColor(mastery) and statusLabel(mastery) from design-tokens.ts.
NEVER inline the threshold logic in a component — call the helpers.

---

## 9. SUBJECT COLOUR MAP

Use subjectDotColor(subject) and subjectChipStyle(subject) from design-tokens.ts.

| Subject      | Dot / fill      | Chip bg  | Chip border | Chip text |
|--------------|-----------------|----------|-------------|-----------|
| Mathematics  | #534AB7 (pu-600)| #EEEDFE  | #AFA9EC     | #3C3489   |
| Physics      | #185FA5 (bl-600)| #E6F1FB  | #85B7EB     | #0C447C   |
| Chemistry    | #BA7517 (am-400)| #FAEEDA  | #EF9F27     | #633806   |
| Biology      | #3B6D11 (gr-600)| #EAF3DE  | #97C459     | #27500A   |
| 5th+ subject | #D4537E (pink)  | #FBEAF0  | #ED93B1     | #72243E   |
| 6th+ subject | #1D9E75 (teal)  | #E1F5EE  | #5DCAA5     | #085041   |

RULES:
  - Chemistry uses amber-400 (#BA7517) as its dot, NOT amber-600 (#854F0B).
    amber-600 is reserved for the "Weak" semantic status only.
  - Never reuse a subject colour for a status chip or vice versa.
  - Subject chips always show text. Never a dot-only chip.

---

## 10. PROGRESS BAR (ui/ProgressBar.tsx)

Props: value (0–100), colorOverride?, size? ('sm' | 'md')

Track:
  height:        6px (md) | 4px (sm/mini)
  background:    var(--color-border-subtle)
  border-radius: 9999px
  overflow:      hidden

Fill:
  height:        100%
  border-radius: 9999px
  background:    progressFillColor(value) — unless colorOverride provided
  width:         {value}%
  transition:    width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)

Accessibility:
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={label prop}

DO NOT hardcode background colours on progress bars.
Always call progressFillColor() or accept colorOverride.

---

## 11. SKELETON LOADER (ui/SkeletonCard.tsx)

Rendered while API data is fetching. Must match the exact grid structure of the real dashboard.

Skeleton element style:
  background:    var(--color-border-subtle)
  border-radius: matching the real element's radius
  animation:     pulse 1.5s ease-in-out infinite

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

Skeleton shapes:
  Text line:  height 12px, border-radius 6px
  Title line: height 16px, border-radius 6px
  Circle:     equal width/height, border-radius 9999px
  Card:       full card dimensions, border-radius 12px

DO NOT show partial real data mixed with skeletons.
Either full skeleton OR full real data per component.

---

## 12. WEEKLY CALENDAR (WeeklyCalendar.tsx)

Day dots row: flex, justify-content space-between, margin-bottom 14px

DayDot:
  wrapper: flex-col, align-items center, gap 4px
  label: 10px, var(--color-text-tertiary)
  label colour exception: today → #534AB7 (brand), target-day (Sunday/weekly goal) → #534AB7

  Circle states (26×26px, border-radius full):
    done:    bg #EAF3DE, check icon (Lucide Check 12px) color #27500A
    today:   bg #534AB7, text initial, color #FFFFFF, font-weight 500
    future:  bg var(--color-bg-subtle), text initial, color var(--color-text-tertiary)
    target:  border 1.5px solid #534AB7, color #534AB7, bg transparent

Session count label:
  "{N} of {M} sessions done · {X} day(s) left"
  font-size: 12px, color var(--color-text-secondary)
  If goal met: "Weekly goal reached!" color var(--color-success-text)

Subject split bar:
  Segmented horizontal bar — one segment per subject
  Segment width: proportional to planned minutes for that subject today
  Segment colour: subjectDotColor(subject) — exact hex from §9
  Segment gap: 3px between segments, border-radius 4px, height 8px
  Legend: flex, gap 10px — each entry: [8×8px rounded-[2px] swatch] ["{Subject} {N}m" 11px secondary]

Weekly time invested:
  Per-subject mini bar chart (3 rows)
  Subject label: 52px fixed width, 11px, var(--color-text-tertiary)
  Bar track: flex:1, height 5px
  Bar fill: subjectDotColor(subject), normalised to widest bar
  Value: 11px, 26px fixed width, text-right, var(--color-text-secondary)

---

## 13. SECTION HEADER PATTERN

Used in: TodaysPlan, SubjectReadinessPanel, FocusPriorityPanel, WeeklyCalendar

Layout: flex, align-items flex-start (or center if no subtitle), justify-content space-between, margin-bottom 10px

Left:
  Title: 14px/500 var(--color-text-primary)
  Subtitle (optional): 11px var(--color-text-secondary), margin-top 1px

Right: action element (link, button, or chip) — vertically centred with the title

Text link style ("Full report →"):
  font-size: 11px, color #534AB7, cursor pointer
  hover: underline
  No border, no background, no padding

---

## 14. DO / DON'T RULES FOR CLAUDE CODE

DO:
  ✓ Import all tokens from design-tokens.ts before writing component styles
  ✓ Use CSS custom properties (var(--color-*)) for all semantic colours
  ✓ Use 0.5px borders on cards and rows (set via inline style: '0.5px solid ...')
  ✓ Always use the mastery helper functions for colour logic
  ✓ Keep border-radius consistent with the spec (10px for inner cards, 12px for outer)
  ✓ Give every interactive element a focus-visible ring (3px, brand purple/40)
  ✓ Add aria attributes to all progress bars, status chips, and icon-only buttons
  ✓ Use transition-colors 150ms for hover/focus state changes
  ✓ Use the spring easing (cubic-bezier(0.34,1.56,0.64,1)) only for progress bar fill
  ✓ Show skeleton loaders during all data fetches

DON'T:
  ✗ Never hardcode a hex value in a component (only helpers and CSS vars)
  ✗ Never use font-weight 600 or 700 — max is 500
  ✗ Never add box-shadow for decoration — only for focus rings
  ✗ Never use gradients anywhere on the dashboard
  ✗ Never use border-radius values not in the spec (sm/md/lg/xl/2xl/full only)
  ✗ Never convey status meaning with colour alone — always add a text label
  ✗ Never create a new colour not in design-tokens.ts
  ✗ Never mix subject colours with status colours (Chemistry amber ≠ Weak amber)
  ✗ Never skip dark mode — every new CSS var must have a .dark value in globals.css
  ✗ Never use inline opacity to dim text — use the correct semantic text token instead

---

## 15. ICON LIBRARY

Use: lucide-react (already installed)
Import: import { Play, Check, Sparkles, SlidersHorizontal, ChevronRight } from 'lucide-react'

Icon sizes:
  In buttons: 13–14px (size={13} or size={14})
  In chips:   12px
  In day dots:12px (check icon)
  Decorative: 16–20px max

Stroke width: default (2px) — do not override

Common icons used:
  Play         → Start / Continue session
  Check        → Completed day, completed topic
  Sparkles     → AI-ranked, Surprise me
  SlidersHorizontal → Customise
  ChevronRight → "Full report →", "View all →"
  AlertTriangle→ Critical warning (use sparingly)

DO NOT use emoji in the dashboard UI.
DO NOT use any icon library other than lucide-react.
