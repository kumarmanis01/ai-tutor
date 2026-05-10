# Student Dashboard

## User Stories & Acceptance Criteria

| Field | Value |
| --- | --- |
| Product | Vidya Learning Platform |
| Feature | Student Dashboard v2 |
| Version | 1.0 |
| Status | Draft - For Review |
| Owner | Principal Product Owner |
| Date | 10 May 2026 |
| Wireframe | docs\wireframes\student_dashboard_redesign.html |
| Visual display expecetd | docs\wireframes\New Dashboard Visiual.png |

Design Decisions Explained
Information hierarchy — 3 tiers of urgency:
Tier 1 (top): What do I do right now? — Today's study plan with sequenced, ranked topics across all subjects. The active topic is visually elevated with the purple accent. Start/Continue CTAs are per-topic, not global.
Tier 2 (middle): How am I tracking overall? — Subject Readiness as a 3-column grid. Each subject card is self-contained: overall %, per-chapter breakdown, days to exam, predicted board score. Scales cleanly to any number of subjects by wrapping the grid.
Tier 3 (bottom): What should I prioritise long-term? — AI Focus Priority queue ranked by exam impact × days remaining — this replaces the single Focus Area card and gives the student a ranked action list across all subjects, not just one.
Scalability decisions:
The subject readiness grid uses grid-template-columns: 1fr 1fr 1fr — at 4 subjects it wraps naturally to 2×2. At 5–6 you'd switch to a compact list view within the card. Today's Plan handles N topics by virtue of being a scrollable ranked list — the AI decides how many topics fit the daily time budget.
Color encoding — consistent semantic system:
Red = Critical (< 20% mastery or < 30 days to exam), Amber = Weak (20–60%), Green = Good/On track (> 60%). Purple = Mathematics (brand), Blue = Physics, Amber-brown = Chemistry. Colors are not decorative — they encode meaning.
What was removed and why:
The "You're all caught up" empty-state card and the raw XP progress bar as a standalone block are collapsed into the greeting header, which is a more natural home. The weekly streak calendar now also shows subject time-split and per-subject weekly minutes — the same real estate doing 3x the informational work.

## Priority Legend

| Code | Label | Meaning |
| --- | --- | --- |
| P0 | Must Have | Launch blocker. Feature cannot ship without this. |
| P1 | Should Have | High value; target for v1 but can slip to v1.1 if necessary. |
| P2 | Nice to Have | Low risk to defer. Planned for v2 roadmap. |

## EPIC-1: Dashboard Shell & Layout

Foundational grid, responsive layout, and global navigation chrome that hosts all dashboard widgets.

### US-01: Responsive dashboard grid

**Epic:** EPIC-1  
**Priority:** P0 - Must Have

**User story**  
As a student, I want to see all key study information on a single dashboard screen without excessive scrolling so that I can quickly assess my learning status and take action immediately.

**Acceptance criteria**

#### Layout structure

- Dashboard renders a 3-column CSS Grid (1fr 1fr 1fr) at viewport >= 1024px.
- At 768-1023px the grid collapses to 2 columns; below 768px to a single column with cards stacked vertically.
- All four row zones render in order: Greeting/XP, Today's Plan, Subject Readiness, Focus Priority + Weekly Calendar.
- No horizontal scroll appears at any supported viewport width (320px-2560px).
- Page renders first meaningful paint within 1.5s on a 3G connection (LCP <= 2.5s).

#### Empty and loading states

- A skeleton loader with correct grid shape displays while dashboard data is fetching.
- If the API returns an error, a non-blocking inline error banner displays with a Retry button; other widgets continue to render with cached data.
- A newly registered student with no subjects selected sees an onboarding prompt instead of empty widgets.

#### Notes / Out of scope

- Dark mode theming is deferred to a separate story.
- Native mobile app layout is out of scope for this story.

## EPIC-2: Greeting, XP & Gamification Header

Personalized greeting card displaying the student's name, level, XP progress, streak, and weekly session count.

### US-02: Personalized greeting with XP summary

**Epic:** EPIC-2  
**Priority:** P0 - Must Have

**User story**  
As a student, I want to see a personalized greeting with my current level and XP at a glance so that I feel motivated and have a sense of progress each time I open the dashboard.

**Acceptance criteria**

#### Greeting content

- Heading displays time-contextual greeting: "Good morning", "Good afternoon", or "Good evening" based on the student's local time zone.
- Student's first name is appended to the greeting (for example: "Good morning, Arjun").
- Sub-line shows current day name, date (for example: "Wednesday, 7 May"), and count of active subjects (for example: "3 subjects active").

#### XP and level display

- Current level number and total XP are displayed in the top-right of the greeting card.
- XP progress bar shows current XP / XP needed for next level, as a filled bar and percentage label.
- XP bar fill color uses the brand purple (#534AB7).
- XP and level values update in real time after a session is completed without requiring a full page reload.

#### Stat tiles

- Three stat tiles render below the XP bar: Day Streak, Sessions This Week (N/target), and Today's planned time (for example: "~85m").
- Day streak increments at midnight local time if the student completed at least one session that day.
- If the streak is 0, the tile shows "0 day streak" and a prompt to "start today".
- Today's planned time is calculated from the sum of estimated durations of uncompleted topics in the learning path for the current day.

#### Notes / Out of scope

- XP multipliers and streak-freeze tokens are defined in the Gamification epic, not here.

## EPIC-3: Today's Study Plan

AI-generated daily study plan showing sequenced topics across all active subjects, with per-topic CTAs.

### US-03: Multi-subject today's study plan

**Epic:** EPIC-3  
**Priority:** P0 - Must Have

**User story**  
As a student, I want to see a prioritized list of topics to study today across all my subjects in one place so that I do not have to decide what to study and can just start and follow the plan.

**Acceptance criteria**

#### Plan generation

- Plan is generated or refreshed at midnight local time, or when the student's learning path is updated.
- Topics are ranked by the formula: (1 - mastery_score) x exam_impact_weight x urgency_factor, where urgency_factor = 1 / max(days_to_exam, 1).
- Topics from all active subjects are eligible; the algorithm balances subjects so no single subject occupies > 60% of the daily time budget.
- Default daily time budget is 90 minutes; student can adjust this in settings.
- The plan contains a minimum of 1 and maximum of 5 topics per day.

#### Topic card rendering

- Each topic renders a numbered card with: topic name, subject chip (color-coded per subject), estimated duration, and status badge (In progress / Not started / Completed).
- The active/in-progress topic is visually elevated: purple border, light purple background fill, progress bar showing session completion %.
- A "Continue" button appears on the in-progress topic; a "Start" ghost button appears on not-started topics.
- Completed topics show a green checkmark icon and are visually de-emphasized (muted text, no CTA button).
- If no topic is in progress, the first not-started topic is highlighted as the suggested next action.
- Critical topics (mastery < 20% with exam <= 30 days) display a red "Critical" chip alongside the subject chip.

#### Plan controls

- "Customise" button opens a side drawer allowing the student to add, remove, or reorder topics for today only.
- "Surprise me" button replaces the current plan with a randomly selected valid plan that still satisfies the time budget and subject balance constraints.
- Customizations persist for the current day only; the next day's plan is re-generated by the algorithm.
- If all topics for the day are completed, the card area shows "You've completed today's plan" with options to add more or browse the syllabus.

#### Accessibility

- Topic cards are keyboard-navigable; Enter/Space activates the primary CTA.
- Status chips have aria-label values that describe their meaning (for example: aria-label="Status: Critical - low mastery, exam approaching").
- Progress bar has role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax.

#### Notes / Out of scope

- Session launch (opening the actual study notes view) is handled by the Session epic, not this story.
- "Browse syllabus" links to the Syllabus Browser feature, out of scope here.

### US-04: "Surprise me" plan randomization

**Epic:** EPIC-3  
**Priority:** P1 - Should Have

**User story**  
As a student, I want to get a randomized but still sensible study plan when I click "Surprise me" so that I avoid decision fatigue while still studying something useful.

**Acceptance criteria**

#### Randomization logic

- "Surprise me" selects topics at random from the set of eligible topics that are NOT already mastered (mastery >= 85%).
- The resulting plan must still respect the daily time budget (+/- 10 minutes tolerance).
- Subject balance constraint still applies: no subject > 60% of total time.
- The same topic cannot appear twice in one day's plan.

#### UX behavior

- Clicking "Surprise me" replaces the plan immediately with a 200ms fade transition.
- An undo toast ("Plan changed. Undo?") appears for 5 seconds allowing revert to the previous plan.
- The action is logged for analytics; the student's long-term learning path is not affected.

#### Notes / Out of scope

- None.

## EPIC-4: Subject Readiness Panel

Per-subject exam readiness cards showing overall score, per-chapter mastery breakdown, days to exam, and predicted board score.

### US-05: Multi-subject readiness grid

**Epic:** EPIC-4  
**Priority:** P0 - Must Have

**User story**  
As a student, I want to see my readiness score and chapter-level mastery for every subject I am studying so that I can identify exactly which chapters are dragging my overall score down.

**Acceptance criteria**

#### Grid layout

- Subject readiness renders as a 3-column grid (one card per subject) inside a full-width panel.
- If 4 subjects: 2x2 grid. If 5 subjects: 3+2 layout. If 1 subject: single full-width card.
- A "Full report ->" link in the panel header navigates to the detailed analytics page.

#### Subject card content

- Each card shows: subject name with color dot, overall readiness % (large, color-coded), status chip, board exam date, days remaining, overall progress bar, per-chapter list, and predicted board score range.
- Overall readiness % color rule: < 30% -> red (#A32D2D), 30-65% -> amber (#633806), > 65% -> green (#27500A).
- Status chips: "Critical" (red) for < 30%, "Weak" (amber) for 30-65%, "On track" (green) for > 65%.
- Days remaining text is colored red if <= 30 days, amber if 31-60 days, default gray if > 60 days.

#### Chapter mastery list

- Each chapter in a subject renders one row with: chapter name, mini progress bar (60px wide), mastery % figure, and a status chip.
- Chapter chips use same color rules as subject-level chips.
- Maximum 5 chapters shown by default; a "Show all N chapters" link expands the list in-place.
- Chapter rows are sorted by mastery ascending (weakest first).

#### Predicted score

- Predicted board score displays as a range (for example: "28-42 / 100") computed by the learning path engine.
- Score range is derived from 95% confidence interval of the predictive model.
- If a diagnostic has not been completed for the subject, predicted score shows "Complete diagnostic to predict score" instead.

#### Data freshness

- Readiness scores are recalculated after every completed session.
- A subtle "Updated just now" / "Updated 2 hours ago" timestamp appears at the bottom of each card.

#### Notes / Out of scope

- Detailed per-chapter drill-down report is part of the Analytics epic.
- Predicted score model training is an ML pipeline concern, not a frontend story.

## EPIC-5: AI Focus Priority Queue

Cross-subject ranked action list computed by the AI based on exam impact, days to exam, and current mastery gaps.

### US-06: AI-ranked cross-subject focus list

**Epic:** EPIC-5  
**Priority:** P0 - Must Have

**User story**  
As a student, I want to see a ranked list of the most important topics to study across all my subjects so that I always know what to do next without having to compare subjects manually.

**Acceptance criteria**

#### Ranking algorithm

- Focus priority score = (1 - mastery) x exam_weight x (1 / days_to_exam).
- exam_weight is a configurable per-chapter value set by the content team (default: 1.0).
- The list includes topics from all active subjects, ranked globally (not grouped by subject).
- Topics with mastery >= 85% are excluded from the list.
- Maximum 6 topics displayed; a "View all" link expands to full list.

#### Row rendering

- Each row shows: rank number (colored circle), topic name, subject name in muted text, mastery %, sessions needed estimate, days to exam, urgency chip, and a "Study" ghost button.
- Rank 1-2 with score above threshold: red circle + "Highest risk" / "Critical" chip.
- Rank 3-4: amber circle + "Weak" chip.
- Rank 5-6: default gray circle + no urgency chip.
- "Sessions needed" is computed as ceil((target_mastery - current_mastery) / avg_mastery_gain_per_session).

#### Interaction

- "Study" button on any focus row launches the topic's study session (same as clicking "Start" from Today's Plan).
- Clicking a topic row (not the button) navigates to the topic detail page.
- The "AI-ranked" chip in the panel header opens a tooltip explaining the ranking formula in plain language.

#### Recalculation

- Ranking recalculates automatically after each completed session.
- Ranking recalculates daily at midnight to reflect updated days-to-exam values.
- Optimistic UI: after clicking "Study" and completing a session, the returned-to dashboard shows the updated ranking within 2 seconds.

#### Notes / Out of scope

- Ability for students to manually pin or dismiss topics from the list is a v2 feature.

## EPIC-6: Weekly Calendar & Time Tracking

Weekly session calendar, per-day subject split visualization, and weekly time invested breakdown per subject.

### US-07: Weekly session calendar

**Epic:** EPIC-6  
**Priority:** P1 - Should Have

**User story**  
As a student, I want to see which days this week I have studied and which days remain so that I can maintain my streak and stay aware of my weekly study rhythm.

**Acceptance criteria**

#### Calendar display

- Seven day circles (Mon-Sun) render in a row; the current day is highlighted with the brand purple fill.
- Completed days show a green checkmark icon inside the circle.
- Future days show the day initial in muted gray.
- The day the streak was last active (if not today) shows a gray circle with a checkmark.
- Week resets on Monday 00:00 local time.

#### Session count label

- Below the calendar row: "N of M sessions done - X day(s) left" where M is the student's weekly session target (configurable in settings, default 5).
- If the weekly target is met, the label reads "Weekly goal reached!".

#### Subject time split bar

- A segmented horizontal bar beneath the calendar shows today's planned study time split by subject, color-coded per subject.
- Segments are proportional to planned minutes; a legend below the bar shows subject name and minutes.
- If today's plan has no remaining topics, the bar shows "Rest day" in gray.

#### Weekly time invested

- Three per-subject rows show subject name, a filled progress bar, and total minutes studied this week.
- Bars are normalized to the longest bar (100% width = highest time among subjects).
- Values update after each completed session without a page reload.

#### Notes / Out of scope

- Historical calendar (previous weeks) is accessible from the full analytics report.

## EPIC-7: Accessibility & Performance

Cross-cutting accessibility (WCAG 2.1 AA) and performance requirements applying to the entire dashboard.

### US-08: Dashboard WCAG 2.1 AA compliance

**Epic:** EPIC-7  
**Priority:** P0 - Must Have

**User story**  
As a student using assistive technology, I want to navigate and use every part of the dashboard using a keyboard or screen reader so that I am not excluded from the platform due to a disability.

**Acceptance criteria**

#### Keyboard navigation

- All interactive elements (buttons, links, chips) are reachable via Tab key in a logical DOM order.
- Focus indicator is visible at all times: 2px solid outline in a color with >= 3:1 contrast against the background.
- Modal drawers (Customise plan) trap focus within the drawer while open and return focus to the trigger element on close.
- No keyboard trap exists outside of intentional modal focus traps.

#### Screen reader

- All icon-only buttons have aria-label attributes.
- Progress bars have role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax, and aria-label.
- Status chips with color-coded meaning also convey that meaning in text (for example: chip text reads "Critical", not just a red dot).
- Dynamic content updates (XP after session, ranking changes) are announced via an aria-live="polite" region.
- Page landmark regions are defined: <header>, <main>, <nav>, <aside> as appropriate.

#### Color contrast

- All body text meets 4.5:1 contrast ratio against its background.
- All large text (>= 18pt or >= 14pt bold) meets 3:1 contrast ratio.
- Status meaning is never conveyed by color alone; a text label or icon always accompanies color coding.

#### Performance

- Largest Contentful Paint <= 2.5s on a simulated 3G connection.
- Cumulative Layout Shift <= 0.1 (skeleton loaders prevent layout jumps).
- First Input Delay / Interaction to Next Paint <= 200ms for all CTA clicks.
- Dashboard bundle (JS + CSS) <= 250kB gzipped; lazy-load charts and analytics components.

#### Notes / Out of scope

- WCAG 2.2 conformance is a v2 goal.
- Low-vision zoom behavior (browser zoom to 200%) should be tested but is not a blocking P0 requirement.
