/**
 * FILE OBJECTIVE:
 * - LP-2.1 Hero section: parent-trust focused headline, trust badge bar,
 *   Socratic AI tutor value prop, Google Sign-In CTA, social proof.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/HeroSection.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-2.1: rewrite hero with parent-permission headline,
 *   horizontal trust badge bar, parent/child illustration placeholder, 100vh mobile / 90vh desktop
 * - 2026-04-24T12:00:00Z | staff-engineer | P0.1: CTA -> /parent-onboarding; add 3 value prop icons
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';

// Trust badge bar items per LP-2.1 spec
const TRUST_BADGES = [
  { icon: '🛡️', label: 'DPDP Compliant' },
  { icon: '👁️', label: 'No Tracking' },
  { icon: '📵', label: 'No Social Features' },
  { icon: '🇮🇳', label: 'Servers in India' },
] as const;

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

  const testimonials = [
    'Meri beti ke marks 45% se 78% ho gaye! - Sunita, Jaipur',
    '₹3000 tuition se ₹399 mein better results! - Rajesh, Indore',
    '24x7 doubt solving, amazing! - Priya, Lucknow',
  ];

  const handleSeeHow = () => {
    const el = document.querySelector('#how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative min-h-screen md:min-h-[90vh] flex flex-col bg-gradient-to-br from-[#F0EFFF] via-background to-background">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Trust badge bar -- horizontal scrollable on mobile, static row on desktop */}
      <div className="relative z-10 bg-white/80 border-b border-[#534AB7]/10 py-2.5">
        <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center gap-4 md:gap-8 overflow-x-auto scrollbar-none md:justify-center whitespace-nowrap">
            {TRUST_BADGES.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-secondary shrink-0"
              >
                <span role="img" aria-hidden="true">
                  {badge.icon}
                </span>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative flex-1 w-full mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-16 flex items-center">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto w-full">
          {/* Left -- copy */}
          <div className="text-center lg:text-left space-y-6">
            {/* Social proof badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D9E75]/10 text-[#1D9E75] rounded-full text-sm font-semibold">
              <Icon name="CheckBadgeIcon" size={18} variant="solid" />
              <span>Trusted by 1 Lakh+ Indian families</span>
            </div>

            {/* Main headline -- LP-2.1 spec */}
            <div className="space-y-3">
              <h1 className="font-headline font-bold text-4xl md:text-5xl lg:text-6xl text-secondary leading-tight">
                The AI Tutor That Asks <span className="text-[#534AB7]">YOUR Permission</span> First
              </h1>
              {/* Hindi alternate */}
              <p className="font-accent text-xl md:text-2xl text-[#534AB7]">
                AI Tutor जो पहले आपकी अनुमति लेता है
              </p>
              <p className="font-body text-base md:text-lg text-foreground/80 max-w-xl mx-auto lg:mx-0">
                Spinzy Academy lets your child learn with an AI tutor while you control what they
                access, for how long, and what data is shared.
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/parent-onboarding"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 md:px-8 md:py-4 min-h-[48px] bg-[#FF6B35] text-white font-cta font-semibold rounded-lg hover:bg-[#e85f2a] transition-all duration-250 text-base md:text-lg shadow-lg"
              >
                <Icon name="SparklesIcon" size={20} variant="solid" />
                <span>Start Free with Google</span>
              </Link>
              <button
                onClick={handleSeeHow}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 min-h-[48px] bg-background border-2 border-secondary text-secondary font-cta font-semibold rounded-lg hover:bg-secondary hover:text-white transition-all duration-250 text-base md:text-lg"
              >
                <Icon name="PlayCircleIcon" size={24} variant="solid" />
                <span>See How It Works</span>
              </button>
            </div>

            {/* Below-CTA microcopy */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-sm md:text-base text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={18} variant="solid" className="text-[#1D9E75]" />
                {FREE_SESSIONS_TEXT}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={18} variant="solid" className="text-[#1D9E75]" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={18} variant="solid" className="text-[#1D9E75]" />
                Setup in 2 minutes
              </span>
            </div>

            {/* P0.1: Three value prop icons */}
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
              {[
                { icon: '📚', label: 'All Boards Covered', sub: 'CBSE, ICSE, State Board' },
                { icon: '🛡️', label: 'Parental Control', sub: 'You approve every session' },
                { icon: '⭐', label: 'Free to Start', sub: 'No credit card needed' },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3 bg-[#EEEDFE] rounded-2xl px-4 py-3 min-w-[140px]">
                  <span aria-hidden="true" className="text-2xl">
                    {icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#534AB7] leading-tight">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Rotating testimonials */}
            {isHydrated && (
              <div className="bg-muted/50 rounded-lg p-3 md:p-4 border border-border">
                <p className="font-body text-sm md:text-base text-foreground italic text-center lg:text-left">
                  &ldquo;{testimonials[currentTestimonial]}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Right -- illustration: parent phone → child tablet */}
          <div className="relative flex justify-center">
            {/*
             * LP-2.1: Illustration showing parent phone (approval screen) → child tablet (learning screen).
             * NOT a photo of a child (COPPA/DPDP compliance).
             * TODO: Replace SVG placeholder with a professional SVG/Lottie illustration once designed.
             */}
            <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto">
              {/* Parent phone mockup */}
              <div className="absolute -left-4 md:-left-8 top-0 z-10 w-32 md:w-40 bg-white rounded-2xl shadow-2xl border-4 border-[#534AB7] p-3">
                <div className="text-xs font-bold text-secondary mb-1 text-center">Parent</div>
                <div className="bg-[#EEEDFE] rounded-lg p-2 text-center">
                  <p className="text-[9px] font-semibold text-[#534AB7] leading-snug">
                    Allow 1hr Math session?
                  </p>
                  <div className="flex gap-1 mt-2">
                    <span className="flex-1 bg-[#1D9E75] text-white text-[8px] font-bold rounded py-1 text-center">
                      Approve
                    </span>
                    <span className="flex-1 bg-gray-200 text-gray-600 text-[8px] font-bold rounded py-1 text-center">
                      Deny
                    </span>
                  </div>
                </div>
                <p className="text-[8px] text-center text-muted-foreground mt-1">
                  🛡️ You are in control
                </p>
              </div>

              {/* Child tablet mockup */}
              <div className="ml-20 md:ml-24 bg-white rounded-3xl shadow-2xl border-4 border-[#534AB7]/40 p-4">
                <div className="text-xs font-bold text-secondary mb-2 text-center">Student</div>
                <div className="bg-[#EAF3DE] rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-semibold text-[#1D9E75] mb-1">
                    Teacher Vidya asks:
                  </p>
                  <p className="text-[9px] text-secondary leading-snug">
                    "If 2x + 4 = 10, what is the value of x? Think step by step!"
                  </p>
                </div>
                <div className="bg-[#EEEDFE] rounded-xl p-2">
                  <p className="text-[9px] text-[#534AB7] font-medium">Student types: x = 3</p>
                  <p className="text-[9px] text-[#1D9E75] mt-1">🎉 Correct! Well done!</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[8px] text-muted-foreground">Session: 23 min</span>
                  <span className="text-[8px] bg-[#EEEDFE] text-[#534AB7] rounded-full px-2 py-0.5 font-medium">
                    Maths · Ch 3
                  </span>
                </div>
              </div>

              {/* Connection arrow */}
              <div className="absolute left-[6.5rem] md:left-[7.5rem] top-10 z-20 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md border-2 border-[#534AB7]/30">
                <Icon name="ArrowRightIcon" size={16} variant="solid" className="text-[#534AB7]" />
              </div>

              {/* Stats badge */}
              <div className="absolute -bottom-4 -right-2 md:-right-6 bg-white rounded-xl shadow-xl p-3 border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                    <Icon
                      name="AcademicCapIcon"
                      size={22}
                      variant="solid"
                      className="text-success"
                    />
                  </div>
                  <div>
                    <p className="font-headline font-bold text-xl text-secondary">5L+</p>
                    <p className="font-body text-[10px] text-muted-foreground">Questions Solved</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
