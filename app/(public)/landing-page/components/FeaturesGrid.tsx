/**
 * FILE OBJECTIVE:
 * - 8-feature grid showcasing Spinzy Academy's key capabilities.
 *   Desktop: 4-column, Mobile: 2-column. Scroll-triggered fade-up per card.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FeaturesGrid.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 */
'use client';

import { useEffect, useRef, useState } from 'react';

interface Feature {
  emoji: string;
  emojiLabel: string;
  titleEn: string;
  descEn: string;
  color: string;
  bg: string;
}

const FEATURES: Feature[] = [
  {
    emoji: '🧠',
    emojiLabel: 'Brain',
    titleEn: 'Socratic AI Tutor',
    descEn: 'Vidya asks guiding questions instead of giving direct answers -- building real mastery.',
    color: 'text-[#534AB7]',
    bg: 'bg-[#EEEDFE]',
  },
  {
    emoji: '🗺️',
    emojiLabel: 'Map',
    titleEn: 'Personal Learning Map',
    descEn: 'AI maps every chapter gap and builds a prioritised revision plan unique to you.',
    color: 'text-[#1D9E75]',
    bg: 'bg-[#EAF3DE]',
  },
  {
    emoji: '📚',
    emojiLabel: 'Books',
    titleEn: 'All Major Boards',
    descEn: 'CBSE, ICSE, and leading State Boards for Classes 6-12. Syllabi always up to date.',
    color: 'text-[#534AB7]',
    bg: 'bg-[#EEEDFE]',
  },
  {
    emoji: '🎯',
    emojiLabel: 'Target',
    titleEn: 'Board Exam Mock Tests',
    descEn: 'Chapter-wise and full-length mock tests with time tracking and score analysis.',
    color: 'text-[#1D9E75]',
    bg: 'bg-[#EAF3DE]',
  },
  {
    emoji: '🌐',
    emojiLabel: 'Globe',
    titleEn: 'Hindi + English',
    descEn: 'Switch languages mid-session. Explanations in the language you think best in.',
    color: 'text-[#534AB7]',
    bg: 'bg-[#EEEDFE]',
  },
  {
    emoji: '📊',
    emojiLabel: 'Chart',
    titleEn: 'Parent Dashboard',
    descEn: 'Real-time progress, weak topics, time spent. Weekly email digest for parents.',
    color: 'text-[#1D9E75]',
    bg: 'bg-[#EAF3DE]',
  },
  {
    emoji: '📱',
    emojiLabel: 'Mobile phone',
    titleEn: 'Works on Any Device',
    descEn: 'Optimised for budget Android phones. PWA -- no app download required.',
    color: 'text-[#534AB7]',
    bg: 'bg-[#EEEDFE]',
  },
  {
    emoji: '🛡️',
    emojiLabel: 'Shield',
    titleEn: 'DPDP Compliant',
    descEn: 'No ads, no data sales, parental consent for under-18. Servers in India.',
    color: 'text-[#1D9E75]',
    bg: 'bg-[#EAF3DE]',
  },
];

const FeaturesGrid = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    const el = sectionRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="py-12 md:py-16 bg-background">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-headline font-bold text-3xl md:text-4xl text-secondary mb-3">
            Everything a Student Needs to Score Higher
          </h2>
          <p className="font-accent text-xl text-[#534AB7]">बेहतर अंक के लिए हर जरूरी चीज</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {FEATURES.map((feature, idx) => (
            <div
              key={feature.titleEn}
              className={`rounded-2xl p-5 ${feature.bg} transition-all duration-500 ${
                visible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${idx * 60}ms` }}
            >
              <div className="text-3xl mb-3" role="img" aria-label={feature.emojiLabel}>
                {feature.emoji}
              </div>
              <h3 className={`font-headline font-bold text-base mb-1 ${feature.color}`}>
                {feature.titleEn}
              </h3>
              <p className="font-body text-sm text-secondary/80 leading-relaxed">
                {feature.descEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
