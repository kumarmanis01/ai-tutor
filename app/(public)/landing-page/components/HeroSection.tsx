/**
 * FILE OBJECTIVE:
 * - Render the landing page hero with a single confident CTA and a parent path acknowledgement.
 *   Rotating testimonials removed (dedicated TestimonialsSection below).
 *   Floating stat cards removed (moved into TrustBar).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/hero-section.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | refine hero styling with existing landing page theme classes only
 * - 2026-05-18T00:00:00Z | claude | compress: cut testimonials, stat floats, duplicate trust strip;
 *     add "Buying for your child?" parent path link; token cleanup brand-* -> semantic tokens
 */

'use client';

import Link from 'next/link';
import AppImage from '@/components/UI/AppImage';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';

const TRUST_ITEMS = ['CBSE, ICSE, State Boards', 'Hindi and English', 'Works on budget phones'];

const HeroSection = () => {
  const handleSeeHow = () => {
    const el = document.querySelector('#how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-bg via-background to-success-bg/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-10 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-16 left-6 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full px-4 py-12 md:px-6 md:py-16 lg:px-8 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          <div className="text-center lg:text-left space-y-6 md:space-y-8">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-4 py-2 text-sm font-semibold text-success shadow-sm">
              <Icon name="CheckBadgeIcon" size={18} variant="solid" />
              <span>Trusted by 1 Lakh+ Indian families</span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="font-headline text-4xl font-bold leading-tight text-secondary md:text-5xl lg:text-6xl">
                Turn doubts into confidence with Spinzy AI Tutor.
              </h1>
              <p className="font-accent text-base font-semibold uppercase tracking-[0.18em] text-primary md:text-lg">
                Learning support built for Indian families
              </p>
              <p className="font-body text-xl text-foreground/80 md:text-2xl">
                Adaptive practice, mastery checks, and guided hints that build conceptual fluency -- no shortcuts.
              </p>
            </div>

            {/* Trust pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {TRUST_ITEMS.map((item) => (
                <span
                  key={item}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card/90 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/auth/get-started"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-cta text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-250 hover:bg-primary-hover md:px-8 md:py-4 md:text-lg"
              >
                <Icon name="SparklesIcon" size={20} variant="solid" />
                <span>Get started free</span>
              </Link>
              <button
                onClick={handleSeeHow}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card/90 px-6 py-3 font-cta text-base font-semibold text-secondary shadow-sm transition-all duration-250 hover:border-primary/30 hover:bg-primary-bg md:px-8 md:py-4 md:text-lg"
              >
                <Icon name="PlayCircleIcon" size={24} variant="solid" />
                <span>See how it works</span>
              </button>
            </div>

            {/* Subtle trust line */}
            <p className="text-sm text-muted-foreground flex items-center justify-center lg:justify-start gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" className="text-success shrink-0" />
              {FREE_SESSIONS_TEXT} -- no credit card required
            </p>

            {/* Parent path acknowledgement */}
            <p className="text-sm text-muted-foreground">
              Buying for your child?{' '}
              <Link
                href="/auth/get-started?source=parent"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Start as a parent
              </Link>
            </p>
          </div>

          {/* Right column -- hero image + Vidya avatar */}
          <div className="relative">
            <div className="mb-6 flex flex-col items-center">
              <AppImage
                src="/logos/vidya/vidya-avatar-128.png"
                alt="Teacher Vidya"
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-primary ring-offset-4 ring-offset-background"
              />
              <p className="mt-2 text-sm font-semibold text-primary">Teacher Vidya</p>
              <p className="text-xs text-muted-foreground">Your AI home tutor</p>
            </div>

            <div className="relative rounded-[28px] border border-primary/10 bg-card/95 p-3 shadow-2xl shadow-primary/10">
              <div className="overflow-hidden rounded-[22px] border-4 border-background bg-card">
                <AppImage
                  src="/images/landing_page_bg.jpg"
                  alt="Student learning at desk"
                  className="w-full h-auto"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/25 via-transparent to-transparent" />
              </div>

              <div className="absolute left-6 top-6 rounded-2xl border border-primary/10 bg-card/90 px-4 py-3 shadow-lg backdrop-blur">
                <p className="font-headline text-sm font-bold text-secondary">Guided hints</p>
                <p className="mt-1 text-xs text-muted-foreground">Stepwise help that builds real understanding</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
