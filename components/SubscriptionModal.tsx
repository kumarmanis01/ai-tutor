'use client';

import React, { useState } from 'react';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { signIn, useSession } from 'next-auth/react';
import useCurrentUser from '@/hooks/useCurrentUser';
import PricingCard from '@/components/PricingCard';
import { PRICES, BILLING_MONTHLY, BILLING_ANNUAL } from '@/app/api/billing/constants';
import { getBillingPayload } from '@/app/api/billing/utility';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SubscriptionModal({ open, onClose }: Props) {
  const { data: session } = useSession();
  // Prefer canonical user info when available
  const { data: profile } = useCurrentUser();
  const [plan, setPlan] = useState<'pro' | 'enterprise'>('pro');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  const proPrice = billing === 'monthly' ? PRICES[BILLING_MONTHLY] : PRICES[BILLING_ANNUAL];

  async function handleSubscribe() {
    if (!session) {
      signIn(undefined, { callbackUrl: '/pricing' });
      return;
    }

    setLoading(true);
    try {
      const payload = getBillingPayload({ plan, billingCycle: billing }, billing, proPrice);
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data || !data.subscriptionId) {
        toast('Unable to create subscription.');
        setLoading(false);
        return;
      }

      const options: Record<string, unknown> = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        handler: async function (response: unknown) {
          await fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              getBillingPayload(response as Record<string, unknown>, billing, proPrice),
            ),
          });
          onClose();
          window.location.href = '/profile';
        },
        prefill: {
          name: profile?.name ?? session.user?.name ?? 'User',
          email: profile?.email ?? session.user?.email ?? data.email ?? '',
        },
        theme: { color: '#2563eb' },
      };

      try {
        type RazorpayCtor = new (opts: unknown) => { open: () => void };
        const RazorpayCtor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
        if (!RazorpayCtor) throw new Error('Razorpay not available on window');
        const rzp = new RazorpayCtor(options);
        rzp.open();
        } catch (err) {
        logger.error(`Error opening Razorpay: ${String(err)}`, { className: 'SubscriptionModal', methodName: 'handleSubscribe' });
        toast('Failed to open payment gateway.');
      }
    } catch (err) {
      logger.error(`subscribe client error: ${String(err)}`, { className: 'SubscriptionModal', methodName: 'handleSubscribe' });
      toast('Subscription failed.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 p-6 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-gray-100">
              Choose your plan
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Start for free. Upgrade anytime for unlimited AI-powered tutoring.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-600 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PricingCard
            planKey="pro"
            title="Pro"
            priceMonthly={PRICES[BILLING_MONTHLY]}
            priceAnnual={PRICES[BILLING_ANNUAL]}
            features={['Unlimited questions']}
            selected={plan === 'pro'}
            compact
            onSelect={() => setPlan('pro')}
            billing={billing}
            cta={null}
          />

          <PricingCard
            planKey="enterprise"
            title="Enterprise"
            features={['For teams & schools']}
            selected={plan === 'enterprise'}
            compact
            onSelect={() => setPlan('enterprise')}
            billing={billing}
            cta={null}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">Billing</div>
          <div className="flex gap-2">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-3 py-1 rounded ${billing === 'monthly' ? 'bg-blue-600 text-white' : 'border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-3 py-1 rounded ${billing === 'annual' ? 'bg-blue-600 text-white' : 'border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
            >
              Annual
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-cyan-800 border rounded-md">
            Cancel
          </button>
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Processing...' : 'Subscribe'}
          </button>
        </div>
      </div>
    </div>
  );
}
