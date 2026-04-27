/**
 * FILE OBJECTIVE:
 * - LP-2.1 Hero section: student-focused headline, v3 copy, VideoModal trigger,
 *   trust badges, social proof, and primary CTA to app registration.
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
 * - 2026-04-27T00:00:00Z | copilot | v3: student-focused copy, CTA to app.spinzyacademy.com,
 *   Watch Demo triggers VideoModal, updated trust/social badges
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';
import VideoModal from './VideoModal';

// Trust badge bar items per LP-2.1 v3 spec
const TRUST_BADGES = [
  { icon: 'ðŸ›¡ï¸', label: 'DPDP Compliant' },
  { icon: 'ðŸ‡®ðŸ‡³', label: 'Servers in India' },
  { icon: 'ðŸ“š', label: 'CBSE / ICSE / State Boards' },
  { icon: 'â­', label: 'Free to Start' },
] as const;

const HeroSection = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);

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
    'Ek mahine mein Science mein confident ho gaya! - Arjun, Pune',
    '24x7 doubt solving, amazing value for money! - Priya, Lucknow',
  ];

  const handleSeeHow = () => {
    const el = document.querySelector('#how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
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
                <Icon name="StarIcon" size={18} variant="solid" />
                <span>Trusted by 10,000+ Indian Parents</span>
                <span className="ml-1 font-bold">â­â­â­â­â­ 4.9/5</span>
              </div>

              {/* Main headline -- v3 student focused */}
              <div className="space-y-3">
                <h1 className="font-headline font-bold text-4xl md:text-5xl lg:text-6xl text-secondary leading-tight">
                  AI Home Tutor for Indian Students --{' '}
                  <span className="text-[#534AB7]">Learn Smarter, Score Higher</span>
                </h1>
                {/* Hindi sub */}
                <p className="font-accent text-xl md:text-2xl text-[#534AB7]">
                  CBSE, ICSE à¤”à¤° State Board à¤•à¥‡ à¤²à¤¿à¤ à¤ªà¤°à¥à¤¸à¤¨à¤²à¤¾à¤‡à¤œà¤¼à¥à¤¡ AI à¤Ÿà¥à¤¯à¥‚à¤Ÿà¤°
                </p>
                <p className="font-body text-base md:text-lg text-foreground/80 max-w-xl mx-auto lg:mx-0">
                  Teacher Vidya guides you with hints and questions -- not just answers -- so you
                  build real understanding and score higher in board exams.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="https://app.spinzyacademy.com/register"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 md:px-8 md:py-4 min-h-[48px] bg-[#534AB7] text-white font-cta font-semibold rounded-lg hover:bg-[#433ba0] transition-all duration-250 text-base md:text-lg shadow-lg"
                >
                  <Icon name="SparklesIcon" size={20} variant="solid" />
                  <span>Start Learning Free &rarr;</span>
                </Link>
                <button
                  onClick={() => setVideoOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 min-h-[48px] bg-background border-2 border-secondary text-secondary font-cta font-semibold rounded-lg hover:bg-secondary hover:text-white transition-all duration-250 text-base md:text-lg"
                  aria-label="Watch product demo video"
                >
                  <Icon name="PlayCircleIcon" size={24} variant="solid" />
                  <span>Watch Demo</span>
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

              {/* Three value prop icons */}
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                {[
                  { icon: 'ðŸ“š', label: 'All Boards Covered', sub: 'CBSE, ICSE, State Board' },
                  { icon: 'ðŸ¤–', label: 'Socratic AI Tutor', sub: 'Guides, never just answers' },
                  { icon: 'â­', label: 'Free to Start', sub: 'No credit card needed' },
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

            {/* Right -- student learning illustration */}
            <div className="relative flex justify-center">
              {/*
               * LP-2.1 v3: Illustration showing student learning with AI tutor Vidya.
               * NOT a photo of a child (COPPA/DPDP compliance).
               * TODO: Replace SVG placeholder with professional SVG/Lottie once designed.
               */}
              <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto">
                {/* Teacher Vidya chat mockup */}
                <div className="bg-white rounded-3xl shadow-2xl border-4 border-[#534AB7]/40 p-4">
                  <div className="text-xs font-bold text-secondary mb-2 text-center">Teacher Vidya</div>
                  <div className="bg-[#EAF3DE] rounded-xl p-3 mb-2">
                    <p className="text-[10px] font-semibold text-[#1D9E75] mb-1">
                      Teacher Vidya asks:
                    </p>
                    <p className="text-[9px] text-secondary leading-snug">
                      &ldquo;If 2x + 4 = 10, what is the value of x? Think step by step!&rdquo;
                    </p>
                  </div>
                  <div className="bg-[#EEEDFE] rounded-xl p-2">
                    <p className="text-[9px] text-[#534AB7] font-medium">Student: x = 3</p>
                    <p className="text-[9px] text-[#1D9E75] mt-1">ðŸŽ‰ Correct! Well done!</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[8px] text-muted-foreground">Session: 23 min</span>
                    <span className="text-[8px] bg-[#EEEDFE] text-[#534AB7] rounded-full px-2 py-0.5 font-medium">
                      Maths Â· Ch 3
                    </span>
                  </div>
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
                      <p className="font-headline font-bold text-xl text-secondary">10K+</p>
                      <p className="font-body text-[10px] text-muted-foreground">Active Students</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <VideoModal isOpen={videoOpen} onClose={() => setVideoOpen(false)} />
    </>
  );
};

export default HeroSection;
