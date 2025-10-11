'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { logger } from '@/lib/logger';
import {
  BILLING_MONTHLY,
  BILLING_ANNUAL,
  BILLING_PLAN_PRO,
  PRICES,
} from '@/app/api/billing/constants';
import { getBillingPayload } from '../api/billing/utility';

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
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    // Subscribe to logger updates
    const unsubscribe = logger.subscribe((entry) => {
      setLog((prev) => [...prev, entry]);
    });
    return unsubscribe;
  }, []);

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
            alert('✅ Subscription successful!');
            logger.add('Subscription successful. Redirecting to home.', {
              className: 'PricingPage',
              methodName: 'RazorpayHandler',
            });
            window.location.href = '/';
          } else {
            alert('❌ Subscription verification failed');
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
      alert('❌ Subscription failed');
    } finally {
      setLoading(false);
      logger.add('Subscription flow ended.', {
        className: 'PricingPage',
        methodName: 'handleSubscribe',
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold text-center mb-4 text-blue-700 dark:text-yellow-300">
        Pricing Plans
      </h1>

      {/* Toggle */}
      <div className="flex justify-center items-center mb-10 gap-4">
        <span
          className={`cursor-pointer ${billingCycle === BILLING_MONTHLY ? 'font-bold' : 'text-gray-500'}`}
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
          <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600">
            <div className="absolute top-0.5 left-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </div>
        </label>
        <span
          className={`cursor-pointer ${billingCycle === BILLING_ANNUAL ? 'font-bold' : 'text-gray-500'}`}
          onClick={() => setBillingCycle(BILLING_ANNUAL)}
        >
          Annual
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Free */}
        <div className="border rounded-xl shadow p-6 text-center">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="mt-4 text-4xl font-bold">₹0</p>
          <p className="text-gray-500">3 questions per day</p>
          <button
            className="mt-6 px-6 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
            disabled
          >
            Current
          </button>
        </div>

        {/* Pro */}
        <div className="border rounded-xl shadow p-6 text-center bg-blue-150">
          <h2 className="text-xl font-semibold">Pro</h2>
          <p className="mt-4 text-4xl font-bold">₹{proPrice}</p>
          <p className="text-gray-500">
            {billingCycle === BILLING_MONTHLY ? 'per month' : 'per year'}
          </p>
          <p className="mt-2">Unlimited questions</p>
          <button
            onClick={() => handleSubscribe()}
            disabled={loading}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Subscribe'}
          </button>
        </div>

        {/* Enterprise */}
        <div className="border rounded-xl shadow p-6 text-center">
          <h2 className="text-xl font-semibold">Enterprise</h2>
          <p className="mt-4 text-4xl font-bold">Custom</p>
          <p className="text-gray-500">Tailored plans for schools</p>
          <button className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Contact Us
          </button>
        </div>
      </div>

      {/* Debug Log Output */}
      {/* <div className="mt-10 bg-gray-50 dark:bg-gray-800 rounded p-4 text-xs max-h-64 overflow-auto">
        <h2 className="font-bold mb-2 text-blue-700 dark:text-yellow-300">Debug Log</h2>
        <ul>
          {log.map((entry, idx) => (
            <li key={idx}>{entry}</li>
          ))}
        </ul>
      </div> */}
    </div>
  );
}
