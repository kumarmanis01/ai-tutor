'use client';

import { useState, useEffect } from 'react';
import AppImage from '@/components/UI/AppImage';
import Icon from '@/components/UI/AppIcon';
import ConversionCTA from '@/components/ConversionCTA';

interface HeroSectionProps {
  onDemoClick: () => void;
}

const HeroSection = ({ onDemoClick }: HeroSectionProps) => {
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
    '₹3000 tuition se ₹99 mein better results! - Rajesh, Indore',
    '24×7 doubt solving, amazing! - Priya, Lucknow',
  ];

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 pt-20 md:pt-24">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          <div className="text-center lg:text-left space-y-6 md:space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-sm font-medium">
              <Icon name="CheckBadgeIcon" size={20} variant="solid" />
              <span>Trusted by 5+ Lakh Students</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-headline font-bold text-4xl md:text-5xl lg:text-6xl text-secondary leading-tight">
                AI Tutor – Har Bacche Ka Personal Teacher. 24×7
              </h1>
              <p className="font-body text-xl md:text-2xl text-foreground/80">
                Every Child Deserves Quality Education
              </p>
              <p className="font-body text-lg md:text-xl text-primary font-semibold">
                Get instant homework help in Hindi & English for just ₹99/month
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <ConversionCTA variant="hero" />
              <button
                onClick={onDemoClick}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-background border-2 border-secondary text-secondary font-cta font-semibold rounded-lg hover:bg-secondary hover:text-white transition-all duration-250 text-base md:text-lg"
              >
                <Icon name="PlayCircleIcon" size={24} variant="solid" />
                <span>See Demo Video</span>
              </button>
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm md:text-base text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={20} variant="solid" className="text-success" />
                  <span>No Credit Card Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="ShieldCheckIcon" size={20} variant="solid" className="text-success" />
                  <span>100% Safe & Private</span>
                </div>
              </div>

              {isHydrated && (
                <div className="bg-muted/50 rounded-lg p-3 md:p-4 border border-border">
                  <p className="font-body text-sm md:text-base text-foreground italic text-center lg:text-left">
                    "{testimonials[currentTestimonial]}"
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-border bg-card">
              <AppImage
                src="https://images.unsplash.com/photo-1547567667-1aa64e6f58dc"
                alt="Indian student girl in school uniform smiling while using smartphone for learning, sitting at study desk with books"
                className="w-full h-auto"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 to-transparent" />
            </div>

            <div className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-xl p-4 border border-border max-w-[200px]">
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

            <div className="absolute -top-6 -right-6 bg-card rounded-xl shadow-xl p-4 border border-border max-w-[180px]">
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
