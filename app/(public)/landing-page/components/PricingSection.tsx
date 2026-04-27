/**
 * FILE OBJECTIVE:
 * - LP-6.1/6.2 Pricing section: monthly/quarterly/annual toggle, three plans with
 *   "Best Value" badge on annual, 30-day money-back, and free tier callout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/PricingSection.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | restore clean PricingSection and imports; remove corrupted leading fragment
 * - 2026-04-26T00:00:00Z | copilot | LP-6.2: add annual savings and tuition comparison
 * - 2026-04-27T00:00:00Z | copilot | v3: replace plan tiers with monthly/quarterly/annual, add billing toggle
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';

interface PricingTier {
  id: BillingCycle;
  label: string;
  price: number;
  period: string;
  perMonthNote?: string;
  badge?: string;
  savings?: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 999,
    period: 'per month',
  },
  {
    id: 'quarterly',
    label: 'Quarterly',
    price: 2699,
    period: 'per quarter',
    perMonthNote: '~₹900/mo',
    savings: 'Save ₹298 vs monthly',
  },
  {
    id: 'annual',
    label: 'Annual',
    price: 8999,
    period: 'per year',
    perMonthNote: '~₹750/mo',
    badge: 'Best Value',
    savings: 'Save ₹2,989 vs monthly',
  },
];

const PLAN_FEATURES = [
  'Unlimited practice questions',
  'Personalised Learning Map',
  'AI tutor Vidya (Socratic hints)',
  'Board exam mock tests',
  'Hindi + English explanations',
  'Parent progress dashboard',
  'Weekly email reports',
  'All subjects, Classes 6-12',
];

const PricingSection = () => {
  const [selected, setSelected] = useState<BillingCycle>('annual');

  const activeTier = PRICING_TIERS.find((t) => t.id === selected) ?? PRICING_TIERS[2];

  return (
    <section id="pricing" className="py-12 md:py-16 bg-gradient-to-br from-secondary/5 to-primary/5">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        {/* Section heading */}
        <div className="text-center mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            <Icon name="CurrencyRupeeIcon" size={20} variant="solid" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Choose Your Plan
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">अपनी योजना चुनें</p>
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            No hidden charges. Cancel anytime. 30-day money-back guarantee on annual plans.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl border border-border bg-background p-1 gap-1">
            {PRICING_TIERS.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelected(tier.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${
                  selected === tier.id
                    ? 'bg-[#534AB7] text-white shadow'
                    : 'text-secondary hover:bg-muted'
                }`}
              >
                {tier.label}
                {tier.badge && (
                  <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 bg-[#1D9E75] text-white text-[10px] font-bold rounded-full leading-none">
                    {tier.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pricing card */}
        <div className="max-w-lg mx-auto mb-8">
          <div className="relative rounded-2xl border-2 border-primary bg-primary/5 shadow-2xl p-8">
            {activeTier.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#1D9E75] text-white rounded-full text-sm font-bold shadow-lg">
                {activeTier.badge}
              </div>
            )}

            {/* Price display */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-2 mb-1">
                <span className="font-headline font-bold text-6xl text-secondary">
                  ₹{activeTier.price.toLocaleString('en-IN')}
                </span>
                <span className="font-body text-base text-muted-foreground">/{activeTier.period.replace('per ', '')}</span>
              </div>
              {activeTier.perMonthNote && (
                <p className="text-sm text-muted-foreground">{activeTier.perMonthNote}</p>
              )}
              {activeTier.savings && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-full text-sm font-semibold">
                  <Icon name="CheckCircleIcon" size={16} variant="solid" />
                  <span>{activeTier.savings}</span>
                </div>
              )}
            </div>

            {/* Features list */}
            <div className="space-y-3 mb-8">
              {PLAN_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <Icon name="CheckCircleIcon" size={20} variant="solid" className="text-primary shrink-0" />
                  <span className="font-body text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href="https://app.spinzyacademy.com/register"
              className="w-full py-3 rounded-lg font-cta font-semibold transition-all duration-250 min-h-[44px] flex items-center justify-center bg-[#534AB7] text-white hover:bg-[#4239a0] shadow-lg text-base"
            >
              Get started -- it takes 2 minutes
            </Link>
          </div>
        </div>

        {/* Free tier callout */}
        <div className="max-w-lg mx-auto text-center mb-10 p-4 rounded-xl bg-muted/50 border border-border">
          <p className="font-body text-sm text-muted-foreground">
            <span className="font-semibold text-secondary">Not ready to subscribe?</span>{' '}
            Try free -- 5 daily practice questions. No credit card needed.{' '}
            <Link href="https://app.spinzyacademy.com/register" className="text-primary hover:underline font-semibold">
              Start free
            </Link>
          </p>
        </div>

        {/* Payment trust badges */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">
            🔒 Secure checkout &middot; UPI / Cards / Net Banking &middot; Powered by Razorpay
          </p>
          <p className="text-xs text-muted-foreground">All prices inclusive of taxes</p>
          <p className="text-xs text-muted-foreground mt-2">
            Questions?{' '}
            <a href="#faq" className="text-primary hover:underline font-semibold">
              See our FAQ
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
