/**
 * FILE OBJECTIVE:
 * - LP-6.1 Pricing section: three-tier pricing (Free / Individual / Family),
 *   feature comparison table, monthly/annual billing toggle, trust signals.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/PricingSection.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-6.1: add feature comparison table, annual billing
 *   toggle, Best Value badge on Family, trust signals row, spec-aligned feature rows
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';
import { PLANS } from '@/lib/billing/plans';

// Feature rows for comparison table — ordered per LP-6.1 spec
interface FeatureRow {
  label: string;
  free: string;
  individual: string;
  family: string;
  highlight?: boolean; // premium features get subtle background tint
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'NCERT Notes Access', free: 'check', individual: 'check', family: 'check' },
  { label: 'Practice Questions', free: '5/day', individual: 'Unlimited', family: 'Unlimited' },
  { label: 'AI Tutor (Socratic)', free: '3 prompts/day', individual: 'Unlimited', family: 'Unlimited' },
  { label: 'On-Demand Topic Generation', free: 'cross', individual: 'check', family: 'check', highlight: true },
  { label: 'Parent Dashboard', free: 'Weekly Email', individual: 'Real-time + Controls', family: 'Real-time + Controls', highlight: true },
  { label: 'Screen Time Limits', free: 'cross', individual: 'check', family: 'check', highlight: true },
  { label: 'Subject Blocker', free: 'cross', individual: 'check', family: 'check', highlight: true },
  { label: 'Offline Access', free: 'cross', individual: 'check', family: 'check' },
  { label: 'Progress Reports', free: 'Weekly', individual: 'Weekly + Real-time', family: 'Weekly + Real-time' },
  { label: 'Children Covered', free: '1', individual: '1', family: 'Up to 3' },
  { label: 'Priority Support', free: 'cross', individual: 'Email', family: 'WhatsApp' },
];

function FeatureCell({ value }: { value: string }) {
  if (value === 'check') {
    return (
      <span className="inline-flex justify-center">
        <Icon name="CheckCircleIcon" size={20} variant="solid" className="text-[#1D9E75]" />
      </span>
    );
  }
  if (value === 'cross') {
    return (
      <span className="inline-flex justify-center">
        <Icon name="XCircleIcon" size={20} variant="solid" className="text-gray-300" />
      </span>
    );
  }
  return <span className="text-xs text-foreground text-center block">{value}</span>;
}

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Plan price data
  const individualMonthly = PLANS.standard_monthly.billedRupees;
  const individualAnnual = PLANS.standard_annual.billedRupees;
  const familyMonthly = PLANS.family_monthly.billedRupees;
  const familyAnnual = PLANS.family_annual.billedRupees;

  // Displayed prices per billing cycle
  const individualPrice = billingCycle === 'monthly' ? `₹${individualMonthly}` : `₹${Math.round(individualAnnual / 12)}`;
  const individualBilledNote = billingCycle === 'annual' ? `₹${individualAnnual}/year` : '';
  const individualSave = billingCycle === 'annual' ? `Save ₹${(individualMonthly * 12) - individualAnnual}` : '';

  const familyPrice = billingCycle === 'monthly' ? `₹${familyMonthly}` : `₹${Math.round(familyAnnual / 12)}`;
  const familyBilledNote = billingCycle === 'annual' ? `₹${familyAnnual}/year` : '';
  const familySave = billingCycle === 'annual' ? `Save ₹${(familyMonthly * 12) - familyAnnual}` : '';

  const standardPlan = PLANS.standard_monthly;
  const traditionalMin = 3000;
  const savingsMin = traditionalMin - standardPlan.billedRupees;

  return (
    <section
      id="pricing"
      className="py-12 md:py-16 bg-gradient-to-br from-secondary/5 to-primary/5"
    >
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        {/* Heading */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            <Icon name="CurrencyRupeeIcon" size={20} variant="solid" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-3">
            Choose Your Perfect Plan
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">अपनी सही योजना चुनें</p>
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            No hidden charges. Cancel anytime. 7-day refund policy.
          </p>

          {/* Monthly / Annual billing toggle */}
          <div className="mt-6 inline-flex items-center gap-3 bg-white rounded-full border border-border px-2 py-2 shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-[#534AB7] text-white shadow'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-[#534AB7] text-white shadow'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Annual
              <span className="text-[10px] bg-[#1D9E75] text-white rounded-full px-2 py-0.5 font-bold">
                2 months free
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards — Free / Individual (Recommended) / Family (Best Value) */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-8">
          {/* FREE */}
          <div className="relative rounded-2xl border-2 border-border bg-background">
            <div className="p-6 md:p-8">
              <div className="text-center mb-6">
                <h3 className="font-headline font-bold text-2xl text-secondary mb-1">Free Plan</h3>
                <p className="font-accent text-base text-primary mb-4">मुफ्त योजना</p>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="font-headline font-bold text-5xl text-secondary">₹0</span>
                  <span className="font-body text-base text-muted-foreground">/forever</span>
                </div>
                <p className="font-body text-sm text-muted-foreground">Try AI Tutor with limited features</p>
              </div>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-lg font-cta font-semibold transition-all duration-250 min-h-[44px] flex items-center justify-center bg-secondary text-white hover:bg-secondary/90"
              >
                Start Free
              </Link>
            </div>
          </div>

          {/* INDIVIDUAL — Recommended */}
          <div className="relative rounded-2xl border-2 border-[#534AB7] bg-[#534AB7]/5 shadow-2xl scale-105">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#534AB7] text-white rounded-full text-sm font-bold shadow-lg">
              Recommended
            </div>
            <div className="p-6 md:p-8">
              <div className="text-center mb-6">
                <h3 className="font-headline font-bold text-2xl text-secondary mb-1">Individual Plan</h3>
                <p className="font-accent text-base text-primary mb-4">व्यक्तिगत योजना</p>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="font-headline font-bold text-5xl text-secondary">{individualPrice}</span>
                  <span className="font-body text-base text-muted-foreground">/month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-muted-foreground mb-1">{individualBilledNote}</p>
                )}
                {individualSave && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#1D9E75]/10 text-[#1D9E75] rounded-full text-sm font-semibold">
                    <Icon name="CheckCircleIcon" size={14} variant="solid" />
                    {individualSave}
                  </div>
                )}
                <p className="font-body text-sm text-muted-foreground mt-2">Perfect for one student</p>
              </div>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-lg font-cta font-semibold transition-all duration-250 min-h-[44px] flex items-center justify-center bg-[#534AB7] text-white hover:bg-[#4239a0] shadow-lg"
              >
                Get Started
              </Link>
            </div>
          </div>

          {/* FAMILY — Best Value */}
          <div className="relative rounded-2xl border-2 border-border bg-background hover:border-primary/30 transition-colors">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#1D9E75] text-white rounded-full text-sm font-bold shadow-lg whitespace-nowrap">
              Best Value
            </div>
            <div className="p-6 md:p-8">
              <div className="text-center mb-6">
                <h3 className="font-headline font-bold text-2xl text-secondary mb-1">Family Plan</h3>
                <p className="font-accent text-base text-primary mb-1">परिवार योजना</p>
                <p className="text-xs text-[#1D9E75] font-semibold mb-3">Save 25% on 2nd &amp; 3rd child</p>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="font-headline font-bold text-5xl text-secondary">{familyPrice}</span>
                  <span className="font-body text-base text-muted-foreground">/month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-muted-foreground mb-1">{familyBilledNote}</p>
                )}
                {familySave && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#1D9E75]/10 text-[#1D9E75] rounded-full text-sm font-semibold">
                    <Icon name="CheckCircleIcon" size={14} variant="solid" />
                    {familySave}
                  </div>
                )}
                <p className="font-body text-sm text-muted-foreground mt-2">Best value for multiple children</p>
              </div>
              <Link
                href="/auth/signup"
                className="w-full py-3 rounded-lg font-cta font-semibold transition-all duration-250 min-h-[44px] flex items-center justify-center bg-secondary text-white hover:bg-secondary/90"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="bg-white rounded-2xl border border-border overflow-x-auto shadow-sm mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-headline font-bold text-secondary px-4 py-4 w-1/2 md:w-2/5">Feature</th>
                <th className="text-center font-headline font-bold text-secondary px-3 py-4 w-1/6">Free</th>
                <th className="text-center font-headline font-bold text-[#534AB7] px-3 py-4 w-1/6 bg-[#534AB7]/5">
                  Individual
                </th>
                <th className="text-center font-headline font-bold text-[#1D9E75] px-3 py-4 w-1/6">Family</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, idx) => (
                <tr
                  key={row.label}
                  className={`border-b border-border last:border-0 ${
                    row.highlight ? 'bg-[#EEEDFE]/30' : idx % 2 === 0 ? '' : 'bg-muted/20'
                  }`}
                >
                  <td className="px-4 py-3 font-body text-sm text-foreground">{row.label}</td>
                  <td className="px-3 py-3 text-center">
                    <FeatureCell value={row.free} />
                  </td>
                  <td className="px-3 py-3 text-center bg-[#534AB7]/5">
                    <FeatureCell value={row.individual} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <FeatureCell value={row.family} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trust signals — LP-6.1 spec */}
        <div className="text-center mb-10 space-y-1">
          <p className="text-sm text-muted-foreground">
            🔒 Secure checkout &middot; UPI / Cards / Net Banking &middot; 7-day refund policy &middot; No auto-renewal without reminder
          </p>
          <p className="text-xs text-muted-foreground">All prices inclusive of taxes &middot; Powered by Razorpay</p>
        </div>

        {/* Tuition comparison */}
        <div className="bg-background rounded-2xl border-2 border-border p-6 md:p-8 mb-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-secondary mb-4">
                Compare with Traditional Tuition
              </h3>
              <p className="font-body text-base text-muted-foreground mb-6">
                See how much you can save while getting better results
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-error/5 rounded-lg border border-error/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">Traditional Tuition</p>
                    <p className="font-body text-sm text-muted-foreground">Per month, per child</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-error">₹3,000-5,000</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">Spinzy Academy Individual</p>
                    <p className="font-body text-sm text-muted-foreground">Per month, unlimited access (incl. taxes)</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-success">₹{standardPlan.billedRupees}</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">Your Savings</p>
                    <p className="font-body text-sm text-muted-foreground">Every single month</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-primary">₹{savingsMin}+</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3">
                  <Icon name="ShieldCheckIcon" size={24} variant="solid" className="text-success" />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">7-Day Refund Policy</h4>
                    <p className="font-body text-sm text-muted-foreground">Refunds available within 7 days of purchase.</p>
                  </div>
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3">
                  <Icon name="CheckCircleIcon" size={24} variant="solid" className="text-success" />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">Cancel Anytime</h4>
                    <p className="font-body text-sm text-muted-foreground">No long-term commitment. Stop subscription whenever you want.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="font-body text-base text-muted-foreground">
            Still have questions?{' '}
            <a href="#faq" className="text-primary hover:underline font-semibold">
              Check our FAQ
            </a>{' '}
            or{' '}
            <a href="tel:+918920754675" className="text-primary hover:underline font-semibold">
              call us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

interface PricingPlan {
  id: string;
  name: string;
  nameHi: string;
  price: string;
  period: string;
  periodHi: string;
  description: string;
  descriptionHi: string;
  features: string[];
  featuresHi: string[];
  recommended: boolean;
  savings?: string;
  ctaText: string;
  ctaTextHi: string;
}

const PricingSection = () => {

  const plans: PricingPlan[] = [
        {
      id: 'free',
      name: 'Free Plan',
      nameHi: 'मुफ्त योजना',
      price: '₹0',
      period: 'Forever',
      periodHi: 'हमेशा के लिए',
      description: 'Try AI Tutor with limited features',
      descriptionHi: 'सीमित सुविधाओं के साथ AI Tutor आज़माएं',
      features: [
        '5 questions per day',
        'Basic explanations',
        'Hindi + English support',
        'NCERT notes access',
      ],
      featuresHi: [
        'प्रतिदिन 5 सवाल',
        'बुनियादी समाधान',
        'हिंदी + अंग्रेजी सहायता',
        'NCERT नोट्स एक्सेस',
      ],
      recommended: false,
      ctaText: 'Start Free',
      ctaTextHi: 'मुफ्त शुरू करें',
    },
    {
      id: 'individual',
      name: 'Individual Plan',
      nameHi: 'व्यक्तिगत योजना',
      price: `₹${PLANS.standard_monthly.billedRupees}`,
      period: 'per month',
      periodHi: 'प्रति माह',
      description: 'Perfect for one student',
      descriptionHi: 'एक छात्र के लिए बिल्कुल सही',
      features: [
        'Unlimited questions',
        'Detailed step-by-step solutions',
        'Voice explanations',
        'Practice tests & worksheets',
        'Doubt solving in 30 seconds',
        'All subjects (Class 1-12)',
        'Priority support',
        'Progress tracking',
      ],
      featuresHi: [
        'असीमित सवाल',
        'विस्तृत स्टेप-बाय-स्टेप समाधान',
        'आवाज में समझाना',
        'अभ्यास टेस्ट और वर्कशीट',
        '30 सेकंड में doubt solving',
        'सभी विषय (कक्षा 1-12)',
        'प्राथमिकता सहायता',
        'प्रगति ट्रैकिंग',
      ],
      recommended: true,
      savings: 'Save ₹2900 vs tuition',
      ctaText: 'Get started',
      ctaTextHi: 'शुरू करें',
    },
    {
      id: 'family',
      name: 'Family Plan',
      nameHi: 'परिवार योजना',
      price: `₹${PLANS.family_monthly.billedRupees}`,
      period: 'per month',
      periodHi: 'प्रति माह',
      description: 'Best value for multiple children',
      descriptionHi: 'कई बच्चों के लिए सर्वोत्तम मूल्य',
      features: [
        'Everything in Individual Plan',
        'Up to 3 children',
        'Separate progress tracking',
        'Family dashboard',
        'Parental controls',
        'Monthly progress reports',
        'Priority WhatsApp support',
        'Early access to new features',
      ],
      featuresHi: [
        'Individual Plan की सभी सुविधाएं',
        '3 बच्चों तक',
        'अलग प्रगति ट्रैकिंग',
        'परिवार डैशबोर्ड',
        'माता-पिता नियंत्रण',
        'मासिक प्रगति रिपोर्ट',
        'प्राथमिकता WhatsApp सहायता',
        'नई सुविधाओं तक पहली पहुंच',
      ],
      recommended: false,
      savings: 'Save ₹5000+ vs multiple tutors',
      ctaText: 'Get started',
      ctaTextHi: 'शुरू करें',
    },
  ];

  const standardPlan = PLANS.standard_monthly;
  const spinzyPriceDisplay = `₹${standardPlan.billedRupees}`;
  const traditionalMin = 3000;
  const savingsMin = traditionalMin - standardPlan.billedRupees;
  const savingsText = `₹${savingsMin}+`;

  return (
    <section
      id="pricing"
      className="py-12 md:py-16 bg-gradient-to-br from-secondary/5 to-primary/5"
    >
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            <Icon name="CurrencyRupeeIcon" size={20} variant="solid" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Choose Your Perfect Plan
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">अपनी सही योजना चुनें</p>
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            No hidden charges. Cancel anytime. 7-day refund policy.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-6">
          {plans.map((plan) => {
            const displayPrice = plan.price;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 transition-all duration-250 ${
                  plan.recommended
                    ? 'border-primary bg-primary/5 shadow-2xl scale-105'
                    : 'border-border bg-background hover:border-primary/30'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white rounded-full text-sm font-bold shadow-lg">
                    Recommended
                  </div>
                )}

                <div className="p-6 md:p-8">
                  <div className="text-center mb-6">
                    <h3 className="font-headline font-bold text-2xl text-secondary mb-1">
                      {plan.name}
                    </h3>
                    <p className="font-accent text-base text-primary mb-4">{plan.nameHi}</p>
                    <div className="flex items-baseline justify-center gap-2 mb-2">
                      <span className="font-headline font-bold text-5xl text-secondary">
                        {displayPrice}
                      </span>
                      <span className="font-body text-base text-muted-foreground">/{plan.period}</span>
                    </div>
                    {/* Prices shown are inclusive of taxes */}
                    <p className="font-body text-sm text-muted-foreground">{plan.description}</p>
                    {plan.savings && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-full text-sm font-semibold">
                        <Icon name="CheckCircleIcon" size={16} variant="solid" />
                        <span>{plan.savings}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Icon
                          name="CheckCircleIcon"
                          size={20}
                          variant="solid"
                          className={plan.recommended ? 'text-primary' : 'text-success'}
                        />
                        <span className="font-body text-sm text-foreground flex-1">{feature}</span>
                      </div>
                    ))}

                  </div>

                  <Link
                    href="/auth/signup"
                    className={`w-full py-3 rounded-lg font-cta font-semibold transition-all duration-250 min-h-[44px] flex items-center justify-center ${
                      plan.recommended
                        ? 'bg-[#534AB7] text-white hover:bg-[#4239a0] shadow-lg'
                        : 'bg-secondary text-white hover:bg-secondary/90'
                    }`}
                  >
                    {plan.ctaText}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment trust badges */}
        <div className="text-center mb-10">
          <p className="text-sm text-muted-foreground">
            🔒 Secure checkout · UPI / Cards / Net Banking · Powered by Razorpay
          </p>
          <p className="text-xs text-muted-foreground mt-1">All prices inclusive of taxes</p>
        </div>

        <div className="bg-background rounded-2xl border-2 border-border p-6 md:p-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-secondary mb-4">
                Compare with Traditional Tuition
              </h3>
              <p className="font-body text-base text-muted-foreground mb-6">
                See how much you can save while getting better results
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-error/5 rounded-lg border border-error/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">
                      Traditional Tuition
                    </p>
                    <p className="font-body text-sm text-muted-foreground">Per month, per child</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-error">₹3000-5000</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">
                      Spinzy Academy Individual
                    </p>
                    <p className="font-body text-sm text-muted-foreground">
                      Per month, unlimited access (incl. taxes)
                    </p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-success">{spinzyPriceDisplay}</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-headline font-bold text-lg text-secondary">Your Savings</p>
                    <p className="font-body text-sm text-muted-foreground">Every single month</p>
                  </div>
                  <p className="font-headline font-bold text-2xl text-primary">{savingsText}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon name="ShieldCheckIcon" size={24} variant="solid" className="text-success" />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">
                      7-Day Refund Policy
                    </h4>
                    <p className="font-body text-sm text-muted-foreground">
                      Refunds available within 7 days of purchase.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon name="CheckCircleIcon" size={24} variant="solid" className="text-success" />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">
                      Cancel Anytime
                    </h4>
                    <p className="font-body text-sm text-muted-foreground">
                      No long-term commitment. Stop subscription whenever you want
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon
                    name="ShieldCheckIcon"
                    size={24}
                    variant="solid"
                    className="text-secondary"
                  />
                  <div>
                    <h4 className="font-headline font-bold text-lg text-secondary mb-1">
                      Secure Payments
                    </h4>
                    <p className="font-body text-sm text-muted-foreground">
                      Secure checkout · UPI / Cards / Net Banking · Powered by Razorpay
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="font-body text-base text-muted-foreground mb-6">
            Still have questions about pricing?{' '}
            <a href="#faq" className="text-primary hover:underline font-semibold">
              Check our FAQ
            </a>{' '}
            or{' '}
            <a href="tel:+918920754675" className="text-primary hover:underline font-semibold">
              call us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
