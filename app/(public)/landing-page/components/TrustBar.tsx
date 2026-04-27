/**
 * FILE OBJECTIVE:
 * - LP-5.2 animated counter metrics bar showing platform scale and trust indicators.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/TrustBar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-5.2: animated counter metrics
 * - 2026-04-27T00:00:00Z | copilot | v3: update counters to 10k students, 50k hours, 95% satisfaction
 */
'use client';

import { useState, useEffect } from 'react';
import Icon from '@/components/UI/AppIcon';

interface TrustMetric {
  icon: string;
  value: string;
  label: string;
  color: string;
}

const TrustBar = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [counts, setCounts] = useState({
    students: 0,
    hours: 0,
    satisfaction: 0,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const targets = {
      students: 10000,
      hours: 50000,
      satisfaction: 95,
    };

    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setCounts({
        students: Math.floor(targets.students * progress),
        hours: Math.floor(targets.hours * progress),
        satisfaction: Math.floor(targets.satisfaction * progress),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setCounts(targets);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isHydrated]);

  const metrics: TrustMetric[] = [
    {
      icon: 'UserGroupIcon',
      value: isHydrated ? `${counts.students.toLocaleString('en-IN')}+` : '10,000+',
      label: 'Active Students',
      color: 'text-primary',
    },
    {
      icon: 'ClockIcon',
      value: isHydrated ? `${counts.hours.toLocaleString('en-IN')}+` : '50,000+',
      label: 'Hours of Learning',
      color: 'text-success',
    },
    {
      icon: 'StarIcon',
      value: isHydrated ? `${counts.satisfaction}%` : '95%',
      label: 'Parent Satisfaction',
      color: 'text-secondary',
    },
    {
      icon: 'AcademicCapIcon',
      value: 'CBSE, ICSE & State Boards',
      label: 'Curriculum Aligned',
      color: 'text-accent',
    },
  ];

  return (
    <section className="bg-white border-y border-[#534AB7]/10 py-6 md:py-8">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center space-y-2 p-4 rounded-lg hover:bg-background transition-colors"
            >
              <div
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-background flex items-center justify-center ${metric.color}`}
              >
                <Icon name={metric.icon as any} size={28} variant="solid" />
              </div>
              <p className="font-headline font-bold text-2xl md:text-3xl text-secondary">
                {metric.value}
              </p>
              <p className="font-body text-sm md:text-base text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="font-body text-base md:text-lg text-foreground/80">
            <span className="font-semibold text-primary">Works on ₹5000 Phones</span> • Hindi +
            English • <span className="font-semibold text-secondary">Safe & Private</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
