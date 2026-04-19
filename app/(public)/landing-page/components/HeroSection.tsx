'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/UI/AppImage';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';

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
    '24×7 doubt solving, amazing! - Priya, Lucknow',
  ];

  const handleSeeHow = () => {
    const el = document.querySelector('#how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-[#F0EFFF] via-background to-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          <div className="text-center lg:text-left space-y-6 md:space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D9E75]/10 text-[#1D9E75] rounded-full text-sm font-semibold">
              <Icon name="CheckBadgeIcon" size={18} variant="solid" />
              <span>Trusted by 1 Lakh+ Indian families</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-headline font-bold text-4xl md:text-5xl lg:text-6xl text-secondary leading-tight">
                Turn doubts into confidence with Spinzy AI Tutor.
              </h1>
              <p className="font-body text-xl md:text-2xl text-foreground/80">
                Adaptive practice, mastery checks, and guided hints that build conceptual fluency -- no shortcuts.
              </p>
              <p className="font-body text-lg md:text-xl text-primary font-semibold">
                Class 1-12 · CBSE / ICSE / State Board · Instant doubt solving in Hindi & English
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 min-h-[44px] bg-[#534AB7] text-white font-cta font-semibold rounded-lg hover:bg-[#4239a0] transition-all duration-250 text-base md:text-lg shadow-lg"
              >
                <Icon name="SparklesIcon" size={20} variant="solid" />
                <span>Get started</span>
              </Link>
              <button
                onClick={handleSeeHow}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 min-h-[44px] bg-background border-2 border-secondary text-secondary font-cta font-semibold rounded-lg hover:bg-secondary hover:text-white transition-all duration-250 text-base md:text-lg"
              >
                <Icon name="PlayCircleIcon" size={24} variant="solid" />
                <span>View sample lesson</span>
              </button>
            </div>

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

            {isHydrated && (
              <div className="bg-muted/50 rounded-lg p-3 md:p-4 border border-border">
                <p className="font-body text-sm md:text-base text-foreground italic text-center lg:text-left">
                  &ldquo;{testimonials[currentTestimonial]}&rdquo;
                </p>
              </div>
            )}
          </div>

          <div className="relative">
            {/* Teacher Vidya avatar badge */}
            <div className="flex flex-col items-center mb-6">
              <AppImage
                src="/logos/vidya/vidya-avatar-128.png"
                alt="Teacher Vidya"
                width={96}
                height={96}
                className="w-24 h-24 rounded-full object-cover ring-2 ring-[#534AB7] ring-offset-2"
              />
              <p className="mt-2 text-sm font-semibold text-[#534AB7]">Teacher Vidya</p>
              <p className="text-xs text-muted-foreground">Your AI home tutor</p>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-border bg-card">
              <AppImage
                src="/images/landing_page_bg.jpg"
                alt="Student learning at desk"
                className="w-full h-auto"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 to-transparent" />
            </div>

            <div className="hidden md:block absolute -bottom-6 -left-6 bg-card rounded-xl shadow-xl p-4 border border-border max-w-[200px]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                  <Icon name="AcademicCapIcon" size={24} variant="solid" className="text-success" />
                </div>
                <div>
                  <p className="font-headline font-bold text-2xl text-secondary">5L+</p>
                  <p className="font-body text-xs text-muted-foreground">Questions Solved</p>
                </div>
              </div>
            </div>

            <div className="hidden md:block absolute -top-6 -right-6 bg-card rounded-xl shadow-xl p-4 border border-border max-w-[180px]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Icon
                    name="DevicePhoneMobileIcon"
                    size={24}
                    variant="solid"
                    className="text-primary"
                  />
                </div>
                <div>
                  <p className="font-headline font-bold text-lg text-secondary">₹5000</p>
                  <p className="font-body text-xs text-muted-foreground">Phone Works!</p>
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
