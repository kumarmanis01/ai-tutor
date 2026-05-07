/**
 * FILE OBJECTIVE:
 * - Render the landing page hero with the existing brand and semantic theme utilities.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/hero-section.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | refine hero styling with existing landing page theme classes only
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/UI/AppImage';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';

const TESTIMONIALS = [
  'Meri beti ke marks 45% se 78% ho gaye! - Sunita, Jaipur',
  '3000 rupees tuition se 399 rupees mein better results! - Rajesh, Indore',
  '24x7 doubt solving, amazing! - Priya, Lucknow',
];

const TRUST_ITEMS = ['CBSE, ICSE, and State Boards', 'Hindi and English support', 'Works on budget phones'];

const HeroSection = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 3);
    }, 4000);

    return () => clearInterval(interval);
  }, [isHydrated]);

  const handleSeeHow = () => {
    const el = document.querySelector('#how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-primary-bg via-background to-brand-success-bg/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-primary/10 blur-3xl" />
        <div className="absolute right-10 top-20 h-64 w-64 rounded-full bg-brand-primary/10 blur-3xl" />
        <div className="absolute bottom-16 left-6 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full px-4 py-12 md:px-6 md:py-16 lg:px-8 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          <div className="text-center lg:text-left space-y-6 md:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-success/20 bg-brand-success/10 px-4 py-2 text-sm font-semibold text-brand-success shadow-sm">
              <Icon name="CheckBadgeIcon" size={18} variant="solid" />
              <span>Trusted by 1 Lakh+ Indian families</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-headline text-4xl font-bold leading-tight text-secondary md:text-5xl lg:text-6xl">
                Turn doubts into confidence with Spinzy AI Tutor.
              </h1>
              <p className="font-accent text-base font-semibold uppercase tracking-[0.18em] text-brand-primary md:text-lg">
                Learning support built for Indian families
              </p>
              <p className="font-body text-xl text-foreground/80 md:text-2xl">
                Adaptive practice, mastery checks, and guided hints that build conceptual fluency -- no shortcuts.
              </p>
              <p className="font-body text-lg font-semibold text-primary md:text-xl">
                Class 1-12 | CBSE / ICSE / State Board | Instant doubt solving in Hindi and English
              </p>
            </div>

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

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/auth/signup"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 py-3 font-cta text-base font-semibold text-white shadow-lg shadow-brand-primary/20 transition-all duration-250 hover:bg-brand-primary-hover md:px-8 md:py-4 md:text-lg"
              >
                <Icon name="SparklesIcon" size={20} variant="solid" />
                <span>Start For Free</span>
              </Link>
              <button
                onClick={handleSeeHow}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card/90 px-6 py-3 font-cta text-base font-semibold text-secondary shadow-sm transition-all duration-250 hover:border-brand-primary/30 hover:bg-brand-primary-bg md:px-8 md:py-4 md:text-lg"
              >
                <Icon name="PlayCircleIcon" size={24} variant="solid" />
                <span>See how it works</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-sm md:text-base text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={18} variant="solid" className="text-brand-success" />
                {FREE_SESSIONS_TEXT}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={18} variant="solid" className="text-brand-success" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={18} variant="solid" className="text-brand-success" />
                Setup in 2 minutes
              </span>
            </div>

            {isHydrated && (
              <div className="rounded-2xl border border-brand-primary/10 bg-card/95 p-4 shadow-lg shadow-brand-primary/5 backdrop-blur">
                <p className="font-body text-sm md:text-base text-foreground italic text-center lg:text-left">
                  &ldquo;{TESTIMONIALS[currentTestimonial]}&rdquo;
                </p>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="mb-6 flex flex-col items-center">
              <AppImage
                src="/logos/vidya/vidya-avatar-128.png"
                alt="Teacher Vidya"
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-brand-primary ring-offset-4 ring-offset-background"
              />
              <p className="mt-2 text-sm font-semibold text-brand-primary">Teacher Vidya</p>
              <p className="text-xs text-muted-foreground">Your AI home tutor</p>
            </div>

            <div className="relative rounded-[28px] border border-brand-primary/10 bg-card/95 p-3 shadow-2xl shadow-brand-primary/10">
              <div className="overflow-hidden rounded-[22px] border-4 border-background bg-card">
                <AppImage
                  src="/images/landing_page_bg.jpg"
                  alt="Student learning at desk"
                  className="w-full h-auto"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-secondary/25 via-transparent to-transparent" />
              </div>

              <div className="absolute left-6 top-6 rounded-2xl border border-brand-primary/10 bg-card/90 px-4 py-3 shadow-lg backdrop-blur">
                <p className="font-headline text-sm font-bold text-secondary">Guided hints</p>
                <p className="mt-1 text-xs text-muted-foreground">Stepwise help that builds real understanding</p>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-2 hidden max-w-[220px] rounded-2xl border border-border bg-card p-4 shadow-xl md:block">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-success/10">
                  <Icon name="AcademicCapIcon" size={24} variant="solid" className="text-brand-success" />
                </div>
                <div>
                  <p className="font-headline font-bold text-2xl text-secondary">5L+</p>
                  <p className="font-body text-xs text-muted-foreground">Questions Solved</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 -top-6 hidden max-w-[190px] rounded-2xl border border-border bg-card p-4 shadow-xl md:block">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10">
                  <Icon
                    name="DevicePhoneMobileIcon"
                    size={24}
                    variant="solid"
                    className="text-brand-primary"
                  />
                </div>
                <div>
                    <p className="font-body text-xs text-muted-foreground">Phone works smoothly</p>
                  <p className="font-body text-xs text-muted-foreground">Phone Works!</p>
                </div>
              </div>

              {/* <div className="absolute bottom-6 right-6 hidden rounded-full border border-brand-success/20 bg-brand-success/10 px-4 py-2 text-sm font-semibold text-brand-success shadow-sm lg:inline-flex">
                24x7 guided support
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
