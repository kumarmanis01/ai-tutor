# Spinzy Academy · UI rebuild directive for Claude Code
> **Owner:** product · **Last updated:** May 2026
> **Read this entire document before any UI change.**
> **Project name:** Spinzy Academy. AI tutor persona: Teacher Vidya.
> **Canonical design system:** `docs/design/design-system.html`
> **Token source of truth:** `docs/design/assets/tokens.css` (merged into `app/globals.css`)

---

## Part 1 · The unbreakable rules

You may not, under any circumstances:

1. Invent a hex code, font-size, spacing value, or border radius. Use only tokens from `app/globals.css`.
2. Use a CSS gradient anywhere. `bg-gradient-to-*` is banned across the app.
3. Use a `box-shadow` except `shadow-focus` on `:focus-visible`. No `shadow-sm/md/lg/xl/2xl`.
4. Use any emoji in any UI surface (student, parent, admin). Use Lucide icons.
5. Use a `font-weight` greater than 500 on any text. Headings included.
6. Use a subject hue as a status hue or vice versa. Chemistry amber-400 ≠ Weak amber-600. Maths purple ≠ Brand purple as decoration.
7. Add a new section to a page without an explicit instruction in this document or a follow-up from product.
8. Use `scrollIntoView` — it breaks the layout.
9. Mix the "Spinzy" and "Vidya" brands. **The product is Spinzy Academy. Teacher Vidya is the AI tutor persona inside the product.** Logo, page titles, marketing copy = "Spinzy". In-app tutor name, chat handle = "Teacher Vidya".

If a spec is silent on something, **stop and ask product**. Do not improvise.

At the end of every session, produce a diff summary confirming:
- Zero new hex codes introduced (grep `#[0-9A-Fa-f]{6}` in changed files)
- Zero new `bg-gradient-` classes (grep)
- Zero new emoji characters in JSX (grep emoji ranges)
- Zero new files outside the planned scope

---

## Part 2 · Naming cleanup (do this in Session 0, before anything else)

The codebase has brand drift. Fix it in one mechanical pass:

| Find | Replace |
|---|---|
| `Spinzy AI Tutor` (in titles, metadata, marketing copy) | `Spinzy Academy` |
| `Spinzy` (logo text alone) | `Spinzy` (keep — it's the short form) |
| `Teacher Vidya` references (avatar, AI chat handle, system messages) | **keep** — this is the persona |
| `vidya-avatar*` image paths | **keep** |
| `🦉` (owl emoji in `components/admin/AdminSidebar.tsx`) | Lucide `<GraduationCap>` |
| `S` letter mark in `app/(student)/dashboard/components/TopBar.tsx` (legacy v1) | delete file — see Part 3 |
| Gradient logo `from-blue-500 to-purple-600` | flat `bg-brand-bg` |

Do this as a single PR titled `chore: brand consistency pass`. No visual rebuild yet. Just rename.

---

## Part 3 · DEAD CODE — delete in Session 1

These files are orphaned by the v2 dashboard migration but still in the repo. Delete them before any rebuild. Verify by searching for imports first (grep their default-export names) — none should be referenced.

```
# Orphaned student v1 dashboard (replaced by /dashboard/page.tsx + components/student/dashboard/*)
app/(student)/dashboard/components/StudentHomeDashboard.tsx
app/(student)/dashboard/components/home/HomeTab.tsx
app/(student)/dashboard/components/home/StudentGreeting.tsx
app/(student)/dashboard/components/home/WelcomeBanner.tsx
app/(student)/dashboard/components/home/RecoveryBanner.tsx
app/(student)/dashboard/components/home/TodaysLearningCard.tsx     # v1 — keep components/student/dashboard/TodaysLearningCard.tsx
app/(student)/dashboard/components/home/WeeklyProgressSnapshot.tsx
app/(student)/dashboard/components/home/ContinueWhereLeftOff.tsx
app/(student)/dashboard/components/home/index.tsx
app/(student)/dashboard/components/StudyGoals.tsx
app/(student)/dashboard/components/ContinueLearning.tsx
app/(student)/dashboard/components/FeatureGrid.tsx
app/(student)/dashboard/components/SuggestedContent.tsx
app/(student)/dashboard/components/SubjectThreadList.tsx
app/(student)/dashboard/components/ParentModeCard.tsx
app/(student)/dashboard/components/TopBar.tsx                       # superseded by components/student/layout/Topbar.tsx
app/(student)/dashboard/components/BottomNavigator.tsx              # superseded by components/student/layout/BottomNav.tsx
```

If any of these have a live import you missed, **stop and report**. Do not delete blindly.

**Also delete from globals.css** the `.w-pct-0` through `.w-pct-100` lint-workaround utilities. They will be unnecessary after token migration.

---

## Part 4 · The new visual language (read once)

- **Type:** Inter (UI) + JetBrains Mono (numerics). Weights 400, 500. **No 600+.**
- **Page background:** `#F1EFE8` warm neutral. No gradients.
- **Surfaces:** white, 0.5px hairline borders, 10px or 12px radius.
- **Brand:** `#534AB7` purple. Used for primary CTAs, focus rings, active states, Mathematics subject.
- **Subject hues:** Math `#534AB7` · Physics `#185FA5` · Chem `#BA7517` · Bio `#3B6D11` · English `#D4537E` · Social `#1D9E75`.
- **Status hues:** Critical `#A32D2D` text / `#E24B4A` fill · Weak `#633806` text / `#EF9F27` fill · Success `#27500A` text / `#639922` fill.
- **Motion:** 150ms for hover/focus colour shifts. 500ms spring **only** for progress fill width. Nothing else animates.
- **Icons:** Lucide, stroke 1.75. 18px default, 22px in tab bar, 14px in chips.
- **Voice:** calm, specific, action-oriented, no emoji, no hype. Examples in `design-system.html` section 09.

Mocks for every screen live in `docs/design/{student,parent,admin,landing}.html`. **Open them at 390px width and match pixel-for-pixel.**

---

## Part 5 · Feature inventory — what to preserve, where it lives

This is the contract. Every feature listed here must work in the new UI. If you can't see how, **ask** before you rebuild.

### 🟢 Student app

The new IA: 5 tabs in `components/student/layout/BottomNav.tsx` (mobile) and `Topbar.tsx` (desktop).

| Tab | Route | Owns these features (from current code) | Source files to preserve |
|---|---|---|---|
| **Home** | `/dashboard` | Greeting+XP, Today's Plan, Subject Readiness, Weekly Calendar, Crunch Mode banner (≤14d to exam), Focus Area card, Revision queue, Upgrade prompt when sessions=0, Diagnostic CTA when subject lacks diagnostic | `app/(student)/dashboard/page.tsx`, `components/student/dashboard/*` |
| **Learn** | `/learn`, `/learn/learning-path`, `/learn/[courseId]/lesson/[index]` | Course catalogue, learning path timeline, lesson player, AI tutor chat session, session completion screen, misconception cards, visual hints | `app/(student)/learn/*`, `components/student/session/*`, `components/Learn/*` |
| **Practice** | `/dashboard/tests` (rename to `/practice`), `/tests`, `/practice/start`, `/practice/session/[id]`, `/mock`, `/mock/[examId]`, `/homework/[id]` | Practice quizzes (MCQ), tests by subject, recommended tests, upcoming tests, test results, mock exams, homework assignments, test nudge notifications | `app/(student)/dashboard/components/Tests/*` (consolidate), `app/(student)/practice/*`, `app/(student)/tests/*`, `app/(student)/mock/*`, `app/(student)/homework/*` |
| **Doubts** | `/dashboard/doubts`, `/doubts` | AI tutor chat (Teacher Vidya), photo upload for textbook questions, doubt history by subject, Hindi/English language toggle, doubt escalation to human tutor | `app/(student)/dashboard/components/doubts/*`, `app/(student)/doubts/*`, `components/student/session/AITutorChatPanel.tsx` |
| **Me** | `/dashboard/profile`, `/profile`, `/student/progress`, `/student/progress/[subjectId]`, `/student/revisions`, `/subscribe`, `/parent` (linked parent), `/rooms` | Profile + avatar, XP/level/streak, weekly progress chart, study time heatmap, score trend, chapter mastery bars, AI narrative ("Why am I weak in X?"), per-subject deep report, revision history, subscription/billing, linked parent settings, study rooms, referral share, font-size toggle, theme toggle, language selector, parent OTP gate | `app/(student)/profile/*`, `app/(student)/student/progress/*`, `app/(student)/student/revisions/*`, `app/(student)/subscribe/*`, `app/(student)/rooms/*`, `app/(student)/parent/*`, `components/student/progress/*`, `components/student/referral/*` |

**Special flows that aren't tabs but must work:**

- **Onboarding** — `/student/onboarding`, `/student/onboarding/exam-date` (31KB single file — split into steps). Profile completion gate, parent verification (`<ParentOTPGate>`), subject selection, board+grade, exam date. *Preserve every field.*
- **Diagnostic test** — `/diagnostic/[subjectId]`. First-time per subject. `components/student/diagnostic/DiagnosticFlow.tsx` (33KB) is the runtime. Followed by skill-map (`/enroll/skill-map`).
- **Enrollment** — `/enroll`, `/enroll/diagnostic-queue`, `/enroll/skill-map`. After signup, before dashboard.
- **Crunch mode** — when `daysToExam ≤ 14`, the dashboard hides XP/Weekly/Surprise sections. Show only Today's Plan + Subject Readiness + Focus. Red banner at top with the day count. Toggle in `<CrunchModeToggle>`. **Don't delete this — it's an active product feature.**
- **Free tier** — non-premium users get 3 sessions/period. Counter + upgrade flow (`<UpgradeFlow>`). When 0 sessions left, replace primary CTA with upgrade card. Pricing comes from `lib/billing/plans.ts`.
- **Day-1 nudges** — `components/Day1/*`. First-day welcome experience. Preserve.
- **Test Nudge** — `components/TestNudgePrompt.tsx` floating notification. Preserve but restyle to use `<Callout>` from design system.
- **PWA install** — `components/pwa/InstallPrompt.tsx`. Preserve; restyle.

**Sections currently in `HomeTab.tsx` (v1) that DO NOT come back:**
Welcome banner, Recovery banner (collapse into greeting line), Recently Studied (move to Learn tab), Review Queue (move to Me → Revisions), Weak Topics (collapse into Subject Readiness), Upcoming Topics (collapse into Today's Plan).

### 🟡 Parent app

The new IA: 5 tabs.

| Tab | Route | Features to preserve |
|---|---|---|
| **Home** | `/parent/dashboard` | Multi-child switcher (horizontal tabs in `<ParentDashboard>`), per-child summary card (streak, sessions/wk, days-to-exam, predicted board), AI insight ("This week"), subject readiness rows, child timezone vs parent timezone display, message-tutor + open-report CTAs |
| **Reports** | `/parent/progress/[studentId]` | `<ParentProgressDetail>` — full per-child deep dive with: ActivityHeatmap, AttentionBar, MasteryPie, SubjectRadar, WeeklyTrendChart. Period selector (week/month/all). Peer comparison. Downloadable PDF. |
| **Plan** | new — derive from existing data | Weekly plan approval (AI drafts, parent approves/adjusts), upcoming assessments view |
| **Tutor** | new — wires into existing chat | Pinned tutor session, alerts list (mock results, streak risk, achievements), direct contacts (subject tutors, support) |
| **Me** | `/parent/billing`, `/parent/settings`, `/parent/onboarding` | Subscription plan + status, add-ons, invoices, payment methods, cancel renewal, settings (`<ParentSettings>` 16KB), profile, logout |

**Special flows:**
- **Onboarding** — `/parent/onboarding` — link child via invite code or QR
- **Link child** — `/parent/link-child` (referenced in `<ParentDashboard>` empty state but route doesn't exist yet — **build it**)
- **Upgrade flow** — `<ParentUpgradeFlow>` (13KB). Plan picker + Razorpay checkout.
- **Weekly digest** — Sunday 8 PM email + WhatsApp + in-app card. New design in `docs/design/parent.html` screen 06.

### 🔴 Admin console — desktop-first

The current admin has **78 pages**. They fall into ~7 functional groups. The new admin keeps **all 78 routes** but routes them through a single shell with consistent components. Do NOT delete admin routes without explicit permission — they have backend dependencies.

| Sidebar group | Routes (preserved as-is) | Component duty |
|---|---|---|
| **Overview** | `/admin`, `/admin/dashboard` | KPI grid (DAU, sessions today, cost today, escalations, quarantined Qs, safety events), 14-day active chart, "needs attention" queue, top tutors |
| **Content** | `/admin/content`, `/admin/content-approval`, `/admin/content-engine/jobs`, `/admin/content-engine/moderation`, `/admin/content-engine/rollbacks`, `/admin/content-engine/workers`, `/admin/content-engine/audit-logs`, `/admin/content-quality`, `/admin/content-readiness`, `/admin/courses`, `/admin/syllabi`, `/admin/syllabus`, `/admin/topics`, `/admin/chapters`, `/admin/subjects`, `/admin/boards`, `/admin/classes`, `/admin/notes`, `/admin/questions`, `/admin/catalog`, `/admin/challenge`, `/admin/tests` | All content CRUD — taxonomy management, content hydration jobs, approval queue, quarantine review. Use **one** `<DataTable>` primitive for every list page. |
| **Users** | `/admin/users`, `/admin/parents`, `/admin/sessions` | Student/parent rosters, session log. Same DataTable. |
| **Learning analytics** | `/admin/learning-analytics`, `/admin/analytics/events`, `/admin/analytics/course/[id]`, `/admin/misconceptions`, `/admin/recommendations`, `/admin/charts/*`, `/admin/metrics` | Distribution histograms, heatmaps, cohort engagement, misconception clusters, recommendation engine outputs |
| **Operations** | `/admin/jobs`, `/admin/jobs/[id]`, `/admin/retry-intents`, `/admin/escalations` | Background job runner, doubt escalations queue |
| **Money** | `/admin/costs`, `/admin/payments`, `/admin/promotions` | Daily cost metrics (OpenAI/etc), payment status, promo codes |
| **System** | `/admin/system/*`, `/admin/safety`, `/admin/audit-logs`, `/admin/notifications` | System health, safety events, audit trail, push/notification status |

**Build these primitives first** (`components/admin/_primitives/`):
- `<AdminShell>` — sidebar + topbar + main, wraps every admin route
- `<PageHeader>` — title + crumbs + period selector + actions
- `<KpiCard>` — value + label + delta + sparkline
- `<DataTable>` — columns, sortable, filterable, paginated, bulk-select, row CTA
- `<FilterBar>` — chips + search + period
- `<EmptyState>` — for empty tables
- `<StatusBadge>` — replaces ad-hoc colours in current admin code

**Then refactor each existing admin page** to use these primitives. The page logic stays; only the wrapper changes. Track progress in a checklist — there are 78 of them.

### 🟣 Public / Marketing

| Route | Status |
|---|---|
| `/landing-page` | Rebuild to match `docs/design/landing.html` (mobile-first). Sections: hero, trust bar, "three things it does", product proof screenshots, "how it works" (4 steps), testimonials, pricing, FAQ, final CTA, footer |
| `/pricing` | Restyle to match landing pricing section. Use canonical `<PricingCard>` only |
| `/about`, `/contact-us`, `/privacy`, `/terms`, `/refund`, `/data-security` | Content pages — restyle with new type scale and tokens; no rewrite of copy |
| `/auth/signin`, `/auth/signup`, `/auth/role`, `/auth/error` | Restyle to match student `01 LOGIN` mock |

**Public landing components currently in use** (preserve content, restyle):
`HeroSection`, `TrustBar`, `ProblemSection`, `HowItWorksSection`, `TestimonialsSection`, `PricingSection`, `FAQSection`, `FinalCTA`, `Footer`, `SignupFormWidget`, `SignupFormEmailWidget`, `AnimatedChatClient`.

---

## Part 6 · Session-by-session build plan

Each session = one Claude Code conversation. Open the design system file at the start of every session. Don't combine.

### Session 0 · Brand cleanup pass (1 hr)
- Find/replace per Part 2 table
- One PR titled `chore: brand consistency pass`
- No visual changes yet

### Session 1 · Delete v1 dead code (30 min)
- Verify each file in Part 3 has zero live imports (grep their default-export names across the repo)
- If a file IS imported, stop and report
- One PR titled `chore: remove orphaned student v1 dashboard`

### Session 2 · Foundation (2 hr)
- Merge `docs/design/assets/tokens.css` into `app/globals.css`. Keep your existing animation keyframes
- Delete `.w-pct-*` utilities from globals.css
- Update `tailwind.config.ts`: add subject + status colours as theme tokens; collapse `font-headline / font-accent / font-body / font-cta` → `font-sans` (Inter) and `font-mono` (JetBrains)
- Verify: build the app, render `/dashboard`, screenshot. No visual regression expected — colours flow from CSS vars
- One PR titled `feat: design tokens migration`

### Session 3 · Primitive UI kit (4 hr)
Build, in `components/ui/`:
`Button`, `Chip`, `ProgressBar`, `StatTile`, `Avatar`, `Callout`, `Card`, `TopicCard`, `SubjectDot`, `DayDot`, `SectionHeader`, `Switch`, `Input`, `Score` (numeric metric component)

Each gets a TypeScript props interface matching the design system. Build a `/dev/components` Storybook-style index page rendering every variant. Get product sign-off on the page before continuing.

### Session 4 · Student layout shell (2 hr)
Rebuild `components/student/layout/Topbar.tsx` (currently 25KB — should be ~2KB). Rebuild `BottomNav.tsx` using Lucide icons. Match `docs/design/student.html` screen 03 chrome exactly.

### Session 5 · Student Home (4 hr)
Rebuild `/dashboard/page.tsx` and the contents of `components/student/dashboard/*`. Match `docs/design/student.html` screen 03.

Preserve every feature in the Student/Home row of Part 5. Use only primitives from Session 3. Keep the v2 server-data fetching logic exactly as is — only the JSX changes.

### Session 6 · Student lesson + practice (3 hr)
Rebuild `/learn/*`, `/session/*`, `/practice/*` pages. Match `docs/design/student.html` screens 04 (lesson) and 05 (practice). `<AITutorChatPanel>` is 39KB — split into `<ChatHeader>`, `<ChatBubble>`, `<ChatInput>` + container. Preserve photo upload, language toggle, escalation.

### Session 7 · Student doubts + profile (3 hr)
Rebuild doubts chat and profile/me tab + progress reports. Match `docs/design/student.html` screens 06–07.

### Session 8 · Student onboarding + diagnostic (4 hr)
Split `app/(student)/student/onboarding/page.tsx` (31KB) into stepped flow. Restyle `<DiagnosticFlow>` (33KB) without changing logic. Preserve every form field.

### Session 9 · Parent journey (4 hr)
Rebuild parent dashboard, reports, plan approval, tutor/alerts, billing. Match `docs/design/parent.html` screens 01–06. Build the missing `/parent/link-child` route. Preserve `<ParentProgressDetail>` chart components.

### Session 10 · Landing page (3 hr)
Rebuild `/landing-page` to match `docs/design/landing.html`. Strip all gradients and shadows. Preserve all content.

### Session 11 · Admin primitives (3 hr)
Build `<AdminShell>`, `<PageHeader>`, `<KpiCard>`, `<DataTable>`, `<FilterBar>`, `<EmptyState>`, `<StatusBadge>` in `components/admin/_primitives/`. Build `/admin/dashboard` to match `docs/design/admin.html` screen 01.

### Session 12+ · Admin page refactor (10+ hr across many sessions)
One Claude Code session per admin section (Content, Users, Analytics, Operations, Money, System). Each session refactors the pages in that group to use the new primitives. Logic untouched.

### Final · QA pass (2 hr)
Run the grep checks from Part 1 across the whole repo. Confirm zero gradients, zero emoji in JSX, zero arbitrary hex codes outside `globals.css`. Production build. Lighthouse on `/landing-page` and `/dashboard` mobile.

---

## Part 7 · The prompt template

Start every Claude Code session with this exact preamble:

```
Before any code change, read these files in order:
1. docs/CLAUDE_CODE_DIRECTIVE.md (this document)
2. docs/design/design-system.html (canonical spec)
3. docs/design/{student|parent|admin|landing}.html (whichever this session targets)
4. app/globals.css (token source of truth)
5. components/ui/ (primitive library)

You may NOT:
- Invent hex codes, font sizes, or spacing values
- Add gradients (bg-gradient-*)
- Add box-shadow except shadow-focus
- Use emoji in any UI
- Use font-weight > 500
- Use a subject colour for status meaning or vice versa
- Create a new colour utility class
- Add a section to a page without my approval
- Delete an admin route without my approval

If the spec is silent on something, STOP and ask me.

Today's session: [paste session number + name from Part 6]
Today's PR title: [paste]

When done:
1. Produce a diff summary listing every file touched
2. Confirm zero new hex codes (grep results)
3. Confirm zero new gradients (grep results)
4. Confirm zero new emoji in JSX (grep results)
5. List any features from Part 5 that did NOT make it in, with reason
6. Screenshot the rebuilt screen at 390px width (or 1280px for admin)
```

Paste that, then your session-specific instruction, then go.

---

## Part 8 · Decisions still owed by product

Block these before Session 5:

- [ ] **Dark mode for v1?** Currently half-implemented. Keep + audit, or strip for v1?
- [ ] **5th tab choice for Student.** Mock has `Me`. Code has `Profile`. Which label ships?
- [ ] **Crunch mode threshold.** Currently 14 days. Confirm.
- [ ] **Free-tier session count.** Code says 3. Marketing pricing page implies different.
- [ ] **Family plan: 3 children or unlimited.** Pricing page says 3, parent dashboard handles N.
- [ ] **Hindi/English support: app-wide toggle, or auto-detect from user setting?** Today it's a mix.

Once these are answered, Sessions 5+ unblock.

---

## Appendix · Files referenced by this document

| Path | Status |
|---|---|
| `app/globals.css` | Tokens go here in Session 2 |
| `app/(student)/dashboard/page.tsx` | Rebuild in Session 5 — preserve server logic |
| `components/student/dashboard/*` | Rebuild JSX in Session 5 |
| `components/student/layout/Topbar.tsx`, `BottomNav.tsx` | Rebuild in Session 4 |
| `components/student/session/*` | Rebuild in Session 6 |
| `components/student/progress/*` | Rebuild in Session 7 |
| `components/parent/*` | Rebuild in Session 9 |
| `components/admin/AdminSidebar.tsx` | Rebuild in Session 11 |
| `app/admin/dashboard/page.tsx` | Rebuild in Session 11 |
| `app/(public)/landing-page/components/*` | Rebuild in Session 10 |
| `tailwind.config.ts` | Extend in Session 2 |
| `docs/design/*.html` | Canonical mocks (this folder) |

End of document.
