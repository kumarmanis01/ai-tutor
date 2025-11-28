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
    questions: 0,
    students: 0,
    towns: 0,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const targets = {
      questions: 500000,
      students: 100000,
      towns: 40,
    };

    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setCounts({
        questions: Math.floor(targets.questions * progress),
        students: Math.floor(targets.students * progress),
        towns: Math.floor(targets.towns * progress),
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
      icon: 'CheckCircleIcon',
      value: isHydrated ? `${(counts.questions / 100000).toFixed(1)}L+` : '5L+',
      label: 'Questions Solved',
      color: 'text-success',
    },
    {
      icon: 'UserGroupIcon',
      value: isHydrated ? `${(counts.students / 1000).toFixed(0)}K+` : '100K+',
      label: 'Happy Students',
      color: 'text-primary',
    },
    {
      icon: 'BuildingOffice2Icon',
      value: isHydrated ? `${counts.towns}+` : '40+',
      label: 'Towns Covered',
      color: 'text-secondary',
    },
    {
      icon: 'ShieldCheckIcon',
      value: 'Ex-Microsoft',
      label: 'Expert Team',
      color: 'text-accent',
    },
  ];

  return (
    <section className="bg-muted/30 border-y border-border py-8 md:py-12">
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
