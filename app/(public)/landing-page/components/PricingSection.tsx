/**
 * FILE OBJECTIVE:
 * - LP-6.1/6.2 pricing section with Free, Individual, and Family plans,
 *   monthly/yearly toggle, feature comparison matrix, and annual savings callout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/PricingSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | restore clean PricingSection and imports; remove corrupted leading fragment
 * - 2026-04-26T00:00:00Z | copilot | LP-6.2: add annual savings and tuition comparison
 * - 2026-04-27T00:00:00Z | copilot | v3: replace plan tiers with monthly/quarterly/annual, add billing toggle
 * - 2026-04-27T10:45:00Z | copilot | align linked unit test path with added pricing component test file
 * - 2026-04-27T14:30:00Z | copilot | LP-6.2: render savings comparison block below annual plan card only
 * - 2026-04-28T00:00:00Z | copilot | LP-6.1: replace single-plan pricing card with Free/Individual/Family comparison table
 */
'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import LandingGoogleCtaButton from './LandingGoogleCtaButton';
import SavingsComparison from './SavingsComparison';

type BillingCycle = 'monthly' | 'yearly';
type PlanId = 'free' | 'individual' | 'family';

interface PlanPrice {
  monthly: string;
  yearly: string;
  yearlyNote?: string;
}

interface PlanFeatureValue {
  included: boolean;
  label: string;
}

interface PlanDefinition {
  badge?: string;
  badgeTone?: 'primary' | 'success';
  callout?: string;
  ctaLabel: string;
  id: PlanId;
  name: string;
  price: PlanPrice;
  subtitle: string;
}

interface FeatureRow {
  highlight?: boolean;
  name: string;
  values: Record<PlanId, PlanFeatureValue>;
}

const BILLING_OPTIONS: Array<{ id: BillingCycle; label: string }> = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Ask Teacher Vidya up to 5 questions/ week and enjoy full access to study material for your first 30 days.',
    price: { monthly: '₹0', yearly: '₹0' },
    ctaLabel: 'Start Free',
  },
  {
    id: 'individual',
    name: 'Individual',
    subtitle: 'Unlimited learning and controls for one child.',
    price: { monthly: '₹399', yearly: '₹3,999', yearlyNote: 'Save ₹789' },
    badge: 'Recommended',
    badgeTone: 'primary',
    ctaLabel: 'Get Started',
  },
  {
    id: 'family',
    name: 'Family',
    subtitle: 'The best fit for siblings with a single parent control layer.',
    price: { monthly: '₹599', yearly: '₹5,999', yearlyNote: 'Save ₹1,189' },
    badge: 'Best Value',
    badgeTone: 'success',
    callout: 'Save 25% on 2nd & 3rd child',
    ctaLabel: 'Get Started',
  },
];

const FEATURE_ROWS: FeatureRow[] = [
  {
    name: 'NCERT Notes Access',
    values: {
      free: { included: true, label: 'Yes' },
      individual: { included: true, label: 'Yes' },
      family: { included: true, label: 'Yes' },
    },
  },
  {
    name: 'Practice Questions',
    values: {
      free: { included: true, label: '5/week' },
      individual: { included: true, label: 'Unlimited' },
      family: { included: true, label: 'Unlimited' },
    },
  },
  {
    name: 'AI Tutor (Socratic)',
    values: {
      free: { included: true, label: '3 prompts/day' },
      individual: { included: true, label: 'Unlimited' },
      family: { included: true, label: 'Unlimited' },
    },
  },
  {
    name: 'On-Demand Notes Generation',
    highlight: true,
    values: {
      free: { included: false, label: 'Premium only' },
      individual: { included: true, label: 'Yes' },
      family: { included: true, label: 'Yes' },
    },
  },
  {
    name: 'Parent Dashboard',
    highlight: true,
    values: {
      free: { included: true, label: 'Weekly Email' },
      individual: { included: true, label: 'Real-time + Controls' },
      family: { included: true, label: 'Real-time + Controls' },
    },
  },  
  {
    name: 'Study Material Access',
    values: {
      free: { included: true, label: 'First 30 days' },
      individual: { included: true, label: 'Unlimited' },
      family: { included: true, label: 'Unlimited' },
    },
  },
  {
    name: 'Subject Blocker',
    values: {
      free: { included: false, label: 'No' },
      individual: { included: true, label: 'Yes' },
      family: { included: true, label: 'Yes' },
    },
  },
  {
    name: 'Offline Access',
    values: {
      free: { included: false, label: 'No' },
      individual: { included: true, label: 'Yes' },
      family: { included: true, label: 'Yes' },
    },
  },
  {
    name: 'Progress Reports',
    values: {
      free: { included: true, label: 'Weekly' },
      individual: { included: true, label: 'Weekly + Real-time' },
      family: { included: true, label: 'Weekly + Real-time' },
    },
  },
  {
    name: 'Children Covered',
    values: {
      free: { included: true, label: '1' },
      individual: { included: true, label: '1' },
      family: { included: true, label: 'Up to 3' },
    },
  },
  {
    name: 'Priority Support',
    values: {
      free: { included: false, label: 'No' },
      individual: { included: true, label: 'Email' },
      family: { included: true, label: 'WhatsApp' },
    },
  },
];

function PricingValue({ value }: { value: PlanFeatureValue }) {
  return (
    <div className="flex items-center justify-end gap-2 text-right md:justify-center md:text-center">
      <span className={value.included ? 'text-[#1D9E75]' : 'text-slate-400'} aria-hidden="true">
        {value.included ? '✓' : '✕'}
      </span>
      <span className={value.included ? 'text-secondary' : 'text-muted-foreground'}>{value.label}</span>
    </div>
  );
}

function PlanCard({
  billingCycle,
  plan,
}: {
  billingCycle: BillingCycle;
  plan: PlanDefinition;
}) {
  const badgeClassName =
    plan.badgeTone === 'success' ? 'bg-[#1D9E75] text-white' : 'bg-[#534AB7] text-white';
  const priceLabel = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
  const periodLabel = billingCycle === 'monthly' ? '/month' : '/year';

  return (
    <article
      className={`relative flex h-full flex-col rounded-3xl border p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 ${
        plan.id === 'free' ? 'border-slate-200 bg-slate-50/80' : 'border-[#534AB7]/15 bg-white'
      }`}
    >
      {plan.badge ? (
        <span className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold ${badgeClassName}`}>
          {plan.badge}
        </span>
      ) : null}

      <div className="mb-6">
        <h3 className="font-headline text-2xl font-bold text-secondary">{plan.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.subtitle}</p>
      </div>

      <div className="mb-5">
        <div className="flex items-end gap-2">
          <span className="font-headline text-4xl font-bold text-secondary">{priceLabel}</span>
          <span className="pb-1 text-sm text-muted-foreground">{periodLabel}</span>
        </div>
        {billingCycle === 'yearly' && plan.price.yearlyNote ? (
          <p className="mt-2 text-sm font-semibold text-[#1D9E75]">{plan.price.yearlyNote}</p>
        ) : null}
        {plan.callout ? <p className="mt-2 text-sm font-semibold text-[#534AB7]">{plan.callout}</p> : null}
      </div>

      <ul className="mb-6 space-y-2 text-sm text-secondary">
        {FEATURE_ROWS.slice(0, 4).map((row) => (
          <li key={`${plan.id}-${row.name}`} className="flex items-start gap-2">
            <span className={row.values[plan.id].included ? 'text-[#1D9E75]' : 'text-slate-400'} aria-hidden="true">
              {row.values[plan.id].included ? '✓' : '✕'}
            </span>
            <span>
              {row.name}: {row.values[plan.id].label}
            </span>
          </li>
        ))}
      </ul>

      <LandingGoogleCtaButton
        className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
          plan.id === 'free'
            ? 'border border-[#534AB7]/15 bg-white text-secondary hover:bg-[#EEEDFE]'
            : 'bg-[#534AB7] text-white hover:bg-[#433ba0]'
        }`}
        icon={plan.id === 'free' ? <Icon name="SparklesIcon" size={18} variant="solid" /> : undefined}
        label={plan.ctaLabel}
      />
    </article>
  );
}

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  return (
    <section id="pricing" className="bg-gradient-to-br from-secondary/5 to-primary/5 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="mb-10 text-center md:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Icon name="CurrencyRupeeIcon" size={20} variant="solid" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="mb-4 font-headline text-3xl font-bold text-secondary md:text-4xl lg:text-5xl">
            Choose Your Plan
          </h2>
          <p className="mb-2 font-accent text-xl text-primary md:text-2xl">अपनी योजना चुनें</p>
          <p className="mx-auto max-w-2xl font-body text-base text-muted-foreground md:text-lg">
            See exactly what is free, what is premium, and which plan fits one child or a whole family.
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex gap-1 rounded-xl border border-border bg-background p-1">
            {BILLING_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBillingCycle(option.id)}
                className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  billingCycle === option.id
                    ? 'bg-[#534AB7] text-white shadow'
                    : 'text-secondary hover:bg-muted'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 grid gap-5 lg:grid-cols-3">
          {PLAN_DEFINITIONS.map((plan) => (
            <PlanCard key={plan.id} billingCycle={billingCycle} plan={plan} />
          ))}
        </div>

        {billingCycle === 'yearly' ? <SavingsComparison /> : null}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-secondary md:grid">
            <div>Feature comparison</div>
            {PLAN_DEFINITIONS.map((plan) => (
              <div key={`header-${plan.id}`} className="text-center">
                {plan.name}
              </div>
            ))}
          </div>

          {FEATURE_ROWS.map((row) => (
            <div
              key={row.name}
              className={`grid gap-3 border-b border-slate-100 px-4 py-4 md:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(0,1fr))] md:px-6 ${
                row.highlight ? 'bg-[#EEEDFE]/35' : 'bg-white'
              }`}
            >
              <div className="font-medium text-secondary">{row.name}</div>
              {PLAN_DEFINITIONS.map((plan) => (
                <PricingValue key={`${row.name}-${plan.id}`} value={row.values[plan.id]} />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#534AB7]/10 bg-white/80 p-4 text-center shadow-sm">
          <p className="text-sm font-medium text-secondary">
            🔒 Secure checkout · UPI / Cards / Net Banking · 7-day refund policy · No auto-renewal without reminder
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
