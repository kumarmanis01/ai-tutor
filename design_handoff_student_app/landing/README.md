# Public landing page · audit + revamp recipe

**Routes covered**
- `app/(public)/page.tsx` → renders `<LandingPageInteractive>`
- `app/(public)/landing-page/components/*` → Hero, TrustBar, HowItWorks, Problem, Testimonials, Pricing, FAQ, FinalCTA, Footer
- `app/(public)/auth/signup/page.tsx` (Google OAuth entry)
- `app/(public)/auth/signin/page.tsx`
- `app/(public)/auth/role/page.tsx` (post-auth Student/Parent picker)

**Prerequisite**: Task 1 of the dashboard/profile handoff (design-system foundation) is live. That gave you `<Button>`, `<Card>`, `<Pill>`, and brand tokens. We compose with them here.

---

## Audit findings

### 1. The "who is this for" question never gets answered on the page

The whole hero — copy, image, testimonials, CTAs — is voiced for **students**. There is one CTA: "Start For Free" → `/auth/signup`. A parent visiting the page has to imagine themselves into the experience, then trust that the signup flow will route them correctly. It only does so after they go through Google OAuth and land on `/auth/role` to pick "I am a Parent." That's three steps of uncertainty for the audience that pays the bills.

> **Impact**: parents either bounce, sign up as the student by accident, or end up needing support. None of these is good.

### 2. "Log in" is missing as a top-level affordance

The header has `[How It Works] [Pricing] [Success Stories]` and a single fat purple `Start Learning Now!` button. Returning users have no signposted way to log in — they have to click "Start Learning Now!" and figure out from the signup page that Google can also log them in. Worse: the auth page is literally titled `signup` even though it handles login too.

### 3. Density and visual noise in the hero

The hero stacks:
- Mint trust pill
- 3-line headline
- Eyebrow tagline
- 2-line body
- A second purple meta line (`Class 1-12 | CBSE / ICSE / State Board | Instant doubt solving in Hindi and English`)
- 3 trust pills row
- 2 buttons
- 3 inline trust ticks
- Rotating testimonial card
- Vidya avatar with caption
- Image with 4 overlay cards including a duplicated "Phone works smoothly / Phone Works!" tile (visible typo in `HeroSection.tsx` lines 144-145)

Half of this should move below the fold or merge.

### 4. Brand colors are hard-coded as hex literals

`#534AB7`, `#EEEDFE`, `#1D9E75`, `#EAF3DE`, `#FCEBEB`, `#E24B4A` appear in `auth/role/page.tsx`, `auth/signup/page.tsx`, and a few section components. After the design-system foundation lands, these are token violations — they must be `bg-primary`, `bg-primary-bg`, etc. (See `CLAUDE_ADDENDUM.md` rule: "no hex in `.tsx` files outside `lib/theme/brand.ts`").

### 5. Hand-rolled buttons everywhere

Each section spells out `className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 py-3 ..."`. Every one of these should be `<Button variant="primary">`. The footer, hero, role page, signup page, pricing CTA, FAQ CTA, FinalCTA all reinvent the same shape.

### 6. Inconsistent voice

- Hero: "Turn doubts into confidence with Spinzy AI Tutor"
- Header button: "Start Learning Now!"
- Hero primary: "Start For Free"
- Role page heading: "Welcome! Tell us about yourself"
- Auth heading: "Welcome to Spinzy Academy"

Four different welcomes. The brand isn't sure what to call itself out loud (`Spinzy AI Tutor` vs `Spinzy Academy` vs just `Spinzy`).

### 7. No parent-voiced content anywhere

The "Problem" section (`ProblemSection.tsx`) addresses pain points but in student-second-person. There's no copy for parents: weekly reports, exam-readiness visibility, the ₹399 vs ₹3000 tuition saving, parental controls. Adding even a single section ("For parents: see exactly what your child is learning") would let parents self-identify.

---

## Recommended changes

### A. Audience-aware header

Replace the current single-CTA header:

```
[Logo] [How it works] [Pricing] [Success stories] [For parents]   [Log in]  [Sign up →]
```

- **New nav link "For parents"** scrolls to (or links to) a parent-specific section/page that addresses them in their voice.
- **"Log in"** is a quiet text link styled as a `<Button variant="ghost">`. Distinct from sign-up. Routes to `/auth/signin` (currently `auth/signup` handles both — keep but split the entry points for clarity).
- **"Sign up →"** is the primary `<Button variant="primary">`. Replaces "Start Learning Now!". Routes to `/auth/signup`.

Mobile: collapse nav links into a sheet; surface only `Log in · Sign up` as visible top-right actions.

### B. Hero: two-path CTA split

Replace the single `Start For Free` + `See how it works` row with:

```
┌────────────────────────────┐   ┌────────────────────────────┐
│   I am a student           │   │   I am a parent            │
│   Start learning – free    │   │   See it for my child      │
│   ─────────────────────    │   │   ─────────────────────    │
│   Class 1–12 · CBSE/ICSE   │   │   Weekly reports · ₹399    │
└────────────────────────────┘   └────────────────────────────┘
              Already have an account?  Log in →
```

Implementation:

- Two `<Card variant="default" padding="compact">` blocks side-by-side. Each is a clickable `<Link>` wrapping its content.
- Student card: warm-bordered (`border-l-4 border-l-primary`) + primary action color, eyebrow "I am a student", title "Start learning — it's free", small meta line, trailing arrow.
- Parent card: `border-l-4 border-l-success` + success accent, eyebrow "I am a parent", title "See it for my child", trailing arrow.
- Each card sets a query param when clicked: `/auth/signup?role=student` and `/auth/signup?role=parent`. The auth page reads `searchParams.get('role')` and stores it in `sessionStorage`; after Google OAuth, `/auth/role` reads it and short-circuits straight to the matching dashboard (or the role-set API).
- Below the two cards: small line `Already have an account? <Link className="text-primary underline">Log in</Link>`.

**Why this works**: parents and students self-identify in ONE click. The signup flow knows their role before they ever see the role-select page. The role-select page only renders as a fallback for legacy/ambiguous flows.

### C. Hero density cuts

Inside `HeroSection.tsx`:

- Remove the duplicate meta line `Class 1-12 | CBSE / ICSE / State Board | Instant doubt solving in Hindi and English` — the TrustBar already says this.
- Combine the rotating testimonial card with the existing 3-pill trust row — they're both "social proof" eating different vertical space. Keep the testimonial, drop the pills (they reappear in TrustBar).
- Fix the visible typo on lines 144–145 in `HeroSection.tsx`:
  ```diff
  - <p className="font-body text-xs text-muted-foreground">Phone works smoothly</p>
  - <p className="font-body text-xs text-muted-foreground">Phone Works!</p>
  + <p className="font-body text-sm font-medium text-foreground">Works on any phone</p>
  + <p className="font-body text-xs text-muted-foreground">Runs on 2 GB RAM, 4G</p>
  ```
- Drop the "See how it works" button now that the path split is the primary CTA pair. Replace with the small "Log in" link beneath.

### D. New "Who is Spinzy for" section

Slot between `<TrustBar>` and `<HowItWorksSection>`. Two columns, parent + student:

| For students | For parents |
|---|---|
| Instant doubts solved, in Hindi or English. | See exactly what your child is learning. |
| Adaptive practice that finds your weak spots. | Weekly progress emails — no app needed. |
| Mastery checks, not memorisation. | Exam readiness across every subject. |
| Streak + XP that make learning a habit. | ₹399/month vs ₹3,000+ for tuition. |
| → Start learning free | → Set up a parent account |

Each column = `<Card variant="warm" padding="normal">` with a heading, 4 bullets (subject-tinted check icons), and a primary CTA. The student card links to `/auth/signup?role=student`; parent card to `/auth/signup?role=parent`.

This is the section that finally addresses parents in their own voice.

### E. Refactor existing sections onto the design system

Search-and-replace level (do as one cleanup PR after the audience-aware changes ship):

- All hand-rolled buttons (e.g. `inline-flex … bg-brand-primary px-6 py-3 …`) → `<Button variant="primary">` / `<Button variant="ghost">`
- Hero trust pills (`rounded-full border border-border bg-card/90 px-4 py-2 text-sm font-medium`) → `<Pill intent="ghost">`
- "Trusted by 1 Lakh+ Indian families" badge → `<Pill intent="mint" leftIcon={<CheckBadge/>}>`
- Floating stat callouts on the hero image (`5L+`, `Phone Works!`) → `<Card variant="default" padding="compact">`
- Hex literals in `auth/signup/page.tsx`, `auth/signin/page.tsx`, `auth/role/page.tsx` → token utilities (`bg-primary`, `bg-primary-bg`, `text-success`, `border-success`, etc.)

Don't change copy in this PR — pure refactor. Each component should look pixel-near identical, just composed from the new primitives.

### F. Auth page revamp (sign up vs log in)

Currently `/auth/signup` does both: Google OAuth signs in if you have an account, signs up if you don't. That's *technically* fine for Google but visually misleading.

Changes:

1. **`/auth/signup` page**:
   - Read `?role=student|parent` and persist to `sessionStorage` as `spinzy_signup_role`
   - Heading: "Create your Spinzy account" (not generic "Welcome to Spinzy Academy")
   - Below Google button: small toggle "Already have an account? <Link>Log in →</Link>" → `/auth/signin`
   - Trust line keeps `FREE_SESSIONS_TEXT · No credit card · Cancel anytime`
2. **`/auth/signin` page** (new or upgrade existing):
   - Heading: "Welcome back"
   - Same Google button but copy "Log in with Google"
   - Below: "New here? <Link>Sign up →</Link>" → `/auth/signup`
3. **`/auth/role` page (improved)**:
   - On mount, read `sessionStorage.spinzy_signup_role`. If present and valid, auto-submit via the same `/api/auth/set-role` POST. Show a small loading state during the redirect — user never sees the picker.
   - Falls back to the picker UI only when no role hint exists (legacy flows, edge cases).
   - Restyle the two role cards: use `<Card>` with `border-l-4 border-l-primary` (student) and `border-l-4 border-l-success` (parent). Replace emoji with `<Icon name="AcademicCapIcon">` and `<Icon name="UserGroupIcon">` (existing icon set).

### G. Copy alignment

Decide a single name and stick to it. Suggestion: brand = **Spinzy**, product = **Spinzy AI Tutor**, tutor = **Vidya**. Then:

| Surface | Copy |
|---|---|
| Hero title | "Turn doubts into confidence — with Spinzy AI Tutor." |
| Header sign-up button | "Sign up →" |
| Header log-in link | "Log in" |
| Student card CTA | "Start learning — free" |
| Parent card CTA | "See it for my child" |
| Auth signup heading | "Create your Spinzy account" |
| Auth login heading | "Welcome back" |
| Role select fallback heading | "Tell us about yourself" |

---

## Implementation order

Stays consistent with the master handoff's "one task = one PR, green gate between" discipline.

### Task L1 — Audience-aware path split (HIGHEST VALUE)
- Update `HeroSection.tsx`: replace single CTA with the two-card path split + small "Log in" link
- Update header (lives in `app/(public)/layout.tsx` or in a Header component imported there): add "For parents" nav link + "Log in" link + "Sign up" button
- Wire `?role=` query param read-through:
  - `auth/signup/page.tsx` → reads `?role`, stores in `sessionStorage`
  - `auth/role/page.tsx` → reads `sessionStorage`, auto-submits when present
- Fix the duplicate "Phone Works!" typo in `HeroSection.tsx`
- Remove the redundant `Class 1-12 | CBSE / ICSE …` meta line in hero (it lives in TrustBar)
- **Gate**: green build + tests + smoke through both Student and Parent flows. PR title: `feat(landing): audience-aware path split`.

### Task L2 — Parent-voiced content section
- New component `app/(public)/landing-page/components/AudienceSplitSection.tsx`
- Insert in `LandingPageInteractive.tsx` between TrustBar and HowItWorksSection
- Two warm cards, parent + student bullets, primary CTAs to `/auth/signup?role=*`
- **Gate**: green. PR title: `feat(landing): for-parents section`.

### Task L3 — Auth pages restyle
- Split `auth/signup/page.tsx` into clearer "Create account" framing
- Add/upgrade `auth/signin/page.tsx` with "Welcome back" framing
- Cross-link them with "Already have an account?" / "New here?" toggles
- Restyle `auth/role/page.tsx` cards to use `<Card>` + `<Icon>` instead of emojis + raw hex borders
- **Gate**: green. PR title: `refactor(auth): split sign-up and log-in framing`.

### Task L4 — Section refactor onto primitives (cleanup)
- Replace hand-rolled buttons with `<Button>`
- Replace inline pill markup with `<Pill>`
- Replace hex literals (`#534AB7` etc.) with token utilities
- Touch every section in `landing-page/components/`
- No copy/layout change — pure refactor
- **Gate**: green. PR title: `chore(landing): adopt design system primitives`.

---

## What you don't need to change

- **`<TrustBar>`** — does its job, leave alone (touch in Task L4 only for token alignment).
- **`<HowItWorksSection>`** — solid; restyle on L4.
- **`<PricingSection>`** — restyle in L4. Avoid changing pricing copy without product sign-off.
- **`<TestimonialsSection>`** — leave content; restyle in L4.
- **`<FAQSection>`** — leave content; restyle in L4.
- **`<FinalCTA>`** — change in L1 to mirror the hero's two-path split (so the final CTA also gives parents an entry).
- **`<Footer>`** — restyle in L4.
- **Pricing / Privacy / Terms / Refund / Contact / About pages** — restyle in L4 only.

---

## See also

- `design_files/landing-hero.html` — mock of the new hero with the role-split CTAs
- `design_files/role-select.html` — mock of the redesigned `/auth/role` picker (used as a fallback)
- `design_handoff_student_app/design-system/COMPONENTS_AND_PATTERNS.md` — full primitive specs
