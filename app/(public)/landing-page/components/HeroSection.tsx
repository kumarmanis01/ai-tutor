/**
 * FILE OBJECTIVE:
 * - LP-2.1 hero section for the landing page, centered on parent permission,
 *   trust badges, Google sign-in CTA, and a parent-to-child product illustration.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/HeroSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-2.1: rewrite hero with parent-permission headline,
 *   horizontal trust badge bar, parent/child illustration placeholder, 100vh mobile / 90vh desktop
 * - 2026-04-24T12:00:00Z | staff-engineer | P0.1: CTA -> /parent-onboarding; add 3 value prop icons
 * - 2026-04-27T00:00:00Z | copilot | v3: student-focused copy, CTA to app.spinzyacademy.com,
 *   Watch Demo triggers VideoModal, updated trust/social badges
 * - 2026-04-28T00:00:00Z | copilot | LP-2.1: restore parent-permission copy, Google CTA, and parent-child illustration
 */
'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';
import LandingGoogleCtaButton from './LandingGoogleCtaButton';
import VideoModal from './VideoModal';

const TRUST_BADGES = [
  { icon: '🛡️', label: 'DPDP Compliant' },
  { icon: '👁️', label: 'No Tracking' },
  { icon: '📵', label: 'No Social Features' },
  { icon: '🇮🇳', label: 'Servers in India' },
] as const;

const AVATAR_COLORS = ['bg-[#534AB7]', 'bg-[#FF6B35]', 'bg-[#1D9E75]', 'bg-[#BA7517]', 'bg-[#1A2E45]'];

const HeroSection = () => {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,107,53,0.16),_transparent_28%),linear-gradient(135deg,#fff8ef_0%,#f7f8ff_52%,#eef4ff_100%)] md:min-h-[90vh]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-[-8%] top-24 h-64 w-64 rounded-full bg-[#FF6B35]/10 blur-3xl" />
          <div className="absolute bottom-10 right-[-6%] h-72 w-72 rounded-full bg-[#534AB7]/10 blur-3xl" />
        </div>

        <div className="relative z-10 border-b border-[#534AB7]/10 bg-white/80 py-2.5 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
            <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap scrollbar-none md:justify-center md:gap-8">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-secondary md:text-sm"
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 items-center px-4 py-10 md:px-6 md:py-16 lg:px-8">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-secondary shadow-sm lg:justify-start">
                <div className="flex items-center -space-x-2" aria-hidden="true">
                  {AVATAR_COLORS.map((color, index) => (
                    <span
                      key={color}
                      className={`h-7 w-7 rounded-full border-2 border-white ${color} ${index === 4 ? 'opacity-85' : ''}`}
                    />
                  ))}
                </div>
                <span>Trusted by 8K+ Indian families</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-headline text-4xl font-bold leading-tight text-secondary md:text-5xl lg:text-6xl">
                  {/* The AI Tutor That Asks YOUR Permission First */}
                  Turn doubts into confidence with Spinzy AI Tutor.
                </h1>
                <p className="font-body text-base leading-relaxed text-foreground/80 md:text-lg lg:max-w-2xl">
                  {/* Spinzy Academy lets your child learn with an AI tutor while you control what they access, for how long, and what data is shared. */}
                                  Adaptive practice, mastery checks, and guided hints that build conceptual fluency -- no shortcuts.
                Adaptive practice, mastery checks, and guided hints that build conceptual fluency -- no shortcuts.
                </p>
                {/* <p className="font-accent text-xl text-[#534AB7] md:text-2xl">
                  AI Tutor जो पहले आपकी अनुमति लेता है
                </p> */}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-center lg:justify-start">
                <LandingGoogleCtaButton
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B35] px-6 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#e85f2d] sm:w-auto"
                  errorClassName="mt-3 text-sm font-medium text-[#E24B4A] sm:max-w-sm"
                  icon={<Icon name="SparklesIcon" size={20} variant="solid" />}
                  label="Start Free -- Sign in with Google"
                />
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-secondary bg-white px-6 py-4 text-base font-semibold text-secondary transition-colors hover:bg-secondary hover:text-white"
                  aria-label="Watch product demo video"
                >
                  <Icon name="PlayCircleIcon" size={24} variant="solid" />
                  <span>Watch Demo</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground lg:justify-start md:text-base">
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
            </div>

            <div className="relative mx-auto flex w-full max-w-xl items-center justify-center lg:justify-end">
              <div className="relative w-full rounded-[32px] border border-white/70 bg-white/70 p-4 shadow-2xl backdrop-blur-sm md:p-5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 520 360"
                  className="absolute inset-0 h-full w-full text-[#534AB7]/20"
                >
                  <path
                    d="M180 130 C235 95, 288 95, 346 135"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="10 10"
                  />
                </svg>

                <div className="relative grid gap-4 md:grid-cols-[0.88fr_0.12fr_1fr] md:items-center">
                  <div className="rounded-[28px] border-4 border-[#1A2E45] bg-[#1A2E45] p-3 shadow-xl">
                    <div className="overflow-hidden rounded-[22px] bg-white">
                      <div className="bg-[#534AB7] px-4 py-3 text-white">
                        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                          Parent Approval
                        </p>
                        <p className="mt-1 text-lg font-bold">Approve today&apos;s session?</p>
                      </div>
                      <div className="space-y-4 p-4">
                        <div className="rounded-2xl bg-[#F4F7FC] p-3">
                          <p className="text-sm font-semibold text-secondary">Riya wants to study</p>
                          <p className="mt-1 text-xs text-muted-foreground">Maths · Fractions · 30 minutes</p>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[#EAF3DE] p-3">
                          <div>
                            <p className="text-sm font-semibold text-secondary">Screen time limit</p>
                            <p className="text-xs text-[#1D9E75]">Within your daily 1 hour rule</p>
                          </div>
                          <div className="h-6 w-11 rounded-full bg-[#1D9E75] p-1">
                            <div className="ml-auto h-4 w-4 rounded-full bg-white" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" className="min-h-[44px] rounded-xl border border-[#1A2E45]/15 px-3 py-2 text-sm font-semibold text-secondary">
                            Review
                          </button>
                          <button type="button" className="min-h-[44px] rounded-xl bg-[#FF6B35] px-3 py-2 text-sm font-bold text-white">
                            Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden items-center justify-center md:flex">
                    <div className="rounded-full bg-white p-3 shadow-lg">
                      <Icon name="ArrowRightIcon" size={22} variant="solid" className="text-[#534AB7]" />
                    </div>
                  </div>

                  <div className="rounded-[34px] border-4 border-[#534AB7]/20 bg-white p-4 shadow-xl">
                    <div className="rounded-[26px] bg-[#F9FAFF] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#534AB7]">
                            Learning Screen
                          </p>
                          <p className="mt-1 text-lg font-bold text-secondary">Teacher Vidya</p>
                        </div>
                        <span className="rounded-full bg-[#EEEDFE] px-3 py-1 text-xs font-semibold text-[#534AB7]">
                          Maths
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-white p-3 shadow-sm">
                          <p className="text-sm font-semibold text-secondary">Guided question</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            If 3/4 of the pizza is eaten, what fraction is left? Think one step at a time.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#EEEDFE] p-3">
                          <p className="text-sm font-semibold text-[#534AB7]">Student answer</p>
                          <p className="mt-1 text-sm text-secondary">1/4 is left.</p>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[#EAF3DE] p-3">
                          <div>
                            <p className="text-sm font-semibold text-secondary">Session status</p>
                            <p className="text-xs text-[#1D9E75]">Approved · Safe mode on</p>
                          </div>
                          <Icon name="ShieldCheckIcon" size={22} variant="solid" className="text-[#1D9E75]" />
                        </div>
                      </div>
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
