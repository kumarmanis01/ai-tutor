<!--
FILE OBJECTIVE:
- Jira tasks for the Landing Page: implementable, testable, and trackable tasks to build a performant, accessible marketing site.

LINKED UNIT TEST:
- tests/unit/docs/V3/Landing Page.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-04-23T12:00:00Z | copilot | add standard file header
-->

# Jira Tasks: Landing Page (Implementable & Trackable)

Here are your landing page tasks formatted for direct Jira import, organized by epic with acceptance criteria, story points, dependencies, and technical specifications.

---

## Epic: Landing Page Shell & Performance

**Epic Goal:** Fast, responsive, accessible foundation for all landing page content.

---

### TASK-LP-001: Landing Page Shell with Responsive Layout

| Field | Value |
|-------|-------|
| **Summary** | Build Next.js landing page shell with navbar, footer, and performance optimization |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | None |

**Acceptance Criteria:**

**Performance:**
- [ ] Lighthouse mobile score ≥90 (Performance), ≥95 (Accessibility), ≥90 (Best Practices)
- [ ] First Contentful Paint (FCP) < 1.5s on 4G throttling (using Lighthouse)
- [ ] Time to Interactive (TTI) < 3s on 4G throttling
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] Largest Contentful Paint (LCP) < 2.5s

**Navbar:**
- [ ] Sticky on scroll (position: sticky, top: 0, z-index: 50)
- [ ] Logo "Spinzy." on left (SVG, 32px height)
- [ ] Desktop (≥1024px): Links visible inline — "How It Works" | "Pricing" | "FAQ" | "For Schools"
- [ ] Mobile (<1024px): Hamburger menu icon, slide-out drawer from right with same links
- [ ] CTA button: "Start Free" (#FF6B35, 44px min height, rounded-full)
- [ ] Navbar background: white with 0.95 backdrop-blur on scroll (bg-white/95 backdrop-blur-sm)

**Footer:**
- [ ] Dark background (#1A2E45), white text
- [ ] Desktop: 3 columns
  - Column 1: "Spinzy Academy © 2026. Made in India 🇮🇳"
  - Column 2: Links — Privacy Policy, Terms of Service, Refund Policy, DPDP Compliance
  - Column 3: Contact — hello@spinzyacademy.com, WhatsApp link (wa.me), Twitter/X link
- [ ] Mobile: Single column, stacked, centered text
- [ ] "Download on Play Store" badge (if app exists, else placeholder)

**Tech Stack:**
- [ ] Next.js 14+ App Router with `app/page.tsx`
- [ ] Tailwind CSS for styling
- [ ] Fonts: Google Fonts Roboto (English) + Noto Sans Devanagari (Hindi) via `next/font`

**Components to create:**
- `Navbar.tsx` (Client component for mobile menu state)
- `Footer.tsx` (Server component)
- `MobileMenu.tsx` (Client component, headlessui Dialog)

**QA Checklist:**
- [ ] Test on: iPhone SE (375px), Pixel 5 (393px), iPad (768px), Desktop (1440px)
- [ ] Hamburger menu opens/closes smoothly on mobile
- [ ] No horizontal scroll on any screen size
- [ ] Hindi text renders without tofu (missing character boxes)

---

### TASK-LP-002: Google Sign-In Integration on All CTAs

| Field | Value |
|-------|-------|
| **Summary** | Wire all "Start Free" CTAs to Google OAuth with redirect handling |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-LP-001, Backend auth service |

**Acceptance Criteria:**

**Frontend:**
- [ ] All "Start Free" buttons (Navbar, Hero, Pricing, Final CTA) use same onClick handler
- [ ] Google OAuth via `@react-oauth/google` — popup mode on desktop, redirect mode on mobile
- [ ] Loading state during OAuth: button text → "Redirecting..." + disabled + spinner icon
- [ ] On success: Redirect to `/onboarding` if new user, `/dashboard` if existing user with child profiles
- [ ] On error: Toast notification "Sign-in failed. Please try again" + retry option
- [ ] Store OAuth callback route in `NEXT_PUBLIC_GOOGLE_REDIRECT_URI`

**Environment Variables:**
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://spinzyacademy.com/api/auth/callback
BACKEND_AUTH_URL=https://api.spinzyacademy.com/v1/auth/google
```

**Backend Integration:**
- [ ] POST to `/api/v1/auth/google` with `{ idToken: credential }`
- [ ] On response: Store JWT in `localStorage` (or HTTP-only cookie)
- [ ] Redirect based on `user.hasChildProfiles`

**QA Checklist:**
- [ ] Fresh Gmail account → redirects to `/onboarding`
- [ ] Existing user with child → redirects to `/dashboard`
- [ ] Incognito mode → full OAuth flow completes
- [ ] Cancel OAuth popup → returns to page, no error
- [ ] Mobile Chrome (already signed into Google) → one-tap works

---

## Epic: Hero Section

**Epic Goal:** Address parent safety concerns within first 5 seconds of page load.

---

### TASK-LP-003: Hero Section with Trust-First Messaging

| Field | Value |
|-------|-------|
| **Summary** | Build hero section with trust badges, parent-focused headline, and illustration |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Content:**
- [ ] Trust badge bar (horizontal scroll on mobile, static row on desktop):
  - "🛡️ DPDP Compliant" | "👁️ No Tracking" | "📵 No Social Features" | "🇮🇳 Servers in India"
- [ ] Headline: "The AI Tutor That Asks YOUR Permission First"
- [ ] Hindi alternate: "AI Tutor जो पहले आपकी अनुमति लेता है"
- [ ] Subheadline: "Spinzy Academy lets your child learn with an AI tutor while you control what they access, for how long, and what data is shared."
- [ ] CTA: "Start Free — Sign in with Google" (#FF6B35, 48px min height, full width on mobile)
- [ ] Below CTA: "3 free sessions per month · No credit card · Setup in 2 minutes" (text-sm, text-gray-500)
- [ ] Social proof: "Trusted by 1 Lakh+ Indian families" + avatar mosaic (5 abstract circles)

**Visual:**
- [ ] Illustration: Parent phone (approval screen) → connected to child tablet (learning screen)
- [ ] Illustration format: SVG or Lottie, <50KB, lazy-loaded
- [ ] Illustration alt text: "Parent approving child's access to Spinzy Academy"

**Layout:**
- [ ] Hero section min-height: 100vh on mobile, 90vh on desktop
- [ ] Padding: pt-20 pb-12 on mobile, pt-32 pb-20 on desktop
- [ ] Background: White to subtle #F9FAFB gradient

**Animation:**
- [ ] Fade-in-up animation on headline (duration: 0.5s, ease-out)
- [ ] Only on first paint — no re-trigger on scroll
- [ ] No animation on trust badges (avoid CLS)

**QA Checklist:**
- [ ] Headline fully visible without scroll on iPhone SE
- [ ] Trust badges visible on 360px width (horizontal scroll indicator shows if needed)
- [ ] Illustration doesn't push CTA below fold
- [ ] Hindi text displays correctly

---

## Epic: Trust Moat Section

**Epic Goal:** Build confidence through clear explanation of safety and privacy controls.

---

### TASK-LP-004: Trust Moat Section — DPDP & Safety Icons

| Field | Value |
|-------|-------|
| **Summary** | Build 4-card grid explaining DPDP compliance, no tracking, no social features, data localization |
| **Story Points** | 5 |
| **Priority** | P0 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Section Header:**
- [ ] Headline: "Built for Indian Parents. Designed for Indian Law."
- [ ] Hindi: "माता-पिता के लिए बनाया गया। भारतीय कानून के अनुसार।"
- [ ] Section background: #F4F7FC (distinct from hero white)

**4 Cards (2×2 grid on mobile, 4×1 on desktop):**

| Icon | Title | Description |
|------|-------|-------------|
| 🛡️ | DPDP Compliant | We follow India's Digital Personal Data Protection Act. Your child's data is processed lawfully, with your consent. |
| 👁️ | No Tracking | We don't monitor your child's behavior for advertising. No third-party trackers. No data sold. |
| 📵 | No Social Features | No chat rooms. No friend requests. No reels. Just focused learning with an AI tutor. |
| 🇮🇳 | Data Stays in India | All data is stored on servers in Mumbai. Encrypted at rest and in transit. |

**Card styling:**
- [ ] Padding: p-6, rounded-xl, bg-white, shadow-sm
- [ ] Icon: text-4xl mb-4
- [ ] Title: font-semibold text-lg mb-2
- [ ] Description: text-gray-600 text-sm
- [ ] Hover effect (desktop only): shadow-md transition-all duration-200

**Parent Dashboard Preview:**
- [ ] Below 4 cards: Phone mockup frame (PNG or SVG) showing actual Parent Dashboard UI
- [ ] Caption: "See every topic your child studies. Set limits. Block subjects. All from your phone."
- [ ] Link: "Learn more about Parent Controls →" (scrolls to How It Works section)
- [ ] Phone mockup image lazy-loaded (loading="lazy")

**QA Checklist:**
- [ ] Cards wrap to single column on 360px width if needed
- [ ] Dashboard preview image crisp on 2x retina displays
- [ ] Section visually distinct from Hero (different background)
- [ ] Hindi text in section header renders correctly

---

## Epic: How It Works Section

**Epic Goal:** Explain dual-track experience for students and parents.

---

### TASK-LP-005: How It Works — Dual-Track Journey

| Field | Value |
|-------|-------|
| **Summary** | Build side-by-side student and parent journey with step cards |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Section Header:**
- [ ] Headline: "How Spinzy Works — For Students & Parents"
- [ ] Hindi: "Spinzy कैसे काम करता है — छात्रों और माता-पिता के लिए"

**Layout:**
- [ ] Desktop (≥1024px): CSS Grid `grid-cols-2` gap-12
  - Left column: Student Journey (3 step cards)
  - Right column: Parent Journey (3 step cards)
- [ ] Mobile (<1024px): Tab component
  - Tab 1: "For Students" | Tab 2: "For Parents"
  - Only active tab visible
  - Tab indicator underline animation

**Student Journey Steps:**

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 01 | 📋 | Take a 15-min Diagnostic | Teacher Vidya maps your knowledge gaps across every chapter. No stress — it's just a starting point. |
| 02 | 🤖 | Learn Socratically from AI | No lectures. Teacher Vidya asks you questions, gives hints, and guides you to the answer. |
| 03 | ✨ | Request Any Topic | Can't find a topic? AI generates curriculum-aligned notes and practice questions in ~30 seconds. |

**Parent Journey Steps:**

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 01 | ✅ | Approve & Set Limits | You decide what subjects your child can access and for how long. No unsupervised AI usage. |
| 02 | 📊 | Watch Progress | Weekly email reports + real-time dashboard showing time spent, accuracy, and weak topics. |
| 03 | 🎯 | Assign Extra Practice | Tap any weak topic to instantly assign 10 targeted questions. Your child gets a fun quest. |

**Step Card styling:**
- [ ] Border left with step number colored bar
- [ ] Padding: p-6
- [ ] Step number: text-4xl font-bold text-[#FF6B35] opacity-50 absolute top-4 right-4
- [ ] Icon: text-3xl mb-3
- [ ] Title: font-semibold text-lg mb-2
- [ ] Description: text-gray-600

**Scroll Animation:**
- [ ] Cards fade in when section enters viewport
- [ ] Use Intersection Observer + CSS transition (no external libs)
- [ ] Stagger: card 1 → 100ms, card 2 → 200ms, card 3 → 300ms

**QA Checklist:**
- [ ] Tab toggle works on mobile (only one journey visible)
- [ ] Both columns visible and aligned on desktop
- [ ] Animation doesn't cause layout shift
- [ ] Connecting lines between steps (CSS pseudo-element) visible on desktop

---

## Epic: Pricing Section

**Epic Goal:** Clear feature comparison with localized pricing.

---

### TASK-LP-006: Pricing Section — Feature Comparison Table

| Field | Value |
|-------|-------|
| **Summary** | Build 3-tier pricing cards with monthly/yearly toggle and feature comparison |
| **Story Points** | 8 |
| **Priority** | P0 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Plan Cards (Free / Individual ₹399/mo / Family ₹599/mo):**
- [ ] Desktop: 3 cards side-by-side (grid-cols-3)
- [ ] Mobile: Single column stacked
- [ ] Individual plan: "Recommended" badge (yellow-100 text-yellow-800)
- [ ] Family plan: "Best Value" badge (green-100 text-green-800)
- [ ] Each card has: Plan name, Price (with monthly/yearly toggle), Features list, CTA button

**Monthly/Yearly Toggle:**
- [ ] Switch above plan cards: "Monthly" (left) | "Yearly" (right)
- [ ] Animated toggle pill (CSS, 0.2s transition)
- [ ] When Yearly selected:
  - Individual: ₹3,999/year (was ₹4,788 — Save ₹789)
  - Family: ₹5,999/year (was ₹7,188 — Save ₹1,189)
- [ ] Save percentage badge appears next to yearly price

**Feature Matrix (all plans):**

| Feature | Free | Individual | Family |
|---------|:----:|:----------:|:------:|
| NCERT Notes Access | ✅ | ✅ | ✅ |
| Practice Questions | 5/day | Unlimited | Unlimited |
| AI Tutor (Socratic) | 3/day | Unlimited | Unlimited |
| On-Demand Topic Generation | ❌ | ✅ | ✅ |
| Parent Dashboard | Weekly Email | Real-time | Real-time |
| Screen Time Limits | ❌ | ✅ | ✅ |
| Subject Blocker | ❌ | ✅ | ✅ |
| Offline Access | ❌ | ✅ | ✅ |
| Children Covered | 1 | 1 | Up to 3 |
| Priority Support | ❌ | Email | WhatsApp |

**Trust signals below pricing:**
- [ ] "🔒 Secure checkout · UPI / Cards / Net Banking · 7-day refund policy · No auto-renewal without reminder"
- [ ] Text-sm, text-gray-500, text-center, mt-8

**CTAs:**
- [ ] Free card: "Start Free" → triggers Google Sign-In
- [ ] Individual card: "Get Started" → triggers Google Sign-In
- [ ] Family card: "Get Started" → triggers Google Sign-In

**QA Checklist:**
- [ ] Monthly/Yearly toggle switches all prices correctly
- [ ] Save percentage calculates correctly (Math: (monthly × 12) - yearly)
- [ ] Feature comparison matches actual product capabilities
- [ ] CTA buttons trigger Google OAuth correctly

---

### TASK-LP-007: Traditional Tuition Comparison Table

| Field | Value |
|-------|-------|
| **Summary** | Build cost comparison table showing savings vs traditional tuition |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-LP-006 |

**Acceptance Criteria:**

**Comparison Table:**

| | Traditional Tuition | Spinzy Individual |
|--|-------------------|-------------------|
| Monthly Cost | ₹3,000-5,000 | ₹399 |
| Travel Cost | ₹500-1,000 | ₹0 |
| Time Lost | 2-3 hours/week | 0 |
| 24×7 Access | ❌ | ✅ |
| Parent Dashboard | ❌ | ✅ |

- [ ] Savings row: "Monthly Savings: ₹2,601+/month" (bold, green text)
- [ ] Annual savings callout: "Save ₹31,200+ per year per child"
- [ ] Visual: Simple bar chart showing cost difference (optional, can be text-only for MVP)

**Layout:**
- [ ] Desktop: Side-by-side comparison cards
- [ ] Mobile: Stacked table (row-by-row)

**QA Checklist:**
- [ ] Savings calculation is accurate
- [ ] Table readable on mobile without horizontal scroll

---

## Epic: Social Proof Section

**Epic Goal:** Build trust through parent testimonials and platform metrics.

---

### TASK-LP-008: Parent Testimonials Section

| Field | Value |
|-------|-------|
| **Summary** | Build testimonial cards with parent quotes focusing on trust and academic results |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Section Header:**
- [ ] "Parents Trust Spinzy. Here's Why."

**Testimonial 1: Priya Menon (Trust-focused)**
> "I was scared of AI apps. But Spinzy asked MY permission before my son could use it. I set a 1-hour daily limit. Now I get a report every Sunday. Finally, an app I trust, not one I monitor nervously."

> Hindi: "मुझे AI apps से डर लगता था। लेकिन Spinzy ने मेरे बेटे के उपयोग से पहले मेरी अनुमति मांगी। मैंने 1 घंटे की दैनिक सीमा तय की। अब हर रविवार को मुझे रिपोर्ट मिलती है। आखिरकार, एक ऐसा app जिस पर मुझे भरोसा है।"

- Attribution: "— Priya Menon, Mumbai. Mother of Class 6 student."
- Badge: 🛡️ "DPDP Compliant" (small pill above quote)

**Testimonial 2: Sunita Sharma (Results-focused)**
- [ ] Keep existing testimonial with before/after metric (45% → 78%)
- [ ] Mini progress bar showing improvement

**Card styling:**
- [ ] Desktop: 2 cards side-by-side
- [ ] Mobile: stacked
- [ ] Quote icon at top (❝, text-6xl, text-gray-200)
- [ ] 5-star rating row (⭐️⭐️⭐️⭐️⭐️)
- [ ] Padding: p-6

**QA Checklist:**
- [ ] Both testimonials render correctly
- [ ] Hindi text in Priya's testimonial renders correctly
- [ ] Progress bar animation triggers on scroll

---

### TASK-LP-009: Animated Metrics Bar

| Field | Value |
|-------|-------|
| **Summary** | Build animated counter metrics (students, questions, towns) |
| **Story Points** | 3 |
| **Priority** | P2 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Metrics:**
| Metric | Value | Format |
|--------|-------|--------|
| Questions Solved | 5,00,000 | Indian comma: 5,00,000 |
| Happy Students | 88,000 | 88,000 |
| Towns Covered | 35 | 35 |

**Animation:**
- [ ] Counter animates from 0 to target when section enters viewport
- [ ] Duration: 2 seconds, ease-out
- [ ] Only triggers once per page load
- [ ] Uses framer-motion or custom Intersection Observer + requestAnimationFrame

**Layout:**
- [ ] Desktop: 3 columns evenly spaced
- [ ] Mobile: 2 rows (2×2 grid: Questions + Students on top row, Towns + blank on bottom)

**QA Checklist:**
- [ ] Counters animate correctly on scroll
- [ ] Indian comma formatting applied (5,00,000 not 500,000)
- [ ] No animation on page reload if already viewed

---

## Epic: FAQ Section

**Epic Goal:** Answer parent concerns about safety, pricing, and functionality.

---

### TASK-LP-010: FAQ Accordion — Parent-Focused Questions

| Field | Value |
|-------|-------|
| **Summary** | Build accordion FAQ with 8 parent-focused questions and answers |
| **Story Points** | 5 |
| **Priority** | P1 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**8 Questions (expandable):**

| # | Question |
|---|----------|
| 1 | Is my child's data safe? |
| 2 | Can my child chat with strangers? |
| 3 | How do I control what my child accesses? |
| 4 | I have 2 children. Do I need separate accounts? |
| 5 | What if a topic my child needs isn't available? |
| 6 | How is this different from ChatGPT or other AI tools? |
| 7 | Can we cancel anytime? |
| 8 | Does it work on cheap phones? |

**Answers:**
- [ ] Each answer is 2-3 sentences, clear and direct
- [ ] Links in answers (e.g., "Learn more about DPDP compliance") open in same tab
- [ ] Hindi translation available alongside English

**Accordion Behavior:**
- [ ] All questions collapsed by default
- [ ] Click on question → expands answer, chevron rotates 180deg
- [ ] Only one question expanded at a time (auto-closes previous)
- [ ] Smooth height transition (CSS grid or max-height animation)
- [ ] Keyboard accessible (Enter/Space to expand, Tab navigation)

**Technical:**
- [ ] Use `@headlessui/react` Disclosure component
- [ ] Schema markup: `FAQPage` structured data added to page

**QA Checklist:**
- [ ] All 8 questions present
- [ ] Expand/collapse works smoothly
- [ ] Only one expanded at a time
- [ ] Links clickable
- [ ] Structured data validates in Google Rich Results Test

---

## Epic: Schools & Partnership

**Epic Goal:** Establish B2B channel for school partnerships.

---

### TASK-LP-011: Schools Partnership Banner

| Field | Value |
|-------|-------|
| **Summary** | Build schools partnership section with benefits grid and CTA |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Content:**
- [ ] Headline: "Spinzy for Schools" / "स्कूलों के लिए Spinzy"
- [ ] Subheadline: "Give your students AI-powered supplementary learning — with teacher dashboards and DPDP-compliant parent consent management."

**4 Benefits:**

| Icon | Title | Description |
|------|-------|-------------|
| 📋 | Teacher Dashboard | Monitor class-wide progress and identify common weak topics. |
| 👥 | Bulk Onboarding | Add entire classes with one CSV upload. |
| 🛡️ | Auto-Consent | Parent consent emails sent automatically. DPDP-compliant. |
| 📚 | Curriculum-Aligned | CBSE, ICSC, and State Board ready. |

**Styling:**
- [ ] Distinct background (gradient from #F4F7FC to #E8EDF5)
- [ ] 2×2 benefit grid (mobile: stacked)
- [ ] CTA button: "Partner With Us" - opens `mailto:schools@spinzyacademy.com?subject=School Partnership Inquiry` OR modal form (TASK-LP-012)

**QA Checklist:**
- [ ] Section visually distinct from FAQ
- [ ] CTA opens email client with correct address
- [ ] Hindi text renders correctly

---

### TASK-LP-012: School Partnership Inquiry Form

| Field | Value |
|-------|-------|
| **Summary** | Build modal form for school partnership inquiries with backend storage |
| **Story Points** | 5 |
| **Priority** | P2 |
| **Dependencies** | TASK-LP-011 |

**Acceptance Criteria:**

**Frontend Modal:**
- [ ] Triggered by "Partner With Us" button
- [ ] Modal fields:
  - Full Name (required, text)
  - School Name (required, text)
  - Email (required, email format)
  - Phone (required, 10-digit Indian number)
  - Message (optional, textarea)
- [ ] Submit button: "Send Inquiry"
- [ ] Loading state on submit (spinner, button disabled)
- [ ] Success state: "Thank you! Our partnerships team will contact you within 48 hours." + auto-close after 3s
- [ ] Error state: "Something went wrong. Please try again or email schools@spinzyacademy.com"

**Backend:**
- [ ] API endpoint: `POST /api/v1/leads/school-partnership`
- [ ] No auth required
- [ ] Rate limiting: 5 submissions per IP per hour
- [ ] Prisma model:
```prisma
model SchoolLead {
  id        String   @id @default(cuid())
  name      String
  schoolName String
  email     String
  phone     String
  message   String?
  status    String   @default("pending") // pending, contacted, rejected
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
- [ ] On submission: Send email notification to `schools@spinzyacademy.com`
- [ ] Store lead in database

**QA Checklist:**
- [ ] Form validation works (email format, 10-digit phone)
- [ ] Rate limiting blocks after 5 submissions
- [ ] Email notification sent
- [ ] Lead stored in database

---

## Epic: Final CTA & Footer

**Epic Goal:** Convert remaining hesitant visitors.

---

### TASK-LP-013: Final CTA Section & Footer

| Field | Value |
|-------|-------|
| **Summary** | Build final call-to-action section above footer with legal links |
| **Story Points** | 3 |
| **Priority** | P1 |
| **Dependencies** | TASK-LP-001 |

**Acceptance Criteria:**

**Final CTA Section:**
- [ ] Headline: "Ready to try it yourself? आज ही शुरू करें — बिल्कुल मुफ्त"
- [ ] Subheadline: "3 free sessions every month. No credit card required."
- [ ] CTA Button: "Start Free with Google" (full-width on mobile, max-w-md on desktop)
- [ ] Below button: "7-day refund policy on premium plans." (text-sm, text-gray-500)
- [ ] Background: Subtle gradient from white to #F9FAFB
- [ ] Padding: py-16 text-center

**Footer:**
- [ ] Already defined in TASK-LP-001 — ensure consistency
- [ ] Legal links: Privacy Policy, Terms of Service, Refund Policy, DPDP Compliance
- [ ] All links should be functional (create placeholder pages if needed)

**QA Checklist:**
- [ ] CTA button triggers Google Sign-In
- [ ] Hindi text renders correctly
- [ ] Footer appears on all pages

---

## Summary: All Landing Page Tasks

| Task ID | Summary | Points | Priority | Dependencies |
|---------|---------|--------|----------|--------------|
| LP-001 | Landing page shell with navbar, footer, performance | 8 | P0 | None |
| LP-002 | Google Sign-In on all CTAs | 5 | P1 | LP-001 |
| LP-003 | Hero section with trust messaging | 5 | P0 | LP-001 |
| LP-004 | Trust Moat section (DPDP + safety icons) | 5 | P0 | LP-001 |
| LP-005 | How It Works — dual-track journey | 8 | P0 | LP-001 |
| LP-006 | Pricing section with feature comparison | 8 | P0 | LP-001 |
| LP-007 | Traditional tuition comparison table | 3 | P1 | LP-006 |
| LP-008 | Parent testimonials section | 5 | P1 | LP-001 |
| LP-009 | Animated metrics counter | 3 | P2 | LP-001 |
| LP-010 | FAQ accordion (8 questions) | 5 | P1 | LP-001 |
| LP-011 | Schools partnership banner | 3 | P1 | LP-001 |
| LP-012 | School partnership inquiry form + backend | 5 | P2 | LP-011 |
| LP-013 | Final CTA section + footer legal links | 3 | P1 | LP-001 |

**Total Points: 66**

---

## Sprint Plan — Landing Page

| Sprint | Tasks | Points | Deliverable |
|--------|-------|--------|-------------|
| **Sprint 1** | LP-001, LP-003, LP-004 | 18 | Page shell + Hero + Trust Moat — ready for review |
| **Sprint 2** | LP-002, LP-005, LP-006, LP-007 | 24 | Google Sign-In, How It Works, Pricing — core page complete |
| **Sprint 3** | LP-008, LP-009, LP-010, LP-011, LP-013 | 19 | Testimonials, FAQ, Schools banner, Final CTA — feature complete |
| **Sprint 4** | LP-012 | 5 | School inquiry form — polish and launch |

---

## Jira Import CSV

```csv
Summary,Description,Story Points,Priority,Epic Link,Labels
TASK-LP-001: Landing Page Shell with Responsive Layout,Build Next.js landing page shell with navbar footer and performance optimization (Lighthouse ≥90 mobile),8,Highest,Epic: Landing Page Shell,mvp
TASK-LP-002: Google Sign-In Integration on All CTAs,Wire all Start Free CTAs to Google OAuth with redirect handling for new/returning users,5,High,Epic: Landing Page Shell,post-mvp
TASK-LP-003: Hero Section with Trust-First Messaging,Build hero section with trust badge bar parent-focused headline illustration and Google CTA,5,Highest,Epic: Hero Section,mvp
TASK-LP-004: Trust Moat Section DPDP and Safety Icons,Build 4-card grid explaining DPDP compliance no tracking no social features and data localization,5,Highest,Epic: Trust Moat,mvp
TASK-LP-005: How It Works Dual-Track Journey,Build side-by-side student and parent journey with step cards and mobile tab toggle,8,Highest,Epic: How It Works,mvp
TASK-LP-006: Pricing Section Feature Comparison Table,Build 3-tier pricing cards with monthly/yearly toggle and feature comparison matrix,8,Highest,Epic: Pricing,mvp
TASK-LP-007: Traditional Tuition Comparison Table,Build cost comparison table showing savings vs traditional tuition (₹3000-5000/mo vs ₹399),3,High,Epic: Pricing,post-mvp
TASK-LP-008: Parent Testimonials Section,Build testimonial cards with parent quotes focusing on trust (Priya Menon) and results (Sunita Sharma),5,High,Epic: Social Proof,post-mvp
TASK-LP-009: Animated Metrics Counter,Build animated counter metrics (5L+ questions solved 88K+ students 35+ towns) on scroll,3,Medium,Epic: Social Proof,polish
TASK-LP-010: FAQ Accordion Parent-Focused Questions,Build accordion FAQ with 8 parent-focused questions answers and FAQPage schema markup,5,High,Epic: FAQ,post-mvp
TASK-LP-011: Schools Partnership Banner,Build schools partnership section with 4-benefit grid and Partner With Us CTA,3,High,Epic: Schools Partnership,post-mvp
TASK-LP-012: School Partnership Inquiry Form,Build modal form for school partnership inquiries with backend storage rate limiting and email notification,5,Medium,Epic: Schools Partnership,polish
TASK-LP-013: Final CTA Section and Footer Legal Links,Build final call-to-action section above footer with Hindi headline and 7-day refund policy notice,3,High,Epic: Final CTA,post-mvp
```

---

## File Structure

```
apps/web/src/
├── app/
│   ├── page.tsx                          # Landing page (server component)
│   ├── layout.tsx                        # Root layout
│   ├── globals.css
│   └── api/
│       └── auth/
│           └── callback/
│               └── route.ts              # Google OAuth callback handler
├── components/
│   └── landing/
│       ├── Navbar.tsx
│       ├── Footer.tsx
│       ├── MobileMenu.tsx
│       ├── Hero.tsx
│       ├── TrustMoat.tsx
│       ├── TrustCard.tsx
│       ├── HowItWorks.tsx
│       ├── JourneyStep.tsx
│       ├── Pricing.tsx
│       ├── PricingCard.tsx
│       ├── PricingToggle.tsx
│       ├── TuitionComparison.tsx
│       ├── Testimonials.tsx
│       ├── TestimonialCard.tsx
│       ├── MetricsBar.tsx
│       ├── FAQ.tsx
│       ├── FAQItem.tsx
│       ├── SchoolsBanner.tsx
│       ├── SchoolInquiryModal.tsx
│       └── FinalCTA.tsx
├── hooks/
│   ├── useScrollAnimation.ts
│   └── useCounter.ts
├── lib/
│   ├── auth.ts
│   └── api.ts
└── types/
    └── landing.ts
```

---

These tasks are ready for Sprint Planning. Each task is independently testable and includes specific QA checklists. Once implemented, the landing page will be feature-complete for MVP launch.

