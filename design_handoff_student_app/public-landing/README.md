# Public landing + auth — revamp recipe

Routes covered:
- `app/(public)/page.tsx`  (landing hero + sections)
- `app/(public)/landing-page/components/HeroSection.tsx`
- `app/(public)/auth/signup/page.tsx`     → renamed to `get-started`
- `app/(public)/auth/signin/page.tsx`     → renamed to `login`
- `app/(public)/auth/role/page.tsx`       (kept as fallback)
- `app/(public)/auth/error/page.tsx`      (token sweep only)

**Prerequisite**: Task 1 of the master handoff README has shipped — design-system tokens + primitives + `CLAUDE_ADDENDUM.md` are in place.

---

## Problem statement (why this PR exists)

1. The landing hero forces every visitor through `/auth/signup` → `/student/onboarding`. **Parents — the buyers — have no first-class path.**
2. `/auth/signup` and `/auth/signin` are visually identical and conceptually overlap. New users can't tell which is which.
3. Role is asked **after** authentication, via `/auth/role` (which only renders when status is `authenticated` AND role is `'user'`). The fallback IS the main flow — by accident.
4. Several auth pages hard-code brand hex (`#534AB7`, `#EEEDFE`, `#1D9E75`, `#EAF3DE`, `#FCEBEB`). Promote to tokens.

## Target model

```
LANDING
  ├─ Navbar "Log in"  ───────► /auth/login        (returning users)
  └─ Hero "Get started free" ─► /auth/get-started  (NEW — role first)
                                       │
                                       ├─ Student tile ─► Google with role=student → /student/onboarding
                                       └─ Parent tile  ─► Google with role=parent  → /parent/onboarding
```

`/auth/role` stays as a safety-net (e.g. Google callback edge cases that bypass role intent), not the primary flow.

---

## STEP 1 — Token sweep across `app/(public)/auth/*` (zero behavior change)

Pure refactor. Replace literal hex with the design-system tokens.

| Replace | With |
|---|---|
| `bg-[#534AB7]`, `text-[#534AB7]` | `bg-primary`, `text-primary` |
| `hover:bg-[#4338A0]`, `hover:bg-[#4840a3]` | `hover:bg-primary-hover` |
| `bg-[#EEEDFE]` | `bg-primary-bg` |
| `text-[#1D9E75]`, `bg-[#1D9E75]`, `border-[#1D9E75]` | `text-success`, `bg-success`, `border-success` |
| `bg-[#EAF3DE]` | `bg-success-bg` |
| `bg-[#FCEBEB]`, `border-[#E24B4A]/20`, `text-[#E24B4A]` | `bg-error-bg`, `border-error/20`, `text-error` |
| inline spinner div `w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin` | new `<Spinner />` primitive (add to design-system) |
| inline Google SVG (copied 3 places) | new `<GoogleLogo />` icon (add to design-system) |

Files affected:
- `app/(public)/auth/signin/page.tsx`
- `app/(public)/auth/signup/page.tsx`
- `app/(public)/auth/role/page.tsx`
- `app/(public)/auth/error/page.tsx`

Add to `components/UI/design-system/`:
- `Spinner.tsx` — props `{ size?: 'sm'|'md'|'lg' }`. Uses `border-primary`. `'use client'` not required (pure SVG/CSS).
- `GoogleLogo.tsx` — the 4-color "G" SVG, props `{ size?: number }`.

**Gate**. Commit. PR title: `chore(auth): token + primitive sweep across (public) auth pages`.

---

## STEP 2 — Build `/auth/get-started` (role-first signup)

Create `app/(public)/auth/get-started/page.tsx` based on the visual pattern in the existing `/auth/role/page.tsx`, BUT:
- It renders for **unauthenticated** users (not after auth like `/auth/role` does)
- Clicking a role tile starts Google sign-in with the right `callbackUrl` baked in — role is decided BEFORE auth, not after
- Send the role intent through to NextAuth via the existing `set-role` API pattern. Persist the chosen role in URL params or a cookie so the post-callback handler routes to the right onboarding.

### Anatomy

`<Card variant="hero" padding="hero">` wrapper with:

- Eyebrow `Welcome`
- `text-3xl font-headline` headline: **"Who's learning today?"**
- `text-base text-muted-foreground` subline: **"We'll set things up just for you."**
- 2 `<RoleTile>` components stacked (or 2-col on `sm:`)
- Below: `<Pill intent="ghost">` link "Already have an account? Log in →" → `/auth/login`
- Below that: small trust line `FREE_SESSIONS_TEXT · No credit card · Cancel anytime`

### `<RoleTile>` (new local component — NOT a design-system primitive yet; if it gets reused, promote later)

```tsx
function RoleTile({
  role,                  // 'student' | 'parent'
  title,                 // 'I'm a student' | 'I'm a parent'
  description,           // one-line
  bullets,               // 2-3 micro-bullets
  glyph,                 // <BookOpenIcon /> | <UsersIcon /> from your icon set
  accent,                // 'primary' | 'success' — drives bg/border tints
  onClick,
  loading,
}: RoleTileProps) {
  const bg     = accent === 'primary' ? 'bg-primary-bg'  : 'bg-success-bg';
  const border = accent === 'primary' ? 'border-primary' : 'border-success';
  const text   = accent === 'primary' ? 'text-primary'   : 'text-success';
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={[
        'w-full text-left p-5 rounded-2xl border-2 transition-all duration-200',
        'min-h-[44px] flex items-start gap-4',
        'hover:-translate-y-px hover:shadow-press-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        bg, border,
      ].join(' ')}
    >
      <span className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl ${text} bg-card`}>
        {glyph}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-headline font-bold text-lg ${text}`}>{title}</span>
        <span className="block text-sm text-muted-foreground mt-1">{description}</span>
        <ul className="mt-3 space-y-1">
          {bullets.map(b => (
            <li key={b} className="text-xs text-foreground/70 flex items-start gap-1.5">
              <CheckIcon className="w-3.5 h-3.5 mt-0.5 text-success shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </span>
      <ChevronRightIcon className={`w-5 h-5 ${text} shrink-0 mt-2`} />
    </button>
  );
}
```

### Copy

**Student tile**
- Title: `I'm a student`
- Description: `Get instant help with homework and doubts.`
- Bullets: `Adaptive practice across CBSE / ICSE / State` · `Hindi or English, 24×7` · `${FREE_SESSIONS_TEXT}`
- Accent: `primary`

**Parent tile**
- Title: `I'm a parent`
- Description: `Set up an account for your child and see their progress.`
- Bullets: `Weekly progress digest by email` · `Set daily study targets` · `Monitor multiple children`
- Accent: `success`

### Click handler

```ts
async function handleRoleSelect(role: 'student' | 'parent') {
  setLoading(true);
  const callbackUrl = role === 'parent'
    ? '/parent/onboarding'
    : '/student/onboarding';
  // Persist the intent in case the OAuth callback drops query params.
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('spinzy_role_intent', role);
  }
  await signIn('google', { callbackUrl });
}
```

In `lib/auth/post-signin.ts` (or wherever the callback handler is), read `sessionStorage.getItem('spinzy_role_intent')` on first sign-in and POST to `/api/auth/set-role` so the user's `role` field is set immediately. If sessionStorage is empty (incognito, third-party device, etc.), fall back to `/auth/role` — its existing purpose.

### Add a `?source=parent_invite` short-circuit

If the URL has `?inviteCode=XXX`, skip the role chooser and go straight to the parent Google flow with `callbackUrl=/parent/onboarding?inviteCode=…`. Existing `signin/page.tsx` already has this logic — port the same `buildParentOnboardingCallback` helper.

**Gate**. Commit. PR title: `feat(auth): role-first /auth/get-started signup entry`.

---

## STEP 3 — Rename `/auth/signin` → `/auth/login`, simplify

Login is for **returning users only**. Drop the role/intent ambiguity.

1. Move `app/(public)/auth/signin/page.tsx` to `app/(public)/auth/login/page.tsx`.
2. Add a permanent redirect in `app/(public)/auth/signin/page.tsx`:
   ```ts
   import { redirect } from 'next/navigation';
   export default function SigninRedirect() { redirect('/auth/login'); }
   ```
3. Inside `login/page.tsx`:
   - Replace the literal hex with tokens (Step 1)
   - Headline: **"Welcome back"** (not "Welcome to Spinzy Academy")
   - Subline: **"Sign in to continue."**
   - Below the magic-link form: small ghost link `New to Spinzy? Get started free →` → `/auth/get-started`
   - Keep the existing email magic-link + Google flow exactly as it is (well-tested)
4. Update `StickyHeader.tsx` (the public navbar): the "Log in" button should `href="/auth/login"`. The hero/page "Get started" CTAs should `href="/auth/get-started"`.

### Rename `/auth/signup` too

1. Move `app/(public)/auth/signup/page.tsx` to `app/(public)/auth/get-started/page.tsx`.
2. Add a redirect in `app/(public)/auth/signup/page.tsx`:
   ```ts
   import { redirect } from 'next/navigation';
   export default function SignupRedirect() { redirect('/auth/get-started'); }
   ```
3. The existing email and Google handlers move into the role tile callbacks above.

### Update every link in the codebase

Grep and update:
```bash
grep -rln "/auth/signup" app/ components/ lib/  # → /auth/get-started
grep -rln "/auth/signin" app/ components/ lib/  # → /auth/login
```

Most of these are CTAs in landing components (`HeroSection`, `FinalCTA`, `Footer`, `Navbar`, `PricingSection`). Update them; the redirects above catch anything missed.

**Gate**. Commit. PR title: `refactor(auth): /auth/signup → /auth/get-started, /auth/signin → /auth/login`.

---

## STEP 4 — Compress and refocus `HeroSection.tsx`

The hero has too many competing elements. Decide on ONE focal CTA, ONE supporting trust strip, ONE supporting visual. Cut the rest.

### Keep
- Branded eyebrow chip (`Trusted by 1 Lakh+ Indian families`)
- Headline + accent line + 1-line subhead (drop the 2nd "Class 1-12 | …" subhead — move it into the trust row)
- Primary CTA: `Get started free` → `/auth/get-started`
- Secondary CTA: `See how it works` (smooth-scroll anchor) — `<Button variant="ghost">`
- Trust strip (3 short pills — pick the 3 strongest)
- Right-column hero image with Teacher Vidya avatar overlay

### Cut
- Rotating testimonial inside the hero (already a dedicated `TestimonialsSection` — duplication)
- The 2 floating stat cards (`5L+ Questions Solved`, `Phone Works`). Move BOTH into `TrustBar.tsx` instead, as a stat row
- The 3 inline checkmark items (`3 free sessions · No credit card · Setup in 2 minutes`) — keep ONE of these only, the strongest one (free sessions), as a single subtle line under the CTAs

### Add — parent path acknowledgement

Directly under the CTA row, add a small ghost link:

```tsx
<p className="text-sm text-muted-foreground mt-3">
  Buying for your child?
  <Link
    href="/auth/get-started?source=parent"
    className="ml-1 font-medium text-primary underline-offset-2 hover:underline"
  >
    Start as a parent →
  </Link>
</p>
```

This is the only place on the homepage where parents are addressed explicitly. The `?source=parent` query lets the get-started page auto-highlight the Parent tile (visual: 1px ring on the parent tile, "Recommended for you" pill).

### Token cleanup in HeroSection.tsx

Most classes are already on `brand-*` tokens — good. Replace:

| Replace | With |
|---|---|
| `bg-brand-primary` | `bg-primary` |
| `bg-brand-primary-bg` | `bg-primary-bg` |
| `bg-brand-success` | `bg-success` |
| `bg-brand-success-bg` | `bg-success-bg` |
| `text-brand-primary` | `text-primary` |
| `hover:bg-brand-primary-hover` | `hover:bg-primary-hover` |

Use the new design-system `<Button variant="primary">` / `<Button variant="ghost">` instead of hand-rolled buttons:

```tsx
<Button variant="primary" leftIcon={<SparklesIcon />} asChild>
  <Link href="/auth/get-started">Get started free</Link>
</Button>
<Button variant="ghost" leftIcon={<PlayIcon />} onClick={handleSeeHow}>
  See how it works
</Button>
```

(If `<Button asChild>` isn't implemented, just use `<Link>` inside `<Button>` or add an `as` prop. Document either way.)

**Gate**. Commit. PR title: `refactor(landing): compress hero + acknowledge parent path`.

---

## STEP 5 — Misc landing-page polish (optional, can defer)

- `FinalCTA.tsx`: same `<Button variant="primary">` + same `/auth/get-started` target
- `PricingSection.tsx`: pricing card CTAs → `/auth/get-started`
- `Footer.tsx`: top "Log in" link → `/auth/login`, "Get started" link → `/auth/get-started`
- `StickyHeader.tsx`: nav button copy: "Log in" (returning) is the only nav button; CTA "Get started" can appear on `lg:` only, beside it

---

## Hard rules

- Mobile-first 360px. Role tiles stack vertically below `sm:`, side-by-side `sm:` and up.
- `min-h-[44px]` on every tile/button (RoleTile is ~120px tall — already fine).
- `dark:` variants on every color reference. Use CSS-var classes (`bg-primary-bg` etc.) — they handle dark automatically.
- No new npm dependencies.
- No referral copy — the parent tile's "Monitor multiple children" is product copy, not referral.
- No hex literals in committed `.tsx` files after Step 1 ships.
- Pre-commit: smart quotes + tsc clean. Gate green between every step.

---

## Tests

For `/auth/get-started`:
- renders both role tiles when unauthenticated
- clicking student tile calls `signIn('google', { callbackUrl: '/student/onboarding' })`
- clicking parent tile calls `signIn('google', { callbackUrl: '/parent/onboarding' })`
- `?inviteCode=XYZ` short-circuits to the parent flow (no role chooser shown)
- `?source=parent` highlights the parent tile with "Recommended for you" pill
- authenticated users get redirected to their dashboard (mirror the existing `/auth/signup` redirect behavior)
- "Already have an account? Log in" link points to `/auth/login`

For `/auth/login`:
- renders Google + email magic link
- "New to Spinzy? Get started free" link points to `/auth/get-started`
- legacy `/auth/signin` route 308s to `/auth/login`

For Hero:
- "Buying for your child?" subline is present and links to `/auth/get-started?source=parent`

---

## Acceptance: how the user flow looks after this PR

1. Visitor lands on `/` — single confident headline, single primary CTA "Get started free", small "Buying for your child? Start as a parent →" right under it. Navbar shows "Log in" only.
2. Clicks "Get started free" → `/auth/get-started` → two large tiles ("I'm a student" / "I'm a parent"). Each tile has 3 micro-bullets so the visitor sees exactly what they get before clicking.
3. Picks a tile → Google sign-in. After callback, lands directly on the right onboarding (`/student/onboarding` OR `/parent/onboarding`). Role is set server-side; `/auth/role` is never visited.
4. Returning user clicks "Log in" → `/auth/login` → Google or email → dashboard (or onboarding if incomplete).
5. Parent who got an invite link (`?inviteCode=…`) skips the tile chooser entirely.
