'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Script from 'next/script';

// Define a type for RazorpayOptions to avoid self-referencing error
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: unknown) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
};

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  // Prices
  const proPrice = billingCycle === 'monthly' ? 299 : 2999;

  // Razorpay checkout handler
  const handleSubscribe = async (plan: string) => {
    if (!session) {
      signIn(undefined, { callbackUrl: '/pricing' });
      return;
    }
    try {
      setLoading(true);

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });

      const data = await res.json();
      if (!data.orderId) throw new Error('Failed to create order');

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: data.amount,
        currency: 'INR',
        name: 'Spinzy Academy',
        description: `${plan} Subscription (${billingCycle})`,
        order_id: data.orderId,
        handler: async function (response: unknown) {
          // verify payment on server
          await fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          alert('✅ Payment successful!');
          window.location.href = '/';
        },
        prefill: {
          name: session.user?.name ?? 'User',
          email: data.email ?? session.user?.email ?? '',
        },
        theme: { color: '#2563eb' },
      };

      // Use the RazorpayOptions type in the cast to avoid self-reference
      const rzp = new (
        window as unknown as { Razorpay: new (options: RazorpayOptions) => { open: () => void } }
      ).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('❌ Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Razorpay Script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <h1 className="text-4xl font-bold text-center mb-8">Pricing Plans</h1>

      {/* Toggle */}
      <div className="flex justify-center items-center mb-10 gap-4">
        <span
          className={`cursor-pointer ${billingCycle === 'monthly' ? 'font-bold' : 'text-gray-500'}`}
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={billingCycle === 'annual'}
            onChange={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
          />
          <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600">
            <div className="absolute top-0.5 left-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </div>
        </label>
        <span
          className={`cursor-pointer ${billingCycle === 'annual' ? 'font-bold' : 'text-gray-500'}`}
          onClick={() => setBillingCycle('annual')}
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
        <div className="border rounded-xl shadow p-6 text-center bg-blue-50">
          <h2 className="text-xl font-semibold">Pro</h2>
          <p className="mt-4 text-4xl font-bold">₹{proPrice}</p>
          <p className="text-gray-500">{billingCycle === 'monthly' ? 'per month' : 'per year'}</p>
          <p className="mt-2">Unlimited questions</p>
          <button
            onClick={() => handleSubscribe('pro')}
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
    </div>
  );
}
