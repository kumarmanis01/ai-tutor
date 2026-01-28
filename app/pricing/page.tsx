'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useSession, signIn } from 'next-auth/react';
import { logger } from '@/lib/logger';
import {
  BILLING_MONTHLY,
  BILLING_ANNUAL,
  BILLING_PLAN_PRO,
  PRICES,
} from '@/app/api/billing/constants';
import PricingCard from '@/components/PricingCard';
import { getBillingPayload } from '../api/billing/utility';
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

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(BILLING_MONTHLY);
  const [loading, setLoading] = useState(false);

  const proPrice =
    billingCycle === BILLING_MONTHLY ? PRICES[BILLING_MONTHLY] : PRICES[BILLING_ANNUAL];

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

      // Track subscription start for GTM conversion funnel
      trackSubscriptionStart(`${BILLING_PLAN_PRO}_${billingCycle}`, proPrice);

      logger.add(
        `Sending request to /api/billing/checkout with plan: ${BILLING_PLAN_PRO}, billingCycle: ${billingCycle}`,
        { className: 'PricingPage', methodName: 'handleSubscribe' },
      );
      logger.add(
        `UI sending options: ${JSON.stringify({ plan: BILLING_PLAN_PRO, billingCycle })}`,
        { className: 'PricingPage', methodName: 'handleSubscribe' },
      );

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          getBillingPayload({ plan: BILLING_PLAN_PRO, billingCycle }, billingCycle, proPrice),
        ),
      });

      logger.add(`Received response from /api/billing/checkout. Status: ${res.status}`, {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
      const data = await res.json();
      logger.add(`Response JSON: ${JSON.stringify(data)}`, {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });

      if (!data.subscriptionId) {
        logger.add('No subscriptionId in response. Throwing error.', {
          className: 'PricingPage',
          methodName: 'handleSubscribe',
        });
        throw new Error('Failed to create subscription');
      }

      logger.add('Preparing Razorpay options...', {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        subscription_id: data.subscriptionId,
        name: 'Spinzy Academy',
        description: `${BILLING_PLAN_PRO} Subscription (${billingCycle})`,
        handler: async function (response: unknown) {
          logger.add('Razorpay handler called. Response: ' + JSON.stringify(response), {
            className: 'PricingPage',
            methodName: 'RazorpayHandler',
          });
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
          logger.add(`Verification response status: ${verifyRes.status}`, {
            className: 'PricingPage',
            methodName: 'RazorpayHandler',
          });
          const verifyData = await verifyRes.json();
          logger.add(`Verification response JSON: ${JSON.stringify(verifyData)}`, {
            className: 'PricingPage',
            methodName: 'RazorpayHandler',
          });
          if (verifyRes.ok) {
            // Track successful purchase conversion for GTM
            trackPurchase({
              transactionId: respObj.razorpay_payment_id,
              value: proPrice,
              currency: 'INR',
              items: [{
                id: `${BILLING_PLAN_PRO}_${billingCycle}`,
                name: `${BILLING_PLAN_PRO} Plan (${billingCycle})`,
                price: proPrice,
                quantity: 1,
              }],
            });
            
            toast('✅ Subscription successful!');
            logger.add('Subscription successful. Redirecting to home.', {
              className: 'PricingPage',
              methodName: 'RazorpayHandler',
            });
            window.location.href = '/';
          } else {
            toast('❌ Subscription verification failed');
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
        theme: { color: '#2563eb' },
      };

      logger.add('Opening Razorpay checkout...', {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
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
      toast('❌ Subscription failed');
    } finally {
      setLoading(false);
      logger.add('Subscription flow ended.', {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 bg-white dark:bg-gray-950 transition-colors">
      {/* Section Title & Subtitle */}
      <h1 className="text-3xl font-bold text-center mb-2 text-blue-700 dark:text-yellow-300">
        Choose the Plan That Fits Your Learning Journey
      </h1>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
        Start for free. Upgrade anytime for unlimited AI-powered tutoring.
      </p>

      {/* Billing Toggle */}
      <div className="flex justify-center items-center mb-10 gap-4">
        <span
          className={`cursor-pointer px-3 py-1 rounded-full ${
            billingCycle === BILLING_MONTHLY
              ? 'bg-blue-600 text-white font-bold'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          onClick={() => setBillingCycle(BILLING_MONTHLY)}
        >
          Monthly
        </span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={billingCycle === BILLING_ANNUAL}
            onChange={() =>
              setBillingCycle(billingCycle === BILLING_MONTHLY ? BILLING_ANNUAL : BILLING_MONTHLY)
            }
          />
          <div className="relative w-14 h-8 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:bg-blue-600 transition">
            <div className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-gray-900 rounded-full transition-transform peer-checked:translate-x-6"></div>
          </div>
        </label>
        <span
          className={`cursor-pointer px-3 py-1 rounded-full ${
            billingCycle === BILLING_ANNUAL
              ? 'bg-blue-600 text-white font-bold'
              : 'text-gray-700 dark:text-gray-400'
          }`}
          onClick={() => setBillingCycle(BILLING_ANNUAL)}
        >
          Yearly{' '}
          <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-100 px-2 py-0.5 rounded">
            Save 2 months
          </span>
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <PricingCard
          planKey="free"
          title="Free"
          priceMonthly={0}
          priceAnnual={0}
          features={[
            '3 questions/day',
            'AI-powered text answers',
            'Multi-subject support',
            'No export or priority',
          ]}
          compact={false}
          billing={billingCycle}
          cta={
            <button
              className={`w-full py-2 rounded-lg bg-gray-400 dark:bg-gray-700 text-white font-semibold cursor-not-allowed`}
              disabled
            >
              {session ? 'Current Plan' : 'Get Started'}
            </button>
          }
        />

        <PricingCard
          planKey="pro"
          title="Pro"
          priceMonthly={PRICES[BILLING_MONTHLY]}
          priceAnnual={PRICES[BILLING_ANNUAL]}
          features={[
            'Ask Unlimited questions',
            'Detailed AI explanations',
            'Group Study',
            'Export to PDF',
            'Priority processing',
          ]}
          selected={true}
          billing={billingCycle}
          cta={
            <button
              className="w-full py-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-800 transition"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>
          }
        />

        <PricingCard
          planKey="enterprise"
          title="Enterprise"
          features={[
            'Unlimited access for teams',
            'Admin Dashboard',
            'Custom branding',
            'Progress reports',
            'API integration',
          ]}
          billing={billingCycle}
          cta={
            <a
              href="/contact?plan=enterprise"
              className="w-full block py-2 rounded-lg bg-green-600 dark:bg-green-700 text-white font-semibold hover:bg-green-700 dark:hover:bg-green-800 transition text-center"
            >
              Contact Us
            </a>
          }
        />
      </div>

      {/* Section Footer */}
      <div className="mt-10 text-center text-gray-500 dark:text-gray-400 text-sm">
        Upgrade anytime. Cancel anytime. Secure payments powered by Razorpay.
      </div>
    </div>
  );
}
