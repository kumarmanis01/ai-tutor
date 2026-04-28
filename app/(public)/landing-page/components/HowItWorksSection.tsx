/**
 * FILE OBJECTIVE:
 * - LP-4.1 How It Works section: parallel Student and Parent journey with 3 steps each,
 *   desktop two-column layout, mobile tab toggle, scroll-triggered card animation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/HowItWorksSection.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-4.1: rewrite with parallel Student/Parent journeys,
 *   mobile tab toggle, Intersection Observer scroll animation
 * - 2026-04-27T00:00:00Z | copilot | v3: add 4th student journey step (Practice & Master)
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/UI/AppIcon';
import AnimatedChatClient from './AnimatedChatClient';

interface JourneyStep {
  number: string;
  emoji: string;
  emojiLabel: string;
  titleEn: string;
  descEn: string;
}

const STUDENT_STEPS: JourneyStep[] = [
  {
    number: '01',
    emoji: '📋',
    emojiLabel: 'Clipboard',
    titleEn: 'Take a 15-min Diagnostic',
    descEn:
      "Teacher Vidya maps your knowledge gaps across every chapter. No stress -- it's just a starting point.",
  },
  {
    number: '02',
    emoji: '🤖',
    emojiLabel: 'Robot',
    titleEn: 'Learn Socratically from AI',
    descEn:
      'No lectures. Teacher Vidya asks you questions, gives hints, and guides you to the answer. Every concept, every session.',
  },
  {
    number: '03',
    emoji: '✨',
    emojiLabel: 'Sparkles',
    titleEn: 'Request Any Topic',
    descEn:
      "Can't find a topic? AI generates curriculum-aligned notes and practice questions in ~30 seconds. You study exactly what you need.",
  },
  {
    number: '04',
    emoji: '🏆',
    emojiLabel: 'Trophy',
    titleEn: 'Practice & Master',
    descEn:
      'Unlimited practice, AI hints, and board exam mock tests. Track your mastery level topic by topic until exam day.',
  },
];

const PARENT_STEPS: JourneyStep[] = [
  {
    number: '01',
    emoji: '✅',
    emojiLabel: 'Checkmark',
    titleEn: 'Approve & Set Limits',
    descEn:
      'You decide what subjects your child can access and for how long. No unsupervised AI usage.',
  },
  {
    number: '02',
    emoji: '📊',
    emojiLabel: 'Chart',
    titleEn: 'Watch Progress',
    descEn:
      'Weekly email reports + real-time dashboard showing time spent, accuracy, and weak topics.',
  },
  {
    number: '03',
    emoji: '🎯',
    emojiLabel: 'Target',
    titleEn: 'Assign Extra Practice',
    descEn:
      'Tap any weak topic to instantly assign 10 targeted questions. Your child gets a fun quest -- not a punishment.',
  },
];

// Sub-component: single step card
function JourneyStep({
  step,
  color,
  visible,
}: {
  step: JourneyStep;
  color: string;
  visible: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col items-center text-center md:items-start md:text-left transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      {/* Step number watermark */}
      <div
        className={`absolute top-0 left-0 -translate-x-1 -translate-y-1 font-headline font-bold text-5xl select-none leading-none ${color}/10`}
      >
        {step.number}
      </div>

      {/* Emoji icon */}
      <div
        className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-4 flex-shrink-0`}
      >
        <span role="img" aria-label={step.emojiLabel} className="text-2xl">
          {step.emoji}
        </span>
      </div>

      <h3 className="font-headline font-bold text-lg text-secondary mb-2">{step.titleEn}</h3>
      <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed">
        {step.descEn}
      </p>
    </div>
  );
}

type ActiveTab = 'student' | 'parent';

const HowItWorksSection = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('student');
  const [visibleCards, setVisibleCards] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for scroll-triggered animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCards(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    const el = sectionRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const displayedSteps = activeTab === 'student' ? STUDENT_STEPS : PARENT_STEPS;

  return (
    <section id="how-it-works" className="py-10 md:py-14 bg-[#EEEDFE]/40" ref={sectionRef}>
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        {/* Heading */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#534AB7]/10 text-[#534AB7] rounded-full text-sm font-medium mb-4">
            <Icon name="SparklesIcon" size={20} variant="solid" />
            <span>How Spinzy Works</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-3">
            How Spinzy Works -- For Students &amp; Parents
          </h2>
          <p className="font-accent text-lg md:text-xl text-[#534AB7]">
            Spinzy कैसे काम करता है -- छात्रों और माता-पिता के लिए
          </p>
        </div>

        {/* Mobile tab toggle -- only visible below lg breakpoint */}
        <div className="flex lg:hidden justify-center mb-8">
          <div className="inline-flex rounded-xl bg-white border border-[#534AB7]/20 p-1 gap-1">
            <button
              onClick={() => setActiveTab('student')}
              className={`px-5 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'student'
                  ? 'bg-[#534AB7] text-white shadow'
                  : 'text-secondary hover:bg-[#EEEDFE]'
              }`}
            >
              For Students
            </button>
            <button
              onClick={() => setActiveTab('parent')}
              className={`px-5 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'parent'
                  ? 'bg-[#534AB7] text-white shadow'
                  : 'text-secondary hover:bg-[#EEEDFE]'
              }`}
            >
              For Parents
            </button>
          </div>
        </div>

        {/* Desktop: two-column side-by-side / Mobile: single column based on active tab */}
        <div className="hidden lg:grid grid-cols-2 gap-x-12 gap-y-4 mb-10">
          {/* Student column */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#534AB7] flex items-center justify-center">
                <Icon name="AcademicCapIcon" size={22} variant="solid" className="text-white" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-secondary">Student Journey</h3>
                <p className="font-accent text-sm text-[#534AB7]">छात्र की यात्रा</p>
              </div>
            </div>
            <div className="space-y-8">
              {STUDENT_STEPS.map((step) => (
                <JourneyStep
                  key={step.number}
                  step={step}
                  color="bg-[#534AB7]/10 text-[#534AB7]"
                  visible={visibleCards}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block absolute inset-y-0 left-1/2 w-px bg-[#534AB7]/10 mx-auto" />

          {/* Parent column */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#1D9E75] flex items-center justify-center">
                <Icon name="UserIcon" size={22} variant="solid" className="text-white" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-secondary">Parent Journey</h3>
                <p className="font-accent text-sm text-[#1D9E75]">माता-पिता की यात्रा</p>
              </div>
            </div>
            <div className="space-y-8">
              {PARENT_STEPS.map((step) => (
                <JourneyStep
                  key={step.number}
                  step={step}
                  color="bg-[#1D9E75]/10 text-[#1D9E75]"
                  visible={visibleCards}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: active tab content */}
        <div className="lg:hidden space-y-8 mb-10">
          {displayedSteps.map((step) => (
            <JourneyStep
              key={step.number}
              step={step}
              color={
                activeTab === 'student'
                  ? 'bg-[#534AB7]/10 text-[#534AB7]'
                  : 'bg-[#1D9E75]/10 text-[#1D9E75]'
              }
              visible={visibleCards}
            />
          ))}
        </div>

        {/* Animated chat demo (client) */}
        <AnimatedChatClient />
      </div>
    </section>
  );
};

export default HowItWorksSection;
