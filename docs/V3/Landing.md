## LP-1.1 | P0 | Landing Page Shell with Consistent Layout

**ID:** LP-1.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story

As a prospective parent landing on spinzyacademy.com,
I want the page to load instantly, render correctly on my ₹8,000 Android phone, and have a consistent navigation bar,
So that I can browse the entire page without frustration or layout breaks.

### Acceptance Criteria

- [ ] Page uses Next.js App Router with Server-Side Rendering (SSR) for above-the-fold content.
- [ ] Lighthouse mobile score ≥ 90 (Performance), ≥ 95 (Accessibility).
- [ ] Navigation bar is sticky on scroll with:
- [ ] Logo (Spinzy.) on left.
- [ ] Links: How It Works | Pricing | FAQ | For Schools (desktop only, collapsed to hamburger on mobile).
- [ ] CTA button: "Start Free" (Tangerine #FF6B35, 44px height for mobile touch).
- [ ] Footer with: Privacy Policy, Terms of Service, Contact Info, Social Links (Twitter/LinkedIn — no Facebook).
- [ ] All images use Next.js <Image> with WebP format, lazy loading below fold, and blur placeholders.
- [ ] Page is bilingual-aware: Hindi text blocks render correctly with Google Fonts (Noto Sans Devanagari for Hindi, Roboto for English).

### Dev Tasks

- [ ] Set up apps/web Next.js project with @spinzy/shared package dependency.
- [ ] Implement Navbar component with mobile hamburger menu (use headlessui or Radix UI).
- [ ] Implement Footer component.
- [ ] Configure next.config.js for image domains, i18n, and WebP.
- [ ] Add Google Fonts (Roboto + Noto Sans Devanagari) via next/font.

### QA

- [ ] Test on real device: ₹8,000 Android phone (e.g., Redmi 9) on Chrome + 4G throttling.
- [ ] Test on iPhone SE (smallest screen).
- [ ] Test on iPad and Desktop (1920px).
- [ ] Hindi text renders without tofu (square boxes).

## LP-1.2 | P1 | Google Sign-In Integration on Landing Page

**ID:** LP-1.2
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story

As a prospective parent ready to try Spinzy,
I want to click "Start Free" anywhere on the page and sign in with my Google account in one tap,
So that I can start the setup flow without creating a new password or filling long forms.

### Acceptance Criteria

- [ ] "Start Free" CTA in Navbar, Hero, Pricing, and Footer all trigger the same flow.
- [ ] Clicking CTA opens Google OAuth popup (or redirects on mobile) using @react-oauth/google library.
- [ ] On successful Google sign-in:
- [ ] If new user: Redirect to /onboarding (Add Child flow from Parent Journey Phase 1).
- [ ] If returning user with existing child profiles: Redirect to Parent Dashboard.
- [ ] If returning user without child profiles: Redirect to /onboarding.
- [ ] Loading state shown during OAuth handshake (spinner on button, button disabled).
- [ ] Error state: "Sign-in failed. Please try again or contact support." with retry button.
- [ ] Backend: POST /api/v1/auth/google endpoint validates Google ID token, creates/updates User record in Prisma, returns JWT.
- [ ] Uses existing auth service from our architecture.

### Dev Tasks

- [ ] Implement Google OAuth integration on frontend
- [ ] Create POST /api/v1/auth/google endpoint
- [ ] Add loading and error states to all CTA buttons
- [ ] Implement redirect logic based on user status

### QA

- [ ] Test with Gmail account, Google Workspace account, and a Google account with 2FA enabled.
- [ ] Test on mobile Chrome (Google account already signed in on device → one tap should work).
- [ ] Test on incognito (fresh sign-in flow).

## LP-2.1 | P0 | Hero Section — Parent-Trust Headline & Visual

**ID:** LP-2.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story

As a prospective parent visiting spinzyacademy.com for the first time,
I want to immediately understand that Spinzy is an AI tutor that I control, not an unmonitored chatbot,
So that my #1 fear (child safety) is addressed within 5 seconds, and I scroll further.

### Acceptance Criteria

- [ ] Trust badge bar (top of hero): 🛡️ DPDP Compliant · 👁️ No Tracking · 📵 No Social Features · 🇮🇳 Servers in India
- [ ] Headline: "The AI Tutor That Asks YOUR Permission First"
- [ ] Subheadline: "Spinzy Academy lets your child learn with an AI tutor while you control what they access, for how long, and what data is shared."
- [ ] Hindi alternate: "AI Tutor जो पहले आपकी अनुमति लेता है"
- [ ] Visual element: Illustration showing parent phone (approval screen) → connected to child tablet (learning screen). NOT a photo of a child (COPPA/DPDP).
- [ ] Hero section is 100vh on mobile, 90vh on desktop.
- [ ] Trust badge bar is a horizontal scrollable strip on mobile, static row on desktop.
- [ ] CTA: "Start Free — Sign in with Google" button (48px min height, full width on mobile).
- [ ] Below CTA: "3 free sessions per month · No credit card · Setup in 2 minutes" in small text.
- [ ] Social proof micro-element: "Trusted by 1 Lakh+ Indian families" with small avatar mosaic (abstract circles, no real faces).

### Dev Tasks

- [ ] Create Hero component with responsive Tailwind classes.
- [ ] Add illustration (SVG or Lottie) optimized for mobile (max 50KB).
- [ ] Wire up Google Sign-In CTA (from LP-1.2).
- [ ] Add subtle entrance animation (fade-in-up on headline, no jank).

### QA

- [ ] Headline is fully visible without scroll on iPhone SE.
- [ ] Trust badges are fully visible on 360px width screen.
- [ ] Illustration does not push CTA below fold.
- [ ] Hindi text displays correctly on all devices.
- [ ] CTA button is tap-friendly (48px+ on mobile).

## LP-3.1 | P0 | Trust Moat — DPDP & Safety Icons Grid

**ID:** LP-3.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story

As a parent concerned about AI safety and data privacy,
I want to see a clear, visually distinct section that explains exactly how Spinzy protects my child,
So that my anxiety is reduced and I'm willing to try the product.

### Acceptance Criteria

- [ ] Section headline: "Built for Indian Parents. Designed for Indian Law." / "माता-पिता के लिए बनाया गया। भारतीय कानून के अनुसार।"
- [ ] Four icon cards in a 2×2 grid (2×4 on mobile):
- [ ] Card 1: 🛡️ Shield - DPDP Compliant - We follow India's Digital Personal Data Protection Act. Your child's data is processed lawfully, with your consent.
- [ ] Card 2: 👁️ Eye with slash - No Tracking - We don't monitor your child's behavior for advertising. No third-party trackers. No data sold.
- [ ] Card 3: 📵 Phone with lock - No Social Features - No chat rooms. No friend requests. No reels. Just focused learning with an AI tutor.
- [ ] Card 4: 🇮🇳 Indian flag - Data Stays in India - All data is stored on servers in Mumbai. Encrypted at rest and in transit.
- [ ] Below the grid: Parent Dashboard preview card with phone mockup showing Parent Dashboard UI (Weak Topics, Screen Time toggle, Subject Blocker)
- [ ] Text: "See every topic your child studies. Set limits. Block subjects. All from your phone."
- [ ] Link: "[Learn more about Parent Controls →]" (scrolls to How It Works section).
- [ ] Grid uses CSS Grid with grid-cols-2 on mobile, grid-cols-4 on desktop.
- [ ] Each card has: Icon (emoji or inline SVG), Title, Description.
- [ ] Cards have subtle hover effect on desktop (shadow lift).
- [ ] Parent Dashboard preview is an image (static PNG of actual dashboard UI) inside a phone mockup frame.
- [ ] Section has a distinct background color (slight grey-blue #F4F7FC) to separate it from Hero and How It Works.

### Dev Tasks

- [ ] Create TrustMoat component.
- [ ] Create TrustCard sub-component (reusable).
- [ ] Create DashboardPreview sub-component with phone mockup image.
- [ ] Ensure phone mockup image is lazy-loaded (below fold).

### QA

- [ ] Cards wrap correctly on 360px screen (single column if needed).
- [ ] Dashboard preview image is crisp on 2x retina displays.
- [ ] Hindi text in cards renders correctly.
- [ ] Section is visually distinct from adjacent sections.

## LP-4.1 | P0 | How It Works — Student + Parent Parallel Journey

**ID:** LP-4.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story

As a prospective parent,
I want to understand exactly how Spinzy works for BOTH my child and myself,
So that I see value for me (control, insights) not just for my child (learning).

### Acceptance Criteria

- [ ] Section headline: "How Spinzy Works — For Students & Parents" / "Spinzy कैसे काम करता है — छात्रों और माता-पिता के लिए"
- [ ] Two-column layout on desktop (side-by-side), stacked on mobile (Student on top, Parent below with tab toggle).
- [ ] Student Journey (Left/Top):
- [ ] Step 01: 📋 Clipboard - Take a 15-min Diagnostic - Teacher Vidya maps your knowledge gaps across every chapter. No stress — it's just a starting point.
- [ ] Step 02: 🤖 Robot - Learn Socratically from AI - No lectures. Teacher Vidya asks you questions, gives hints, and guides you to the answer. Every concept, every session.
- [ ] Step 03: ✨ Sparkles - Request Any Topic - Can't find a topic? AI generates curriculum-aligned notes and practice questions in ~30 seconds. You study exactly what you need.
- [ ] Parent Journey (Right/Bottom):
- [ ] Step 01: ✅ Checkmark - Approve & Set Limits - You decide what subjects your child can access and for how long. No unsupervised AI usage.
- [ ] Step 02: 📊 Chart - Watch Progress - Weekly email reports + real-time dashboard showing time spent, accuracy, and weak topics.
- [ ] Step 03: 🎯 Target - Assign Extra Practice - Tap any weak topic to instantly assign 10 targeted questions. Your child gets a fun quest — not a punishment.
- [ ] Desktop: CSS Grid with grid-cols-2. Each column has 3 stacked step cards.
- [ ] Mobile: Two tabs ("For Students" / "For Parents") that toggle which journey is shown.
- [ ] Each step card: Step number (large, colored), Icon, Title, Description.
- [ ] Connecting line between step cards (CSS pseudo-element or SVG path).
- [ ] Scroll-triggered animation: Cards fade in as user scrolls (use framer-motion or Intersection Observer).

### Dev Tasks

- [ ] Create HowItWorks component.
- [ ] Create JourneyStep sub-component.
- [ ] Implement mobile tab toggle with useState.
- [ ] Add Intersection Observer for scroll animation.

### QA

- [ ] Tab toggle works on mobile (only one journey visible at a time).
- [ ] Both columns visible and aligned on desktop.
- [ ] Hindi descriptors render correctly.
- [ ] Animation does not cause layout shift (CLS = 0).

## LP-5.1 | P1 | Parent-Targeted Testimonial (Trust Focus)

**ID:** LP-5.1
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story

As a parent on the fence about trusting an AI tool,
I want to read a testimonial from another parent who had the same fear,
So that I feel social proof that Spinzy is safe and parent-approved.

### Acceptance Criteria

- [ ] Add one NEW testimonial (keep existing Sunita Sharma testimonial — it's strong on academic results).
- [ ] New testimonial focuses on TRUST and CONTROL:
- [ ] "I was scared of AI apps. But Spinzy asked MY permission before my son could use it. I set a 1-hour daily limit. Now I get a report every Sunday. Finally, an app I trust, not one I monitor nervously." — Priya Menon, Mumbai. Mother of Class 6 student.
- [ ] Hindi translation: "मुझे AI apps से डर लगता था। लेकिन Spinzy ने मेरे बेटे के उपयोग से पहले मेरी अनुमति मांगी। मैंने 1 घंटे की दैनिक सीमा तय की। अब हर रविवार को मुझे रिपोर्ट मिलती है। आखिरकार, एक ऐसा app जिस पर मुझे भरोसा है।"
- [ ] Testimonials section title: "Parents Trust Spinzy. Here's Why."
- [ ] Two testimonial cards side-by-side on desktop, stacked on mobile.
- [ ] Each card has: Quote, Parent name + city, Child class, Star rating (5 stars, visually).
- [ ] Before/After metric for Sunita's card (45% → 78%) displayed as a mini progress bar.
- [ ] Priya's card has a "Safety Badge" visual (shield icon + "DPDP Compliant" text).

### Dev Tasks

- [ ] Create Testimonials section component
- [ ] Create TestimonialCard sub-component
- [ ] Add progress bar component for Sunita's metric
- [ ] Add safety badge for Priya's card

### QA

- [ ] Both testimonials authenticate (real names encouraged, but anonymized if parent prefers).
- [ ] Hindi text in Priya's testimonial renders correctly.
- [ ] Cards are visually balanced on all screen sizes.

## LP-5.2 | P2 | Social Proof Metrics Bar (Animated Counters)

**ID:** LP-5.2
**Labels:** P2, phase:onboarding
**Phase:** Onboarding

### User Story

As a prospective parent scrolling through social proof,
I want to see animated statistics (students helped, questions solved, towns covered),
So that I feel the scale and momentum of the platform.

### Acceptance Criteria

- [ ] Keep existing metrics but animate them on scroll:
- [ ] 5L+ Questions Solved → Counter animates from 0 to 5,00,000.
- [ ] 88K+ Happy Students → Counter animates from 0 to 88,000.
- [ ] 35+ Towns Covered → Counter animates from 0 to 35.
- [ ] Animation triggers when section enters viewport (Intersection Observer).
- [ ] Animation duration: 2 seconds with easing.
- [ ] Numbers format with Indian comma notation (e.g., 5,00,000 not 500,000).
- [ ] Use framer-motion useInView + useSpring for smooth counters.
- [ ] 4-column grid on desktop, 2×2 on mobile.

### Dev Tasks

- [ ] Create MetricsBar component
- [ ] Implement animated counters with framer-motion
- [ ] Add Indian comma notation formatting
- [ ] Set up Intersection Observer trigger

### QA

- [ ] Counters start at 0 and animate to target values when scrolled into view
- [ ] Numbers display with correct Indian comma format
- [ ] Grid layout responsive on all screen sizes

## LP-6.1 | P0 | Pricing Section — Feature Comparison Table

**ID:** LP-6.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story

As a price-conscious Indian parent,
I want to see exactly what's free and what's premium in a clear comparison,
So that I understand the value and can make an informed decision.

### Acceptance Criteria

- [ ] Keep existing three-tier structure: Free / Individual (₹399) / Family (₹599)
- [ ] Feature comparison table with updated features:
- [ ] NCERT Notes Access: ✅ / ✅ / ✅
- [ ] Practice Questions: 5/day / Unlimited / Unlimited
- [ ] AI Tutor (Socratic): 3 prompts/day / Unlimited / Unlimited
- [ ] On-Demand Topic Generation: ❌ / ✅ / ✅
- [ ] Parent Dashboard: Weekly Email / Real-time + Controls / Real-time + Controls
- [ ] Screen Time Limits: ❌ / ✅ / ✅
- [ ] Subject Blocker: ❌ / ✅ / ✅
- [ ] Offline Access: ❌ / ✅ / ✅
- [ ] Progress Reports: Weekly / Weekly + Real-time / Weekly + Real-time
- [ ] Children Covered: 1 / 1 / Up to 3
- [ ] Priority Support: ❌ / Email / WhatsApp
- [ ] "Recommended" badge on Individual plan.
- [ ] "Best Value" badge on Family plan (with sibling discount callout: "Save 25% on 2nd & 3rd child").
- [ ] Annual billing toggle: ₹399/month → ₹3,999/year (Save ₹789). ₹599/month → ₹5,999/year (Save ₹1,189).
- [ ] Trust signals below pricing: "🔒 Secure checkout · UPI / Cards / Net Banking · 7-day refund policy · No auto-renewal without reminder"
- [ ] Three-column layout on desktop, single column stacked on mobile (Free → Individual → Family).
- [ ] Monthly/Yearly toggle switch (CSS animated).
- [ ] Feature rows with ✅ green checkmark or ❌ grey X.
- [ ] Premium features (Topic Generation, Parent Dashboard, Screen Time) highlighted with subtle background tint.
- [ ] Each plan card has "Start Free" or "Get Started" CTA that triggers Google Sign-In.

### Dev Tasks

- [ ] Create Pricing component.
- [ ] Create PricingCard sub-component.
- [ ] Implement monthly/yearly toggle with useState.
- [ ] Wire up CTA buttons to Google Sign-In flow.
- [ ] Add trust signals row below pricing cards.

### QA

- [ ] Toggle switches prices correctly for all plans.
- [ ] Feature comparison is accurate against our actual product (sync with Product team).
- [ ] Cards are visually balanced on mobile.
- [ ] Hindi text in plan names/descriptions renders correctly.

## LP-6.2 | P1 | Pricing — Traditional Tuition Comparison

**ID:** LP-6.2
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story

As a parent spending ₹3,000-5,000/month on tuition,
I want to see a direct cost comparison that quantifies my savings,
So that I'm motivated to switch to Spinzy.

### Acceptance Criteria

- [ ] Keep existing comparison table with updates:
- [ ] Traditional Tuition: ₹3,000-5,000/month (with line items: Tuition fee, Travel cost, Time lost).
- [ ] Spinzy Individual: ₹399/month (with line items: Unlimited access, No travel, 24×7 available).
- [ ] Savings: ₹2,601+/month (bold, green).
- [ ] Add annual savings: "Save ₹31,200+ per year per child."
- [ ] Visual: Bar chart or simple comparison graphic showing cost difference.
- [ ] Component placed directly below Pricing Cards.
- [ ] Responsive: Side-by-side on desktop, stacked on mobile.

### Dev Tasks

- [ ] Create TuitionComparison component
- [ ] Add bar chart or comparison graphic
- [ ] Implement responsive layout

### QA

- [ ] Savings calculations are accurate
- [ ] Visual comparison is clear on all devices
- [ ] Annual savings figure displays correctly

## LP-7.1 | P1 | FAQ — Parent-Focused Questions

**ID:** LP-7.1
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story

As a parent with specific concerns about AI safety, data privacy, and screen time,
I want to find answers quickly in an FAQ section,
So that my remaining doubts are resolved before I commit.

### Acceptance Criteria

- [ ] Question 1: Is my child's data safe? - DPDP compliant. No tracking for ads. No data sold. Servers in India. Encrypted.
- [ ] Question 2: Can my child chat with strangers? - No. No social features. No chat rooms. No friend requests. Only student ↔ AI tutor interaction.
- [ ] Question 3: How do I control what my child accesses? - Parent Dashboard: Approve subjects, set screen time limits (30/60/90/120 min), block topics, view weekly reports.
- [ ] Question 4: I have 2 children. Do I need separate accounts? - Family Plan covers up to 3 children under one parent account. Each child has separate learning path and progress tracking.
- [ ] Question 5: What if a topic my child needs isn't available? - Our AI generates it on-demand. Your child requests a topic → AI creates notes + practice questions in ~30 seconds → Admin reviews for quality.
- [ ] Question 6: How is this different from ChatGPT or other AI tools? - Spinzy is curriculum-aligned (CBSE/ICSE/State Boards), Socratically teaches (doesn't just give answers), and is fully parent-controlled. ChatGPT is not designed for children and lacks Indian curriculum knowledge.
- [ ] Question 7: Can we cancel anytime? - Yes. Cancel with one click. 7-day refund policy on first payment. No long-term lock-in.
- [ ] Question 8: Does it work on cheap phones? - Yes. Spinzy works on Android phones costing ₹5,000+. Optimized for low bandwidth (2G/3G). Lightweight app (< 15MB).
- [ ] Accordion component (collapsed by default, expands on click).
- [ ] Each question has a chevron icon that rotates on expand.
- [ ] Only one question expanded at a time (accordion behavior).
- [ ] Answers can contain inline links (e.g., "Learn more about DPDP compliance" → privacy policy page).
- [ ] Hindi translations alongside English for key questions (use our bilingual format from current page).

### Dev Tasks

- [ ] Create FAQ component with Accordion sub-component (use @headlessui/react Disclosure or custom).
- [ ] Ensure smooth open/close animation (height transition).
- [ ] Add schema markup (FAQPage structured data) for SEO.

### QA

- [ ] All 8 questions present and expandable.
- [ ] Hindi text renders correctly.
- [ ] Links within answers are clickable.
- [ ] SEO structured data validates in Google Rich Results Test.

## LP-8.1 | P1 | Schools Partnership Banner

**ID:** LP-8.1
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story

As a school principal or administrator visiting the website,
I want to see a dedicated section explaining how Spinzy partners with schools,
So that I can explore a B2B relationship for my institution.

### Acceptance Criteria

- [ ] Section headline: "Spinzy for Schools" / "स्कूलों के लिए Spinzy"
- [ ] Subheadline: "Give your students AI-powered supplementary learning — with teacher dashboards and DPDP-compliant parent consent management."
- [ ] Benefit cards:
- [ ] 📋 Teacher Dashboard — Monitor class-wide progress and identify common weak topics.
- [ ] 👥 Bulk Onboarding — Add entire classes with one CSV upload.
- [ ] 🛡️ Auto-Consent — Parent consent emails sent automatically. DPDP-compliant.
- [ ] 📚 Curriculum-Aligned — CBSE, ICSE, and State Board ready.
- [ ] CTA: "Partner With Us" → Opens email (schools@spinzyacademy.com) OR dedicated inquiry form.
- [ ] Distinct background (gradient or darker color to separate from FAQ).
- [ ] Simple 2×2 benefit grid.
- [ ] CTA opens mailto:schools@spinzyacademy.com with pre-filled subject line.

### Dev Tasks

- [ ] Create SchoolsBanner component.
- [ ] Set up schools@spinzyacademy.com email forwarding (ops task).

### QA

- [ ] CTA opens email client with correct address and subject.
- [ ] Section is visually distinct.

## LP-8.2 | P2 | School Partnership Inquiry Form

**ID:** LP-8.2
**Labels:** P2, phase:onboarding
**Phase:** Onboarding

### User Story

As a school administrator interested in partnership,
I want to fill out a short inquiry form directly on the website,
So that I don't have to switch to email and can submit my details quickly.

### Acceptance Criteria

- [ ] Lightweight form (name, school name, email, phone, message) inside a modal triggered by the "Partner With Us" CTA.
- [ ] Form validates: Email format, Phone (10 digits).
- [ ] Success state: "Thank you! Our partnerships team will contact you within 48 hours."
- [ ] Backend: POST /api/v1/leads/school-partnership — No auth required. Rate-limited (max 5 submissions per IP per hour).
- [ ] Prisma model: SchoolLead { id, name, schoolName, email, phone, message, createdAt, status }.
- [ ] Sends email notification to schools@spinzyacademy.com.

### Dev Tasks

- [ ] Create inquiry form modal component
- [ ] Implement form validation
- [ ] Create POST /api/v1/leads/school-partnership endpoint
- [ ] Add rate limiting middleware
- [ ] Create Prisma model for SchoolLead
- [ ] Set up email notification service

### QA

- [ ] Form submits successfully.
- [ ] Rate limiting works.
- [ ] Email is delivered.

## LP-9.1 | P1 | Final CTA Section & Footer

**ID:** LP-9.1
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story

As a parent who has scrolled through the entire page,
I want a final, compelling call-to-action and access to legal links,
So that I either sign up immediately or find privacy/terms information.

### Acceptance Criteria

- [ ] Final CTA Section:
- [ ] Headline: "Ready to try it yourself? आज ही शुरू करें — बिल्कुल मुफ्त"
- [ ] Subheadline: "3 free sessions every month. No credit card required."
- [ ] CTA Button: "Start Free with Google" (full-width on mobile).
- [ ] Below button: "7-day refund policy on premium plans."
- [ ] Footer:
- [ ] Three columns on desktop, single column on mobile:
- [ ] Column 1: Spinzy Academy © 2026. Made in India 🇮🇳.
- [ ] Column 2: Links — Privacy Policy, Terms of Service, Refund Policy, DPDP Compliance.
- [ ] Column 3: Contact — hello@spinzyacademy.com, +91-XXXX-XXXXXX, WhatsApp link.
- [ ] "Download on Play Store" badge (if Android app exists).
- [ ] No App Store badge yet (iOS TBD — honest representation).
- [ ] Final CTA has a subtle gradient background.
- [ ] Footer has dark background (#1A2E45) with white text.
- [ ] All legal links open in same tab (not new tab).
- [ ] Footer is consistent across all pages (landing, blog, onboarding).

### Dev Tasks

- [ ] Create FinalCTA component
- [ ] Create Footer component (if not already from LP-1.1)
- [ ] Ensure consistent footer across all pages
- [ ] Add Play Store badge conditional rendering

### QA

- [ ] Final CTA displays correctly on all devices
- [ ] Footer columns stack properly on mobile
- [ ] All links work and open in same tab
- [ ] Play Store badge appears only if Android app exists
