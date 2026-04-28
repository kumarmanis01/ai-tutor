/**
 * FILE OBJECTIVE:
 * - LP-4.1 how-it-works section with parallel student and parent journeys,
 *   mobile tab toggle, desktop timelines, and scroll-triggered reveal animation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/HowItWorksSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-4.1: rewrite with parallel Student/Parent journeys,
 *   mobile tab toggle, Intersection Observer scroll animation
 * - 2026-04-27T00:00:00Z | copilot | v3: add 4th student journey step (Practice & Master)
 * - 2026-04-28T00:00:00Z | copilot | LP-4.1: restore exact three-step journeys and desktop connector timelines
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/UI/AppIcon';

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

function JourneyStepCard({
  step,
  visible,
}: {
  step: JourneyStep;
  visible: boolean;
}) {
  return (
    <article
      className={`relative rounded-3xl border border-[#534AB7]/10 bg-white/90 p-6 shadow-sm transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <div className="absolute right-5 top-5 text-5xl font-bold leading-none text-[#534AB7]/10">
        {step.number}
      </div>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEEDFE]">
        <span role="img" aria-label={step.emojiLabel} className="text-2xl">
          {step.emoji}
        </span>
      </div>
      <h3 className="mb-2 font-headline text-lg font-bold text-secondary">{step.titleEn}</h3>
      <p className="font-body text-sm leading-relaxed text-muted-foreground md:text-base">{step.descEn}</p>
    </article>
  );
}

function JourneyColumn({
  accentClassName,
  iconName,
  label,
  labelHi,
  steps,
  visible,
}: {
  accentClassName: string;
  iconName: string;
  label: string;
  labelHi: string;
  steps: JourneyStep[];
  visible: boolean;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentClassName}`}>
          <Icon name={iconName} size={22} variant="solid" className="text-white" />
        </div>
        <div>
          <h3 className="font-headline text-xl font-bold text-secondary">{label}</h3>
          <p className="font-accent text-sm text-[#534AB7]">{labelHi}</p>
        </div>
      </div>
      <div className="relative space-y-6 pl-8">
        <div className="absolute bottom-8 left-[27px] top-8 w-px bg-[#534AB7]/15" aria-hidden="true" />
        {steps.map((step) => (
          <div key={step.number} className="relative">
            <span className="absolute -left-[18px] top-10 h-3 w-3 rounded-full bg-[#534AB7]" aria-hidden="true" />
            <JourneyStepCard step={step} visible={visible} />
          </div>
        ))}
      </div>
    </div>
  );
}

type ActiveTab = 'student' | 'parent';

const HowItWorksSection = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('student');
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    const currentSection = sectionRef.current;
    if (currentSection) {
      observer.observe(currentSection);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={sectionRef} className="bg-[#EEEDFE]/40 py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="mb-8 text-center md:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#534AB7]/10 px-4 py-2 text-sm font-medium text-[#534AB7]">
            <Icon name="SparklesIcon" size={20} variant="solid" />
            <span>How Spinzy Works</span>
          </div>
          <h2 className="mb-3 font-headline text-3xl font-bold text-secondary md:text-4xl lg:text-5xl">
            How Spinzy Works -- For Students &amp; Parents
          </h2>
          <p className="font-accent text-lg text-[#534AB7] md:text-xl">
            Spinzy कैसे काम करता है -- छात्रों और माता-पिता के लिए
          </p>
        </div>

        <div className="mb-8 flex justify-center lg:hidden">
          <div className="inline-flex gap-1 rounded-xl border border-[#534AB7]/20 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              className={`min-h-[44px] rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'student'
                  ? 'bg-[#534AB7] text-white shadow'
                  : 'text-secondary hover:bg-[#EEEDFE]'
              }`}
            >
              For Students
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('parent')}
              className={`min-h-[44px] rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'parent'
                  ? 'bg-[#534AB7] text-white shadow'
                  : 'text-secondary hover:bg-[#EEEDFE]'
              }`}
            >
              For Parents
            </button>
          </div>
        </div>

        <div className="hidden gap-10 lg:grid lg:grid-cols-2">
          <JourneyColumn
            accentClassName="bg-[#534AB7]"
            iconName="AcademicCapIcon"
            label="Student Journey"
            labelHi="छात्र की यात्रा"
            steps={STUDENT_STEPS}
            visible={isVisible}
          />
          <JourneyColumn
            accentClassName="bg-[#1D9E75]"
            iconName="UserIcon"
            label="Parent Journey"
            labelHi="माता-पिता की यात्रा"
            steps={PARENT_STEPS}
            visible={isVisible}
          />
        </div>

        <div className="space-y-6 lg:hidden">
          {(activeTab === 'student' ? STUDENT_STEPS : PARENT_STEPS).map((step) => (
            <JourneyStepCard key={`${activeTab}-${step.number}`} step={step} visible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
