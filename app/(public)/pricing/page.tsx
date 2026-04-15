'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useSession, signIn } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { BILLING_PLAN_PRO } from '@/app/api/billing/constants';
import { PLANS } from '@/lib/billing/plans';
import PricingCard from '@/components/PricingCard';
import { getBillingPayload } from '@/app/api/billing/utility';
import { trackPurchase, trackSubscriptionStart } from '@/components/GoogleTagManager';

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: unknown) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
};

type RazorpayResponse = {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const ENABLE_LITE_PLAN = process.env.NEXT_PUBLIC_ENABLE_LITE_PLAN === 'true';

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  const standardPlan = billingCycle === 'annual' ? PLANS.standard_annual : PLANS.standard_monthly;
  const proPrice = standardPlan.billedRupees;

  const handleSubscribe = async () => {
    logger.add('Subscribe button clicked.', {
      className: 'PricingPage',
      methodName: 'handleSubscribe',
    });
    if (!session) {
      logger.add('No session found. Redirecting to sign in.', {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
      signIn(undefined, { callbackUrl: '/pricing' });
      return;
    }
    try {
      setLoading(true);

      trackSubscriptionStart(`${BILLING_PLAN_PRO}_${billingCycle}`, proPrice);

      logger.add(
        `Sending request to /api/billing/checkout with plan: ${BILLING_PLAN_PRO}, billingCycle: ${billingCycle}`,
        { className: 'PricingPage', methodName: 'handleSubscribe' },
      );

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          getBillingPayload({ plan: BILLING_PLAN_PRO, billingCycle }, billingCycle, proPrice),
        ),
      });

      const data = await res.json();
      logger.add(`Response JSON: ${JSON.stringify(data)}`, {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });

      if (!data.subscriptionId) {
        throw new Error('Failed to create subscription');
      }

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        subscription_id: data.subscriptionId,
        name: 'Spinzy Academy',
        description: `Standard Plan (${billingCycle})`,
        handler: async function (response: unknown) {
          const respObj = response as RazorpayResponse;
          logger.add('Sending verification request to /api/billing/verify...', {
            className: 'PricingPage',
            methodName: 'RazorpayHandler',
          });
          const verifyRes = await fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getBillingPayload(respObj, billingCycle, proPrice)),
          });
          const verifyData = await verifyRes.json();
          logger.add(`Verification response JSON: ${JSON.stringify(verifyData)}`, {
            className: 'PricingPage',
            methodName: 'RazorpayHandler',
          });
          if (verifyRes.ok) {
            trackPurchase({
              transactionId: respObj.razorpay_payment_id,
              value: proPrice,
              currency: 'INR',
              items: [{
                id: `standard_${billingCycle}`,
                name: `Standard Plan (${billingCycle})`,
                price: proPrice,
                quantity: 1,
              }],
            });
            toast('Subscription activated! Welcome to Spinzy.');
            logger.add('Subscription successful. Redirecting to home.', {
              className: 'PricingPage',
              methodName: 'RazorpayHandler',
            });
            window.location.href = '/';
          } else {
            toast("Couldn't verify payment -- please contact support.");
            logger.add('Subscription verification failed.', {
              className: 'PricingPage',
              methodName: 'RazorpayHandler',
            });
          }
        },
        prefill: {
          name: session.user?.name ?? 'User',
          email: data.email ?? session.user?.email ?? '',
        },
        theme: { color: '#534AB7' }, // brand primary -- CLAUDE.md
      };

      try {
        const rzp = new (
          window as unknown as { Razorpay: new (options: RazorpayOptions) => { open: () => void } }
        ).Razorpay(options);
        rzp.open();
        logger.add('Razorpay checkout opened.', {
          className: 'PricingPage',
          methodName: 'handleSubscribe',
        });
      } catch (err) {
        logger.add('Error opening Razorpay checkout: ' + (err as Error).message, {
          className: 'PricingPage',
          methodName: 'handleSubscribe',
        });
        throw err;
      }
    } catch (err) {
      logger.add('Error in subscription flow: ' + (err as Error).message, {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
      toast("Subscription failed -- please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 bg-white dark:bg-gray-950 transition-colors">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-center mb-2" style={{ color: '#534AB7' }}>
        Choose the Plan That Fits Your Learning Journey
      </h1>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
        Start for free. Upgrade anytime for unlimited AI-powered tutoring.
      </p>

      {/* Billing Toggle */}
      <div className="flex justify-center items-center mb-10 gap-4">
        <button
          type="button"
          className={`min-h-[44px] px-3 py-1 rounded-full ${
            billingCycle === 'monthly'
              ? 'font-bold text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          style={billingCycle === 'monthly' ? { backgroundColor: '#534AB7' } : {}}
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </button>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={billingCycle === 'annual'}
            onChange={() =>
              setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')
            }
          />
          <div className="relative w-14 h-8 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:bg-[#534AB7] transition">
            <div className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-gray-900 rounded-full transition-transform peer-checked:translate-x-6" />
          </div>
        </label>
        <button
          type="button"
          className={`min-h-[44px] px-3 py-1 rounded-full ${
            billingCycle === 'annual'
              ? 'font-bold text-white'
              : 'text-gray-700 dark:text-gray-400'
          }`}
          style={billingCycle === 'annual' ? { backgroundColor: '#534AB7' } : {}}
          onClick={() => setBillingCycle('annual')}
        >
          Yearly{' '}
          <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-100 px-2 py-0.5 rounded">
            Save 2 months
          </span>
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Lite plan -- hidden unless ENABLE_LITE_PLAN=true */}
        {ENABLE_LITE_PLAN && (
          <PricingCard
            planKey="lite"
            title="Lite"
            priceMonthly={PLANS.lite_monthly.billedRupees}
            features={[
              '10 questions/day',
              'AI-powered text answers',
              'Multi-subject support',
              'CBSE/ICSE Grades 6-12',
            ]}
            billing={billingCycle}
            cta={
              <button
                type="button"
                className="min-h-[44px] w-full py-2 rounded-lg font-semibold text-white hover:opacity-90 transition"
                style={{ backgroundColor: '#534AB7' }}
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Get Lite'}
              </button>
            }
          />
        )}

        {/* Standard -- primary / featured */}
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
              className="min-h-[44px] w-full py-2 rounded-lg font-semibold text-white hover:opacity-90 transition"
              style={{ backgroundColor: '#534AB7' }}
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>
          }
        />

        {/* Enterprise */}
        <PricingCard
          planKey="enterprise"
          title="School / Enterprise"
          features={[
            'Unlimited access for students',
            'Admin Dashboard',
            'Custom branding',
            'Progress reports',
            'API integration',
          ]}
          billing={billingCycle}
          cta={
            <a
              href="/contact?plan=enterprise"
              className="min-h-[44px] w-full block py-2 rounded-lg font-semibold text-white hover:opacity-90 transition text-center"
              style={{ backgroundColor: '#1D9E75' }}
            >
              Contact Us
            </a>
          }
        />
      </div>

      <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
        Inclusive of all taxes. No hidden charges.
      </p>

      {/* Section Footer */}
      <div className="mt-6 text-center text-gray-500 dark:text-gray-400 text-sm">
        Upgrade anytime. Cancel anytime. Secure payments powered by Razorpay.
      </div>
    </div>
  );
}
