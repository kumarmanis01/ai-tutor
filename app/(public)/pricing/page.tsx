"use client";

/**
 * FILE OBJECTIVE:
 * - Public pricing page showing available subscription tiers (Standard, Family, Lite).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/pricing.page.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | update copy to reflect family childSlots and remove inline styles to satisfy lint
 */

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useSession, signIn } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { PLANS } from '@/lib/billing/plans';
import type { PlanId } from '@/lib/billing/plans';
import PricingCard from '@/components/PricingCard';
import { trackPurchase, trackSubscriptionStart } from '@/components/GoogleTagManager';

const ENABLE_LITE_PLAN = process.env.NEXT_PUBLIC_ENABLE_LITE_PLAN === 'true';

type RazorpaySubResponse = {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type BillingCycle = 'monthly' | 'annual';

function getPlanId(tier: 'standard' | 'family' | 'lite', cycle: BillingCycle): PlanId {
  if (tier === 'lite') return 'lite_monthly';
  return `${tier}_${cycle}` as PlanId;
}

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

  async function handleSubscribe(planId: PlanId) {
    if (!session) {
      signIn(undefined, { callbackUrl: '/pricing' });
      return;
    }

    const plan = PLANS[planId];
    setLoadingPlan(planId);

    try {
      trackSubscriptionStart(planId, plan.billedRupees);

      // Step 1 -- create Razorpay subscription server-side
      const createRes = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.subscriptionId) {
        logger.warn('pricing: create-subscription failed', { status: createRes.status, body: createData });
        toast("Couldn't start checkout -- please try again.");
        return;
      }

      // Step 2 -- open Razorpay checkout with subscription_id
      const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '';
      await new Promise<void>((resolve, reject) => {
        const options = {
          key: rzpKey,
          subscription_id: createData.subscriptionId,
          name: 'Spinzy Academy',
          description: `${plan.label} -- ${plan.perMonthDisplay}`,
          prefill: {
            name: createData.name ?? session.user?.name ?? '',
            email: createData.email ?? session.user?.email ?? '',
          },
          theme: { color: '#534AB7' }, // brand primary
          handler: async (response: RazorpaySubResponse) => {
            try {
              // Step 3 -- verify payment server-side
              const verifyRes = await fetch('/api/payments/verify-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  planId,
                }),
              });

              if (verifyRes.ok) {
                trackPurchase({
                  transactionId: response.razorpay_payment_id,
                  value: plan.billedRupees,
                  currency: 'INR',
                  items: [{ id: planId, name: plan.label, price: plan.billedRupees, quantity: 1 }],
                });
                toast('Subscription activated! Welcome to Spinzy.');
                window.location.href = '/';
              } else {
                const errData = await verifyRes.json().catch(() => ({}));
                logger.warn('pricing: verify-subscription failed', { status: verifyRes.status, body: errData });
                toast("Payment received but couldn't activate -- contact support.");
              }
            } catch (err) {
              logger.error('pricing: verify-subscription threw', { error: String(err) });
              toast("Something went wrong -- please contact support.");
            } finally {
              resolve();
            }
          },
          modal: {
            ondismiss: () => resolve(),
          },
        };

        try {
          const rzp = new (
            window as unknown as { Razorpay: new (o: typeof options) => { open: () => void } }
          ).Razorpay(options);
          rzp.open();
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      logger.error('pricing: subscription flow threw', { error: String(err) });
      toast("Subscription failed -- please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  const standardPlan = billingCycle === 'annual' ? PLANS.standard_annual : PLANS.standard_monthly;
  const familyPlan = billingCycle === 'annual' ? PLANS.family_annual : PLANS.family_monthly;

  const standardPlanId = getPlanId('standard', billingCycle);
  const familyPlanId = getPlanId('family', billingCycle);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 bg-white dark:bg-gray-950 transition-colors">
      {/* Title */}
      <h1 className="text-3xl font-bold text-center mb-2" style={{ color: '#534AB7' }}>
        Simple, transparent pricing
      </h1>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
        AI-powered tutoring for CBSE/ICSE students (Grades 6-12). Cancel anytime.
      </p>

      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-3 mb-10">
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={`min-h-[44px] px-4 py-1 rounded-full text-sm font-medium transition ${
            billingCycle === 'monthly'
              ? 'text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          style={billingCycle === 'monthly' ? { backgroundColor: '#534AB7' } : {}}
        >
          Monthly
        </button>

        <label className="inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={billingCycle === 'annual'}
            onChange={() => setBillingCycle(c => c === 'monthly' ? 'annual' : 'monthly')}
          />
          <div className="relative w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-[#534AB7] transition-colors">
            <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform peer-checked:translate-x-6" />
          </div>
        </label>

        <button
          type="button"
          onClick={() => setBillingCycle('annual')}
          className={`min-h-[44px] px-4 py-1 rounded-full text-sm font-medium transition ${
            billingCycle === 'annual'
              ? 'text-white'
              : 'text-gray-700 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          style={billingCycle === 'annual' ? { backgroundColor: '#534AB7' } : {}}
        >
          Annual
          <span className="ml-2 text-xs bg-[#EAF3DE] text-[#1D9E75] px-2 py-0.5 rounded font-semibold">
            2 months free
          </span>
        </button>
      </div>

      {/* Plan Cards */}
      <div className={`grid gap-6 ${ENABLE_LITE_PLAN ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto'}`}>

        {/* Lite -- only when ENABLE_LITE_PLAN=true */}
        {ENABLE_LITE_PLAN && (
          <PricingCard
            planKey="lite"
            title="Lite"
            priceMonthly={PLANS.lite_monthly.billedRupees}
            features={[
              '10 questions/day',
              'AI text answers',
              'CBSE/ICSE Grades 6-12',
              '1 child account',
            ]}
            billing={billingCycle}
            cta={
              <button
                type="button"
                className="min-h-[44px] w-full py-2 rounded-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#534AB7' }}
                onClick={() => handleSubscribe('lite_monthly')}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === 'lite_monthly' ? 'Processing...' : 'Get Lite'}
              </button>
            }
          />
        )}

        {/* Standard -- featured / primary */}
        <PricingCard
          planKey="pro"
          title="Standard"
          priceMonthly={PLANS.standard_monthly.billedRupees}
          priceAnnual={PLANS.standard_annual.billedRupees}
          features={[
            'Unlimited questions',
            'Detailed AI explanations',
            'CBSE/ICSE Grades 6-12',
            'Progress tracking',
            'Priority processing',
          ]}
          selected={true}
          billing={billingCycle}
          cta={
            <button
              type="button"
              className="min-h-[44px] w-full py-2 rounded-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#534AB7' }}
              onClick={() => handleSubscribe(standardPlanId)}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === standardPlanId
                ? 'Processing...'
                : session
                ? 'Subscribe Now'
                : 'Start Now'}
            </button>
          }
        />

        {/* Family */}
        <PricingCard
          planKey="family"
          title="Family"
          priceMonthly={PLANS.family_monthly.billedRupees}
          priceAnnual={PLANS.family_annual.billedRupees}
          features={[
            'Everything in Standard',
            '2 child accounts',
            'Family progress dashboard',
            'CBSE/ICSE Grades 6-12',
            'Priority processing',
          ]}
          billing={billingCycle}
          cta={
            <button
              type="button"
              className="min-h-[44px] w-full py-2 rounded-lg font-semibold transition hover:opacity-90 disabled:opacity-60 border"
              style={{ borderColor: '#534AB7', color: '#534AB7' }}
              onClick={() => handleSubscribe(familyPlanId)}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === familyPlanId
                ? 'Processing...'
                : session
                ? 'Subscribe Now'
                : 'Start Now'}
            </button>
          }
        />
      </div>

      {/* Annual display label */}
      {billingCycle === 'annual' && (
        <div className="mt-4 text-center text-sm text-[#1D9E75]">
          Billed as {standardPlan.billedDisplay} and {familyPlan.billedDisplay} respectively.
        </div>
      )}

      <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        Inclusive of all taxes. No hidden charges. Secure payments via Razorpay.
      </p>
    </div>
  );
}
